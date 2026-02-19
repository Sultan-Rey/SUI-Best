import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of, forkJoin } from 'rxjs';
import { map, tap, catchError, switchMap, delay } from 'rxjs/operators';

import {
  Conversation,
  Message,
  MessageStatus,
  ConversationStatus,
  CreateConversationRequest,
  CreateMessageRequest,
  ConversationUtils
} from '../../models/Conversation';
import { ApiJSON } from '../API/LOCAL/api-json';
import { ProfileService } from '../PROFILE_SERVICE/profile-service';

@Injectable({ providedIn: 'root' })
export class MessageService {

  private readonly CONVERSATIONS_RESOURCE = 'conversations';
  // Les messages sont maintenant intégrés dans les conversations, plus de ressource séparée

  // ─── Stores internes ────────────────────────────────────────
  /** Cache des conversations */
  private conversationsSubject = new BehaviorSubject<Conversation[]>([]);
  /** Cache des messages de la conversation ouverte */
  private messagesSubject = new BehaviorSubject<Message[]>([]);
  /** Cache des noms des participants par ID */
  private participantNamesSubject = new BehaviorSubject<Map<string, string>>(new Map());
  /** Cache des statuts de frappe */
  private typingStatusSubject = new BehaviorSubject<Map<string, boolean>>(new Map());

  // ─── Observables publics ────────────────────────────────────
  public conversations$ = this.conversationsSubject.asObservable();
  public messages$ = this.messagesSubject.asObservable();
  public participantNames$ = this.participantNamesSubject.asObservable();
  public typingStatus$ = this.typingStatusSubject.asObservable();

  constructor(
    private api: ApiJSON,
    private profileService: ProfileService
  ) {}

  // ==============================================================
  //  CONVERSATIONS
  // ==============================================================

  /**
   * Charge les conversations de l'utilisateur courant
   */
  getConversations(currentUserId: string): Observable<Conversation[]> {
    return this.api.get<Conversation[]>(this.CONVERSATIONS_RESOURCE).pipe(
      map(conversations => {
        // Filtrer pour ne retourner que les conversations où l'utilisateur est participant
        return conversations.filter(conv => 
          conv.participantIds.includes(currentUserId)
        );
      }),
      switchMap(userConversations => {
        // Si aucune conversation, retourner un tableau vide directement
        if (userConversations.length === 0) {
          return of([]);
        }
        
        // Pour chaque conversation, récupérer les infos du participant via ProfileService
        const participantRequests = userConversations.map(conv => {
          const receiverId = ConversationUtils.getReceiverId(conv.participantIds, currentUserId);
          return this.profileService.getProfileById(receiverId).pipe(
            map(profile => ({
              ...conv,
              participant: {
                id: receiverId,
                username: profile?.username || 'Unknown',
                avatar: profile?.avatar || 'assets/avatar-default.png',
                isOnline: Math.random() > 0.5,
                isTyping: false,
                isVerified: profile?.isVerified || false,
                userType: profile?.userType || 'fan',
                stats: profile?.stats.fans,
                plan: profile?.plan || 'free'
              },
              unreadCount: conv.messages?.filter(msg => msg.status === 'sent' && msg.receiverId == currentUserId).length || 0,
              lastMessage: conv.messages?.length > 0 ? conv.messages[conv.messages.length - 1].content : '',
              lastMessageTime: conv.messages?.length > 0 ? conv.messages[conv.messages.length - 1].createdAt : new Date(),
              lastMessageType: conv.messages?.length > 0 ? this.getMessageType(conv.messages[conv.messages.length - 1].content) : 'text'
            }))
          );
        });
        
        // Combiner toutes les requêtes de profil
        return forkJoin(participantRequests);
      }),
      tap(enrichedConversations => {
        this.conversationsSubject.next(enrichedConversations);
        this.loadParticipantNames(enrichedConversations, currentUserId);
      }),
      catchError(error => {
        console.error('[MessageService] getConversations:', error);
        return of([]);
      })
    );
  }



