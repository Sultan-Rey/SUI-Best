import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of, forkJoin, throwError } from 'rxjs';
import { map, tap, catchError, switchMap } from 'rxjs/operators';
import { map as rxMap } from 'rxjs';
import { ApiJSON } from '../API/LOCAL/api-json';
import { ProfileService } from '../PROFILE_SERVICE/profile-service';
import {
  Conversation, Message, MessageStatus,
  ConversationStatus, ConversationUtils
} from '../../models/Conversation';

// ─── Interfaces SSE ───────────────────────────────────────────────────────────

export interface StreamEvent {
  event: 'connected' | 'message' | 'presence' | 'timeout' | 'error';
  data: any;
  timestamp: number;
}

export interface PresenceData {
  user_id: string;
  username: string;
  avatar: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class MessageService {

  private readonly RESOURCE = 'conversations';

  // ─── Stores ───────────────────────────────────────────────────────────────
  private conversationsSubject  = new BehaviorSubject<Conversation[]>([]);
  private participantNamesCache = new Map<string, string>();
  private activeStreams          = new Map<string, EventSource>();

  // ─── Observables publics ──────────────────────────────────────────────────
  public conversations$ = this.conversationsSubject.asObservable();

  constructor(
    private api: ApiJSON,
    private profileService: ProfileService
  ) {}

  // ==============================================================
  //  CONVERSATIONS
  // ==============================================================

  /**
   * Charge les conversations de l'utilisateur depuis le backend.
   * Enrichit chaque conversation avec le profil du participant.
   */
  getConversations(currentUserId: string): Observable<Conversation[]> {
    return this.api.get<Conversation[]>(this.RESOURCE).pipe(
      map(conversations =>
        conversations.filter(c =>
          c.participantIds.includes(currentUserId) &&
          !c.deletedFor?.includes(currentUserId)
        )
      ),
      switchMap(conversations => this.enrichWithProfiles(conversations, currentUserId)),
      tap(enriched => this.conversationsSubject.next(enriched)),
      catchError(err => {
        console.error('[MessageService] getConversations:', err);
        return of([]);
      })
    );
  }

  /**
   * Crée une nouvelle conversation.
   */
  createConversation(conversation: Partial<Conversation>): Observable<Conversation> {
    const { id: _id, ...payload } = conversation as any;

    return this.api.post<Conversation>(this.RESOURCE, payload).pipe(
      tap(created => {
        const current = this.conversationsSubject.value;
        this.conversationsSubject.next([created, ...current]);
      }),
      catchError(err => {
        console.error('[MessageService] createConversation:', err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Met à jour une conversation (status, deletedFor, groupData…).
   * N'utilise PAS cette méthode pour envoyer des messages — utiliser sendMessage().
   */
  updateConversation(conversation: Conversation): Observable<Conversation> {
    return this.api.patch<Conversation>(this.RESOURCE, conversation.id as string, conversation).pipe(
      tap(updated => this.updateConversationInStore(updated)),
      catchError(err => {
        console.error('[MessageService] updateConversation:', err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Supprime une conversation.
   */
  deleteConversation(conversationId: string): Observable<void> {
    return this.api.delete(this.RESOURCE, conversationId).pipe(
      tap(() => {
        const filtered = this.conversationsSubject.value.filter(c => c.id !== conversationId);
        this.conversationsSubject.next(filtered);
      }),
      catchError(err => {
        console.error('[MessageService] deleteConversation:', err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Vérifie si une conversation existe entre le currentUser et l'otherUser.
   * Retourne l'ID si trouvé, null sinon.
   */
  findExistingConversationId(currentUserId: string, otherUserId: string): Observable<string | null> {
    return this.getConversations(currentUserId).pipe(
      map(conversations => {
        // Cherche une conversation où otherUserId est soit participant, soit supprimé
        const found = conversations.find(c => {
          // Vérifie si otherUserId est dans participantIds
          const isInParticipants = c.participantIds.includes(otherUserId);
          // Vérifie si otherUserId est dans deletedFor
          const isInDeletedFor = c.deletedFor?.includes(otherUserId);
          
          // Retourne true si otherUserId est dans l'un des deux tableaux
          return isInParticipants || isInDeletedFor;
        });
        
        return found?.id ?? null;
      })
    );
  }

  /**
   * Réhabilite un utilisateur dans une conversation.
   * Ajoute l'utilisateur dans participantIds et le supprime de deletedFor.
   */
  rehabilitateUserInConversation(conversationId: string, participants: string[]): Observable<Conversation> {
    return this.api.patch<Conversation>(
      `${this.RESOURCE}`,conversationId,
      {
        participantIds: participants
      }
    ).pipe(
      tap(updatedConversation => {
        // Met à jour le store local
        this.conversationsSubject.next(
          this.conversationsSubject.value.map(c => 
            c.id === conversationId ? updatedConversation : c
          )
        );
      }),
      catchError(err => {
        console.error('[MessageService] rehabilitateUserInConversation:', err);
        return throwError(() => err);
      })
    );
  }

  // ==============================================================
  //  MESSAGES
  // ==============================================================

  /**
   * Envoie un message via POST /conversations/{id}/messages
   * Utilise la route dédiée du ConversationsController côté backend.
   */
  sendMessage(conversationId: string, message: Partial<Message>): Observable<Message> {
    return this.api.post<Message>(
      `${this.RESOURCE}/${conversationId}/messages`,
      message
    ).pipe(
      tap(sent => this.appendMessageToStore(conversationId, sent)),
      catchError(err => {
        console.error('[MessageService] sendMessage:', err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Charge les messages paginés d'une conversation.
   */
  getMessages(conversationId: string, limit = 50, offset = 0): Observable<Message[]> {
    return this.api.get<{ data: Message[]; pagination: any }>(
      `${this.RESOURCE}/${conversationId}/messages`,
      { limit, offset }
    ).pipe(
      map(res => res.data),
      catchError(err => {
        console.error('[MessageService] getMessages:', err);
        return of([]);
      })
    );
  }

  /**
   * Marque un message comme lu via PATCH /conversations/{id}/messages/{mid}/read
   */
 markMessageAsRead(conversationId: string, messageId: string): Observable<void> {
  return this.api.request<void>(
    'PATCH',
    `${this.RESOURCE}/${conversationId}/messages/${messageId}/read`
  ).pipe(
    tap(() => this.markMessageReadInStore(conversationId, messageId)),
    catchError(err => {
      console.error('[MessageService] markMessageAsRead:', err);
      return of(undefined as void);
    })
  );
}

  /**
   * Retourne le nombre de messages non lus pour un utilisateur dans une conversation.
   */
  getUnreadCount(conversationId: string, userId: string): Observable<number> {
    return this.api.get<{ unread_count: number }>(
      `${this.RESOURCE}/${conversationId}/unread`,
      { user_id: userId }
    ).pipe(
      map(res => res.unread_count),
      catchError(() => of(0))
    );
  }

  getTotalUnread(userId: string): Observable<{ user_id: string; unread_total: number }> {
  return this.api.get<{ user_id: string; unread_total: number }>(
    'conversations/unread-total',
    { user_id: userId }
  );
}

  // ==============================================================
  //  UPLOAD FICHIERS CHAT
  // ==============================================================

  /**
   * Uploade un fichier dans le sous-dossier chat de la conversation.
   * Retourne l'URL relative pour l'inclure dans le contenu du message.
   */
  uploadFile(file: File, conversationId: string): Observable<{ url: string; path: string }> {
    return this.api.upload<any>(file, `chat/${conversationId}`).pipe(
      map((event: any) => {
        // L'event HttpResponse final contient le body
        if (event?.body) {
          return { url: event.body.url, path: event.body.path };
        }
        return event;
      }),
      catchError(err => {
        console.error('[MessageService] uploadFile:', err);
        return throwError(() => err);
      })
    );
  }

  // ==============================================================
  //  SSE — TEMPS RÉEL
  // ==============================================================

  /**
   * Ouvre une connexion SSE vers SSE/stream.php.
   * Pousse les nouveaux messages et la présence en temps réel.
   * Le token est passé en query string (EventSource ne supporte pas les headers).
   *
   * @param conversationId  ID de la conversation à écouter
   * @param since           Timestamp ISO du dernier message reçu (reprise après coupure)
   */
  connectToRealTime(conversationId: string, since?: string): Observable<StreamEvent> {
    return new Observable<StreamEvent>(observer => {
      const token  = this.api.getToken();
      const base   = (this.api as any).BASE_URL;
      const params = new URLSearchParams({ conversation_id: conversationId, token });
      if (since) params.set('since', since);

      const url         = `${base.replace(/\/api$/, '')}/SSE/stream.php?${params}`;
      const eventSource = new EventSource(url);

      this.activeStreams.set(conversationId, eventSource);

      eventSource.addEventListener('connected', (e: MessageEvent) => {
        observer.next({ event: 'connected', data: JSON.parse(e.data), timestamp: Date.now() });
      });

      eventSource.addEventListener('message', (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data) as Message;
          this.appendMessageToStore(conversationId, msg);
          observer.next({ event: 'message', data: msg, timestamp: Date.now() });
        } catch { /* ignore parse errors */ }
      });

      eventSource.addEventListener('presence', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          observer.next({ event: 'presence', data, timestamp: Date.now() });
        } catch { /* ignore */ }
      });

      eventSource.addEventListener('timeout', () => {
        observer.next({ event: 'timeout', data: {}, timestamp: Date.now() });
        // EventSource reconnecte automatiquement — pas besoin de compléter
      });

      eventSource.onerror = () => {
        observer.next({ event: 'error', data: { message: 'SSE connection error' }, timestamp: Date.now() });
      };

      return () => {
        eventSource.close();
        this.activeStreams.delete(conversationId);
      };
    });
  }

  /**
   * Déconnecte toutes les connexions SSE actives.
   */
  disconnectAll(): void {
    this.activeStreams.forEach(es => es.close());
    this.activeStreams.clear();
  }

  // ==============================================================
  //  PRÉSENCE
  // ==============================================================

  /**
   * Ping de présence — à appeler toutes les 30s depuis le composant actif.
   * POST SSE/presence.php
   */
  pingPresence(conversationId: string): Observable<PresenceData[]> {
    const token = this.api.getToken();
    const base  = (this.api as any).BASE_URL;
    const url   = `${base.replace(/\/api$/, '')}/SSE/presence.php`;

    // On utilise fetch directement car c'est un endpoint hors du routing index.php
    return new Observable(observer => {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, conversation_id: conversationId })
      })
      .then(r => r.json())
      .then(data => { observer.next(data.online ?? []); observer.complete(); })
      .catch(err => { observer.error(err); });
    });
  }

  /**
   * Notifie que l'utilisateur quitte la conversation.
   * DELETE SSE/presence.php
   */
  leavePresence(conversationId: string): void {
    const token = this.api.getToken();
    const base  = (this.api as any).BASE_URL;
    const url   = `${base.replace(/\/api$/, '')}/SSE/presence.php`;

    fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, conversation_id: conversationId })
    }).catch(() => { /* fire and forget */ });
  }

  // ==============================================================
  //  GROUPE
  // ==============================================================

  addParticipant(conversationId: string, participantId: string): Observable<Conversation> {
    const conv = this.conversationsSubject.value.find(c => c.id === conversationId);
    if (!conv) return throwError(() => new Error('Conversation not found'));
    if (conv.participantIds.includes(participantId)) return of(conv);

    const participantName = this.getParticipantName(participantId);
    const systemMsg       = this.buildSystemMessage(conversationId, participantId, participantName, 'joined');
    const updated         = {
      ...conv,
      participantIds: [...conv.participantIds, participantId],
      messages: [...conv.messages, systemMsg],
    };

    return this.updateConversation(updated);
  }

  removeParticipant(conversationId: string, participantId: string): Observable<Conversation> {
    const conv = this.conversationsSubject.value.find(c => c.id === conversationId);
    if (!conv) return throwError(() => new Error('Conversation not found'));
    if (!conv.participantIds.includes(participantId)) return of(conv);

    const participantName = this.getParticipantName(participantId);
    const systemMsg       = this.buildSystemMessage(conversationId, participantId, participantName, 'left');
    const updated         = {
      ...conv,
      participantIds: conv.participantIds.filter(id => id !== participantId),
      groupData: conv.groupData ? {
        ...conv.groupData,
        participants: conv.groupData.participants.filter((id: string) => id !== participantId),
        admins:       conv.groupData.admins.filter((id: string) => id !== participantId),
      } : undefined,
      messages: [...conv.messages, systemMsg],
    };

    return this.updateConversation(updated);
  }

  // ==============================================================
  //  UTILITAIRES
  // ==============================================================

  getParticipantName(participantId: string): string {
    return this.participantNamesCache.get(participantId) ?? 'Unknown';
  }

  // ─── Privés ───────────────────────────────────────────────────

  /**
   * Enrichit chaque conversation avec le profil du participant distant.
   * Ne fait qu'un seul appel par participant unique.
   */
  private enrichWithProfiles(conversations: Conversation[], currentUserId: string): Observable<Conversation[]> {
    if (conversations.length === 0) return of([]);

    const requests = conversations.map(conv => {
      const receiverId = ConversationUtils.getReceiverId(conv.participantIds, currentUserId);
      return this.profileService.getProfileById(receiverId).pipe(
        map(profile => {
          if (profile?.username) this.participantNamesCache.set(receiverId, profile.username);
          return {
            ...conv,
            participant: {
              id:        receiverId,
              username:  profile?.username  ?? 'Unknown',
              avatar:    profile?.avatar    ?? 'assets/avatar-default.png',
              isOnline:  false, // mis à jour par SSE/presence
              isTyping:  false,
              isVerified: profile?.isVerified ?? false,
              userType:  profile?.type ?? 'fan',
              stats:     profile?.stats?.fans,
              plan:      profile?.userInfo?.memberShip?.plan ?? 'free',
            },
          } as Conversation;
        }),
        catchError(() => of(conv))
      );
    });

    return forkJoin(requests);
  }

  private updateConversationInStore(updated: Conversation): void {
    const list  = this.conversationsSubject.value;
    const index = list.findIndex(c => c.id === updated.id);
    if (index === -1) return;
    const next = [...list];
    next[index] = updated;
    this.conversationsSubject.next(next);
  }

  private appendMessageToStore(conversationId: string, message: Message): void {
    const list  = this.conversationsSubject.value;
    const index = list.findIndex(c => c.id === conversationId);
    if (index === -1) return;
    const conv  = list[index];
    // Eviter les doublons (message optimiste déjà présent)
    if (conv.messages.some(m => m.id === message.id)) return;
    const next  = [...list];
    next[index] = {
      ...conv,
      messages:        [...conv.messages, message],
      lastMessage:     message.content,
      lastMessageTime: message.createdAt,
      unreadCount:     (conv.unreadCount ?? 0) + 1,
    };
    this.conversationsSubject.next(next);
  }

  private markMessageReadInStore(conversationId: string, messageId: string): void {
    const list  = this.conversationsSubject.value;
    const index = list.findIndex(c => c.id === conversationId);
    if (index === -1) return;
    const conv  = list[index];
    const next  = [...list];
    next[index] = {
      ...conv,
      messages: conv.messages.map(m =>
        m.id === messageId ? { ...m, status: 'read' as MessageStatus } : m
      ),
      unreadCount: Math.max(0, (conv.unreadCount ?? 1) - 1),
    };
    this.conversationsSubject.next(next);
  }

  private buildSystemMessage(
    conversationId: string,
    userId: string,
    participantName: string,
    action: 'joined' | 'left'
  ): Message {
    return {
      id:             `system-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      conversationId,
      senderId:       'system',
      receiverId:     conversationId,
      content:        action === 'joined' ? `${participantName} a rejoint le groupe` : `${participantName} a quitté le groupe`,
      type:           'system',
      systemData:     { participantName, action },
      status:         'sent',
      createdAt:      new Date(),
    };
  }
}