  /**
   * Marque une conversation comme ouverte/fermée
   */
  updateConversationStatus(conversationId: string, status: ConversationStatus): Observable<void> {
    return this.api.patch<void>(this.CONVERSATIONS_RESOURCE, conversationId, { status } as any).pipe(
      map(() => undefined),
      tap(() => {
        const conversations = this.conversationsSubject.value.map(c =>
          c.id === conversationId ? { ...c, status } : c
        );
        this.conversationsSubject.next(conversations);

        // Si la conversation est ouverte, marquer tous les messages comme lus
        if (status === 'open') {
          this.markAllMessagesAsRead(conversationId);
        }
      }),
      catchError(error => {
        console.error('[MessageService] updateConversationStatus:', error);
        return of(undefined as void);
      })
    );
  }

  /**
   * Supprime une conversation
   */
  deleteConversation(conversationId: string): Observable<void> {
    return this.api.delete(this.CONVERSATIONS_RESOURCE, conversationId).pipe(
      tap(() => {
        const conversations = this.conversationsSubject.value.filter(c => c.id !== conversationId);
        this.conversationsSubject.next(conversations);

        // Purger les messages de cette conversation
        const messages = this.messagesSubject.value.filter(m => m.conversationId !== conversationId);
        this.messagesSubject.next(messages);
      }),
      catchError(error => {
        console.error('[MessageService] deleteConversation:', error);
        return of(undefined as void);
      })
    );
  }

  /**
   * Vérifie si une conversation existe avec exactement le couple d'IDs participants.
   * Si trouvée, retourne son ID. Sinon, retourne null.
   */
  findExistingConversationId(participantIds: [string, string], currentUserId: string): Observable<string | null> {
    return this.getConversations(currentUserId).pipe(
      map(conversations => {
        // Rechercher une conversation avec exactement les deux participants
        const existingConversation = conversations.find(conv => {
          // Vérifier que la conversation a exactement 2 participants
          if (conv.participantIds.length !== 2) return false;
          
          // Vérifier que les participants correspondent exactement (ordre non important)
          const convParticipants = [...conv.participantIds].sort();
          const requestedParticipants = [...participantIds].sort();
          
          return convParticipants[0] === requestedParticipants[0] && 
                 convParticipants[1] === requestedParticipants[1];
        });

        return existingConversation?.id || null;
      })
    );
  }

  // ==============================================================
  //  MESSAGES
  // ==============================================================

  /**
   * Crée une nouvelle conversation avec ses messages
   */
  createConversation(conversation: Conversation): Observable<Conversation> {
    // Ajouter immédiatement au cache local
    const currentConversations = this.conversationsSubject.getValue();
    this.conversationsSubject.next([...currentConversations, conversation]);

    // Appel API réel pour créer la conversation
    return this.api.create<Conversation>(this.CONVERSATIONS_RESOURCE, conversation).pipe(
      tap(createdConversation => {
        // Mettre à jour le cache avec la conversation créée par le backend
        const conversations = this.conversationsSubject.getValue();
        const index = conversations.findIndex(c => c.id === conversation.id);
        if (index !== -1) {
          const updatedConvs = [...conversations];
          updatedConvs[index] = createdConversation;
          this.conversationsSubject.next(updatedConvs);
        }
      }),
      catchError(error => {
        console.error('[MessageService] createConversation error:', error);
        // En cas d'erreur, retirer la conversation temporaire du cache
        const conversations = this.conversationsSubject.getValue();
        const filteredConvs = conversations.filter(c => c.id !== conversation.id);
        this.conversationsSubject.next(filteredConvs);
        return of(conversation); // Retourner la conversation locale en fallback
      })
    );
  }

  /**
   * Met à jour une conversation existante avec un nouveau message
   */
  sendMessage(conversation: Conversation): Observable<Conversation> {
    // Appel API réel pour mettre à jour la conversation
    return this.api.update<Conversation>(this.CONVERSATIONS_RESOURCE, conversation.id as string, conversation).pipe(
      tap(updatedConversation => {
        // Mettre à jour le cache avec la conversation retournée par le backend
        const conversations = this.conversationsSubject.getValue();
        const convIndex = conversations.findIndex(c => c.id === conversation.id);
        if (convIndex !== -1) {
          const updatedConvs = [...conversations];
          updatedConvs[convIndex] = updatedConversation;
          
          // Mettre à jour le statut du dernier message à 'sent'
          if (updatedConvs[convIndex].messages.length > 0) {
            updatedConvs[convIndex].messages[updatedConvs[convIndex].messages.length - 1].status = 'pending';
          }
          
          this.conversationsSubject.next(updatedConvs);
        }
      }),
      catchError(error => {
        console.error('[MessageService] sendMessage error:', error);
        // En cas d'erreur, restaurer le statut pending du dernier message
        const conversations = this.conversationsSubject.getValue();
        const convIndex = conversations.findIndex(c => c.id === conversation.id);
        if (convIndex !== -1) {
          const messages = conversations[convIndex].messages;
          if (messages.length > 0) {
            messages[messages.length - 1].status = 'pending';
          }
          this.conversationsSubject.next([...conversations]);
        }
        return of(conversation); // Retourner la conversation locale en fallback
      })
    );
  }

  // ==============================================================
  //  STATUTS DE FRAPPE
  // ==============================================================

  /**
   * Envoie le statut de frappe d'un utilisateur
   */
  sendTypingStatus(conversationId: string, receiverId: string, isTyping: boolean): void {
    // Mettre à jour le cache local
    const currentStatus = this.typingStatusSubject.getValue();
    const key = `${conversationId}_${receiverId}`;
    const updatedStatus = new Map(currentStatus);
    updatedStatus.set(key, isTyping);
    this.typingStatusSubject.next(updatedStatus);

    // TODO: Envoyer au backend via WebSocket ou SSE
    // Pour l'instant, juste une mise à jour locale
    console.log(`[MessageService] Typing status updated: ${conversationId}_${receiverId} = ${isTyping}`);
  }

  /**
   * Vérifie si un utilisateur est en train de taper dans une conversation
   */
  isUserTyping(conversationId: string, userId: string): boolean {
    const currentStatus = this.typingStatusSubject.getValue();
    const key = `${conversationId}_${userId}`;
    return currentStatus.get(key) || false;
  }

 

  // ==============================================================
  //  UTILITAIRES
  // ==============================================================

   /**
   * Marque une conversation comme ouverte et tous ses messages comme lus
   */
  markConversationAsRead(conversationId: string) {
    // Récupérer la conversation actuelle
    const currentConversations = this.conversationsSubject.getValue();
    const conversationIndex = currentConversations.findIndex(c => c.id === conversationId);
    
    if (conversationIndex === -1) {
      console.error('[MessageService] Conversation not found:', conversationId);
      return;
    }
    
    const conversation = currentConversations[conversationIndex];
    
    // Préparer la conversation mise à jour avec les messages lus
    const updatedConversation = {
      ...conversation,
      messages: conversation.messages.map(msg => ({
        ...msg,
        status: 'read' as MessageStatus
      })),
      status: 'open' as ConversationStatus,
      unreadCount: 0
    };
    
    // Mettre à jour la conversation complète dans le backend
    this.api.update<Conversation>(this.CONVERSATIONS_RESOURCE, conversationId, updatedConversation).subscribe({
      next: (backendConversation) => {
        // Mettre à jour le cache local avec la réponse du backend
        const updatedConversations = [...currentConversations];
        updatedConversations[conversationIndex] = backendConversation;
        this.conversationsSubject.next(updatedConversations);
        
        console.log('[MessageService] Conversation marked as read:', conversationId);
      },
      error: (error) => {
        console.error('[MessageService] markConversationAsRead error:', error);
      }
    });
  }

  /**
   * Marque les messages d'une conversation comme lus pour un expéditeur spécifique
   * Seuls les messages dont le senderId est différent de celui fourni sont marqués comme lus
   */
  markMessageAsRead(conversationId: string, senderId: string) {
    // Récupérer la conversation actuelle
    const currentConversations = this.conversationsSubject.getValue();
    const conversationIndex = currentConversations.findIndex(c => c.id === conversationId);
    
    if (conversationIndex === -1) {
      console.error('[MessageService] Conversation not found:', conversationId);
      return;
    }
    
    const conversation = currentConversations[conversationIndex];
    
    // Filtrer et marquer uniquement les messages dont le senderId est différent
    const updatedMessages = conversation.messages.map(msg => {
      if (msg.senderId !== senderId) {
        return {
          ...msg,
          status: 'read' as MessageStatus
        };
      }
      return msg; // Garder le message inchangé si senderId correspond
    });
    
    // Calculer le nouveau nombre de messages non lus
    const unreadCount = updatedMessages.filter(msg => 
      msg.status === 'sent' && msg.receiverId === senderId
    ).length;
    
    // Préparer la conversation mise à jour
    const updatedConversation = {
      ...conversation,
      messages: updatedMessages,
      unreadCount: unreadCount
    };
    
    // Mettre à jour la conversation complète dans le backend
    this.api.update<Conversation>(this.CONVERSATIONS_RESOURCE, conversationId, updatedConversation).subscribe({
      next: (backendConversation) => {
        // Mettre à jour le cache local avec la réponse du backend
        const updatedConversations = [...currentConversations];
        updatedConversations[conversationIndex] = backendConversation;
        this.conversationsSubject.next(updatedConversations);
        
        console.log(`[MessageService] Messages marked as read for conversation ${conversationId}, excluding sender ${senderId}`);
      },
      error: (error) => {
        console.error('[MessageService] markMessageAsRead error:', error);
      }
    });
  }

  

  /**
   * Détecte le type de message à partir de son contenu
   */
  private getMessageType(content: string): 'text' | 'image' | 'video' | 'voice' | 'file' {
    if (content.includes('[image]') || content.includes('🖼️')) return 'image';
    if (content.includes('[video]') || content.includes('🎥')) return 'video';
    if (content.includes('[voice]') || content.includes('🎤')) return 'voice';
    if (content.includes('[file]') || content.includes('📎')) return 'file';
    return 'text';
  }

  /**
   * Charge les noms des participants depuis ProfileService
   */
  private loadParticipantNames(conversations: Conversation[], currentUserId: string): void {
    const participantIds = new Set<string>();
    
    conversations.forEach(conv => {
      conv.participantIds.forEach(id => {
        if (id !== currentUserId) {
          participantIds.add(id);
        }
      });
    });

    const participantNames = new Map<string, string>();
    
    Array.from(participantIds).forEach(id => {
      this.profileService.getProfileById(id).subscribe(profile => {
        participantNames.set(id, profile?.username || 'Utilisateur inconnu');
        this.participantNamesSubject.next(new Map(participantNames));
      });
    });
  }

  /**
   * Met à jour la conversation avec un nouveau message
   */
  private updateConversationWithNewMessage(message: Message): void {
    const conversations = this.conversationsSubject.value.map(conv => {
      if (conv.id !== message.conversationId) return conv;
      
      return {
        ...conv,
        messages: [...conv.messages, message]
      };
    });
    this.conversationsSubject.next(conversations);
  }

  /**
   * Marque tous les messages d'une conversation comme lus
   */
  private markAllMessagesAsRead(conversationId: string): void {
    const messages = this.messagesSubject.value.map(m =>
      m.conversationId === conversationId ? { ...m, status: 'read' as MessageStatus } : m
    );
    this.messagesSubject.next(messages);
  }

  /**
   * Obtient le nom d'un participant à partir de son ID
   */
  getParticipantName(participantId: string): string {
    const participantNames = this.participantNamesSubject.value;
    return participantNames.get(participantId) || 'Utilisateur inconnu';
  }

  /**
   * Détermine l'ID du receiver à partir des participants
   */
  getReceiverId(conversation: Conversation, currentUserId: string): string {
    return ConversationUtils.getReceiverId(conversation.participantIds, currentUserId);
  }
}
