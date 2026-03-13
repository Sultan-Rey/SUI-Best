import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of, forkJoin, Subject, timer } from 'rxjs';
import { map, tap, catchError, switchMap, delay, distinctUntilChanged } from 'rxjs/operators';
import { throwError } from 'rxjs';

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
import { FirebaseService } from '../API/firebase/firebase-service';

// ┌─────────────────────────────────────────────────────────────┐
// │  TYPING INDICATORS INTERFACES                                 │
// └─────────────────────────────────────────────────────────────┘

export interface TypingIndicator {
  userId: string;
  isTyping: boolean;
  lastTyped: number;
}

export interface ConversationTyping {
  conversationId: string;
  participants: TypingIndicator[];
}

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
  
  // ─── Typing Service Integration ────────────────────────────────
  /** Subjects pour la gestion de frappe temps réel */
  private typingSubjects = new Map<string, Subject<TypingIndicator[]>>();
  /** Timeout pour la détection de frappe */
  private readonly TYPING_TIMEOUT = 3000; // 3 secondes

  // ─── Online Presence Integration ────────────────────────────────
  /** Cache des statuts en ligne par utilisateur */
  private onlineStatusSubject = new BehaviorSubject<Map<string, { isOnline: boolean; lastSeen: any }>>(new Map());
  
  // ─── Observables publics ────────────────────────────────────
  public conversations$ = this.conversationsSubject.asObservable();
  public messages$ = this.messagesSubject.asObservable();
  public participantNames$ = this.participantNamesSubject.asObservable();
  public typingStatus$ = this.typingStatusSubject.asObservable();
  public onlineStatus$ = this.onlineStatusSubject.asObservable();

  constructor(
    private api: FirebaseService,
    private profileService: ProfileService
  ) {}

  // ==============================================================
  //  CONVERSATIONS
  // ==============================================================

  /**
   * Charge les conversations de l'utilisateur courant
   */
  getConversations(currentUserId: string): Observable<Conversation[]> {
    return this.api.get<Conversation>(this.CONVERSATIONS_RESOURCE).pipe(
      map(conversations => {
        // Filtrer pour ne retourner que les conversations où l'utilisateur est participant
        return conversations.filter(conv => 
          conv.participantIds.includes(currentUserId)
        );
      }),
      map(userConversations => {
        // Fusionner les conversations avec les mêmes participants
        return this.mergeConversations(userConversations, currentUserId);
      }),
      switchMap(mergedConversations => {
        // Pour chaque conversation fusionnée, récupérer les infos du participant via ProfileService
        return this.enrichConversationsWithParticipantInfo(mergedConversations, currentUserId);
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
   * Fusionne les conversations avec les mêmes participants
   */
  private mergeConversations(conversations: Conversation[], currentUserId: string): Conversation[] {
  const mergedMap = new Map<string, Conversation>();
  
  for (const conv of conversations) {
    // Créer une clé basée sur le couple de participants (trié pour cohérence)
    const allParticipants = [...conv.participantIds];
    
    // Si l'utilisateur courant est dans deletedFor, il faut aussi l'ajouter à la clé
    // car il cherche à fusionner avec ses conversations précédentes
    if (conv.deletedFor?.includes(currentUserId)) {
      allParticipants.push(currentUserId);
    }
    
    // Trier et créer une clé unique pour le couple
    const sortedParticipants = allParticipants.sort();
    const key = sortedParticipants.join('-');
    
    if (mergedMap.has(key)) {
      // Fusionner avec la conversation existante (même couple de participants)
      const existingConv = mergedMap.get(key)!;
      
      // Fusionner les messages en ordre chronologique
      const allMessages = [...existingConv.messages, ...conv.messages]
        .filter(msg => !msg.deletedFor?.includes(currentUserId)) // Exclure les messages supprimés pour l'utilisateur
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      // Mettre à jour la conversation fusionnée
      mergedMap.set(key, {
        ...existingConv,
        messages: allMessages,
        lastMessage: allMessages[allMessages.length - 1]?.content,
        lastMessageTime: allMessages[allMessages.length - 1]?.createdAt,
        lastMessageType: this.detectMessageType(allMessages[allMessages.length - 1]),
        unreadCount: this.calculateUnreadCount(allMessages, currentUserId)
      });
    } else {
      // Ajouter la conversation au map
      // Si l'utilisateur est dans deletedFor, il ne doit voir aucun message de cette conversation
      let filteredMessages = conv.messages.filter(msg => !msg.deletedFor?.includes(currentUserId));
      
      if (conv.deletedFor?.includes(currentUserId)) {
        // L'utilisateur a supprimé cette conversation : ne voir aucun message
        filteredMessages = [];
      }
      
      mergedMap.set(key, {
        ...conv,
        messages: filteredMessages,
        lastMessage: filteredMessages.length > 0 ? filteredMessages[filteredMessages.length - 1]?.content : undefined,
        lastMessageTime: filteredMessages.length > 0 ? filteredMessages[filteredMessages.length - 1]?.createdAt : undefined,
        lastMessageType: filteredMessages.length > 0 ? this.detectMessageType(filteredMessages[filteredMessages.length - 1]) : undefined,
        unreadCount: this.calculateUnreadCount(filteredMessages, currentUserId)
      });
    }
  }
  
  return Array.from(mergedMap.values());
}

  /**
   * Détecte le type d'un message
   */
  private detectMessageType(message?: Message): 'text' | 'image' | 'video' | 'voice' | 'file' | 'system' {
    if (!message) return 'text';
    
    if (message.type === 'system') return 'system';
    
    // Détection basée sur le contenu ou l'URL
    const content = message.content.toLowerCase();
    if (content.includes('.jpg') || content.includes('.png') || content.includes('.gif')) return 'image';
    if (content.includes('.mp4') || content.includes('.webm')) return 'video';
    if (content.includes('.mp3') || content.includes('.wav') || content.includes('.webm')) return 'voice';
    if (content.includes('.pdf') || content.includes('.doc') || content.includes('.zip')) return 'file';
    
    return 'text';
  }

  /**
   * Calcule le nombre de messages non lus
   */
  private calculateUnreadCount(messages: Message[], currentUserId: string): number {
    return messages.filter(msg => 
      msg.senderId !== currentUserId && msg.status !== 'read'
    ).length;
  }

  /**
   * Enrichit les conversations avec les informations des participants
   */
  private enrichConversationsWithParticipantInfo(conversations: Conversation[], currentUserId: string): Observable<Conversation[]> {
    const participantRequests = conversations.map(conv => {
      const receiverId = ConversationUtils.getReceiverId(conv.participantIds, currentUserId);
      return this.profileService.getProfileById(receiverId).pipe(
        map(profile => {
          // Créer un objet Conversation enrichi avec les infos du participant
          const enrichedConv: Conversation = {
            ...conv,
            participant: {
              id: receiverId,
              username: profile?.username || 'Unknown',
              avatar: profile?.avatar || 'assets/avatar-default.png',
              isOnline: Math.random() > 0.5,
              isTyping: false,
              isVerified: profile?.isVerified || false,
              userType: profile?.type || 'fan',
              stats: profile?.stats.fans,
              plan: profile?.userInfo.memberShip?.plan || 'free'
            }
          };
          return enrichedConv;
        })
      );
    });
    
    return forkJoin(participantRequests);
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

   /**
   * Met à jour une conversation existante
   */
  updateConversation(conversation: Conversation): Observable<Conversation> {
    // Mettre à jour immédiatement le cache local
    const currentConversations = this.conversationsSubject.getValue();
    const index = currentConversations.findIndex(c => c.id === conversation.id);
    
    if (index !== -1) {
      const updatedConvs = [...currentConversations];
      updatedConvs[index] = conversation;
      this.conversationsSubject.next(updatedConvs);
    }
    
    // Appel API réel pour mettre à jour la conversation
    return this.api.patch<Conversation>(this.CONVERSATIONS_RESOURCE, conversation.id as string, conversation).pipe(
      tap(updatedConversation => {
        // Mettre à jour le cache avec la conversation mise à jour par le backend
        const conversations = this.conversationsSubject.getValue();
        const convIndex = conversations.findIndex(c => c.id === conversation.id);
        if (convIndex !== -1) {
          const updatedConvs = [...conversations];
          updatedConvs[convIndex] = updatedConversation;
          this.conversationsSubject.next(updatedConvs);
        }
      }),
      catchError(error => {
        console.error('[MessageService] updateConversation error:', error);
        // En cas d'erreur, restaurer la conversation originale si disponible
        const conversations = this.conversationsSubject.getValue();
        const originalConv = conversations.find(c => c.id === conversation.id);
        return of(originalConv || conversation); // Retourner la conversation existante ou celle passée en param
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
    
    // Supprimer l'ID temporaire avant de créer dans Firebase
    const { id: _tempId, ...conversationToCreate } = conversation;
    
    // Appel API réel pour créer la conversation
    return this.api.create<Conversation>(this.CONVERSATIONS_RESOURCE, conversationToCreate).pipe(
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
   * Ajoute un participant à une conversation existante
   */
  addParticipant(conversationId: string, participantId: string): Observable<Conversation> {
    // Récupérer la conversation actuelle
    const currentConversations = this.conversationsSubject.getValue();
    const conversation = currentConversations.find(c => c.id === conversationId);
    
    if (!conversation) {
      return throwError(() => new Error('Conversation not found'));
    }

    // Vérifier si le participant est déjà dans la conversation
    if (conversation.participantIds.includes(participantId)) {
      return of(conversation); // Retourner la conversation inchangée
    }

    // Récupérer le nom du participant
    const participantName = this.getParticipantName(participantId);

    // Créer un message système pour notifier l'ajout
    const systemMessage: Message = {
      id: `system-${Date.now()}-${Math.random()}`,
      conversationId,
      senderId: 'system',
      receiverId: conversationId,
      content: `${participantName} a rejoint le groupe`,
      type: 'system',
      systemData: {
        participantName,
        action: 'joined'
      },
      status: 'sent',
      createdAt: new Date()
    };

    // Mettre à jour la conversation avec le nouveau participant et le message système
    const updatedConversation: Conversation = {
      ...conversation,
      participantIds: [...conversation.participantIds, participantId],
      groupData: conversation.groupData ? {
        ...conversation.groupData,
        participants: [...conversation.groupData.participants, participantId]
      } : undefined,
      messages: [...conversation.messages, systemMessage]
    };

    // Mettre à jour immédiatement le cache local
    const index = currentConversations.findIndex(c => c.id === conversationId);
    if (index !== -1) {
      const updatedConvs = [...currentConversations];
      updatedConvs[index] = updatedConversation;
      this.conversationsSubject.next(updatedConvs);
    }

    // Appel API réel pour mettre à jour la conversation
    return this.updateConversation(updatedConversation).pipe(
      catchError(error => {
        console.error('[MessageService] addParticipant error:', error);
        // En cas d'erreur, restaurer la conversation originale
        this.conversationsSubject.next(currentConversations);
        return of(conversation);
      })
    );
  }

  /**
   * Retire un participant d'une conversation existante
   */
  removeParticipant(conversationId: string, participantId: string): Observable<Conversation> {
    // Récupérer la conversation actuelle
    const currentConversations = this.conversationsSubject.getValue();
    const conversation = currentConversations.find(c => c.id === conversationId);
    
    if (!conversation) {
      return throwError(() => new Error('Conversation not found'));
    }

    // Vérifier si le participant est dans la conversation
    if (!conversation.participantIds.includes(participantId)) {
      return of(conversation); // Retourner la conversation inchangée
    }

    // Récupérer le nom du participant
    const participantName = this.getParticipantName(participantId);

    // Créer un message système pour notifier le retrait (uniquement pour les groupes avec admins)
    let systemMessage: Message | undefined;
    if (conversation.groupData && conversation.groupData.admins.length > 0) {
      systemMessage = {
        id: `system-${Date.now()}-${Math.random()}`,
        conversationId,
        senderId: 'system',
        receiverId: conversationId,
        content: `${participantName} a quitté le groupe`,
        type: 'system',
        systemData: {
          participantName,
          action: 'left'
        },
        status: 'sent',
        createdAt: new Date()
      };
    }

    // Mettre à jour la conversation en retirant le participant et en ajoutant le message système
    const updatedConversation: Conversation = {
      ...conversation,
      participantIds: conversation.participantIds.filter(id => id !== participantId),
      groupData: conversation.groupData ? {
        ...conversation.groupData,
        participants: conversation.groupData.participants.filter(id => id !== participantId),
        admins: conversation.groupData.admins.filter(id => id !== participantId) // Retirer aussi des admins si présent
      } : undefined,
      messages: systemMessage ? [...conversation.messages, systemMessage] : conversation.messages
    };

    // Mettre à jour immédiatement le cache local
    const index = currentConversations.findIndex(c => c.id === conversationId);
    if (index !== -1) {
      const updatedConvs = [...currentConversations];
      updatedConvs[index] = updatedConversation;
      this.conversationsSubject.next(updatedConvs);
    }

    // Appel API réel pour mettre à jour la conversation
    return this.updateConversation(updatedConversation).pipe(
      catchError(error => {
        console.error('[MessageService] removeParticipant error:', error);
        // En cas d'erreur, restaurer la conversation originale
        this.conversationsSubject.next(currentConversations);
        return of(conversation);
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

  // ┌─────────────────────────────────────────────────────────────┐
  // │  TYPING INDICATORS - GESTION TEMPS RÉEL AVEC FIREBASE      │
  // └─────────────────────────────────────────────────────────────┘

  /**
   * Démarre la détection de frappe pour un utilisateur dans une conversation
   * @param conversationId ID de la conversation
   * @param userId ID de l'utilisateur qui tape
   */
  startTyping(conversationId: string, userId: string): void {
    this.updateTypingStatus(conversationId, userId, true);
    
    // Arrêter automatiquement après TYPING_TIMEOUT
    timer(this.TYPING_TIMEOUT).subscribe(() => {
      this.stopTyping(conversationId, userId);
    });
  }

  /**
   * Arrête la détection de frappe pour un utilisateur
   * @param conversationId ID de la conversation
   * @param userId ID de l'utilisateur qui arrête de taper
   */
  stopTyping(conversationId: string, userId: string): void {
    this.updateTypingStatus(conversationId, userId, false);
  }

  /**
   * Met à jour le statut de frappe dans Firebase
   * @param conversationId ID de la conversation
   * @param userId ID de l'utilisateur
   * @param isTyping Statut de frappe
   */
  private updateTypingStatus(conversationId: string, userId: string, isTyping: boolean): void {
    const typingData: TypingIndicator = {
      userId,
      isTyping,
      lastTyped: Date.now()
    };

    this.api.patch(`typing-indicators/${conversationId}`, userId, typingData).subscribe({
      error: (error) => console.error('[MessageService] Error updating typing status:', error)
    });
  }

  /**
   * Écoute les changements de statut de frappe pour une conversation
   * @param conversationId ID de la conversation à surveiller
   * @returns Observable des indicateurs de frappe
   */
  watchTypingIndicators(conversationId: string): Observable<TypingIndicator[]> {
    // Vérifier si un subject existe déjà pour cette conversation
    if (!this.typingSubjects.has(conversationId)) {
      this.typingSubjects.set(conversationId, new Subject<TypingIndicator[]>());
    }

    const subject = this.typingSubjects.get(conversationId)!;

    // S'abonner aux changements Firebase en utilisant get() avec polling
    // Note: FirebaseService n'a pas de méthode watch(), on utilise get() périodiquement
    const pollInterval = setInterval(() => {
      this.api.get(`typing-indicators/${conversationId}`).subscribe({
        next: (data: any) => {
          const indicators = this.parseTypingData(data);
          subject.next(indicators);
        },
        error: (error: any) => console.error('[MessageService] Error watching typing indicators:', error)
      });
    }, 1000); // Polling toutes les secondes

    // Nettoyer l'intervalle quand l'observable est unsubscribed
    return subject.asObservable().pipe(distinctUntilChanged());
  }

  /**
   * Vérifie si un autre utilisateur est en train de taper
   * @param conversationId ID de la conversation
   * @param currentUserId ID de l'utilisateur courant
   * @returns Observable<boolean> - true si quelqu'un d'autre tape
   */
  isOtherUserTyping(conversationId: string, currentUserId: string): Observable<boolean> {
    return this.watchTypingIndicators(conversationId).pipe(
      switchMap(indicators => {
        const otherUsers = indicators.filter(ind => ind.userId !== currentUserId);
        const isAnyoneTyping = otherUsers.some(ind => ind.isTyping && this.isRecent(ind.lastTyped));
        return [isAnyoneTyping];
      })
    );
  }

  // ┌─────────────────────────────────────────────────────────────┐
  // │  TYPING INDICATORS - UTILITAIRES                             │
  // └─────────────────────────────────────────────────────────────┘

  /**
   * Parse les données Firebase en TypingIndicator[]
   * @param data Données brutes de Firebase
   * @returns Tableau de TypingIndicator
   */
  private parseTypingData(data: any): TypingIndicator[] {
    if (!data) return [];
    
    return Object.entries(data).map(([userId, indicator]: [string, any]) => ({
      userId,
      isTyping: indicator?.isTyping || false,
      lastTyped: indicator?.lastTyped || 0
    }));
  }

  /**
   * Vérifie si l'activité de frappe est récente (moins de 5 secondes)
   * @param lastTyped Timestamp de la dernière activité
   * @returns true si l'activité est récente
   */
  private isRecent(lastTyped: number): boolean {
    return Date.now() - lastTyped < 5000;
  }

  /**
   * Nettoie les anciens indicateurs de frappe (optionnel - peut être appelé périodiquement)
   * Supprime les indicateurs inactifs depuis plus de 5 secondes
   */
  cleanupOldTypingIndicators(): void {
    this.api.get('typing-indicators').subscribe({
      next: (conversations: any) => {
        Object.entries(conversations).forEach(([conversationId, data]: [string, any]) => {
          const cleanedData = this.cleanConversationTypingData(data);
          if (Object.keys(cleanedData).length === 0) {
            // Supprimer la conversation si aucun indicateur actif
            this.api.delete('typing-indicators', conversationId).subscribe();
          } else {
            // Mettre à jour avec les données nettoyées
            this.api.patch('typing-indicators', conversationId, cleanedData).subscribe();
          }
        });
      },
      error: (error) => console.error('[MessageService] Error during typing cleanup:', error)
    });
  }

  /**
   * Nettoie les données d'une conversation en supprimant les anciens indicateurs
   * @param data Données de la conversation
   * @returns Données nettoyées
   */
  private cleanConversationTypingData(data: any): any {
    const cleaned: any = {};
    
    Object.entries(data).forEach(([userId, indicator]: [string, any]) => {
      if (this.isRecent(indicator?.lastTyped || 0)) {
        cleaned[userId] = {
          ...indicator,
          isTyping: false // Réinitialiser le statut de frappe
        };
      }
    });
    
    return cleaned;
  }

  // ┌─────────────────────────────────────────────────────────────┐
  // │  ONLINE PRESENCE MANAGEMENT                                │
  // └─────────────────────────────────────────────────────────────┘

  /**
   * Définit l'utilisateur courant comme en ligne
   * @param userId ID de l'utilisateur à mettre en ligne
   */
  setUserOnline(userId: string): void {
    this.api.setUserOnline(userId).subscribe({
      error: (error) => console.error('[MessageService] setUserOnline error:', error)
    });
  }

  /**
   * Définit l'utilisateur courant comme hors ligne
   * @param userId ID de l'utilisateur à mettre hors ligne
   */
  setUserOffline(userId: string): void {
    this.api.setUserOffline(userId).subscribe({
      error: (error) => console.error('[MessageService] setUserOffline error:', error)
    });
  }

  /**
   * Écoute le statut en ligne d'un utilisateur
   * @param userId ID de l'utilisateur à surveiller
   * @returns Observable du statut en ligne
   */
  watchOnlineStatus(userId: string): Observable<{ isOnline: boolean; lastSeen: any }> {
    return this.api.watchOnlineStatus(userId).pipe(
      tap(status => {
        // Mettre à jour le cache local
        const currentStatus = this.onlineStatusSubject.getValue();
        const updatedStatus = new Map(currentStatus);
        updatedStatus.set(userId, status);
        this.onlineStatusSubject.next(updatedStatus);
      })
    );
  }

  /**
   * Récupère le statut en ligne actuel d'un utilisateur
   * @param userId ID de l'utilisateur
   * @returns Statut en ligne actuel
   */
  getOnlineStatus(userId: string): { isOnline: boolean; lastSeen: any } {
    const status = this.onlineStatusSubject.getValue().get(userId);
    return status || { isOnline: false, lastSeen: null };
  }

  /**
   * Vérifie si un utilisateur est en ligne
   * @param userId ID de l'utilisateur
   * @returns true si l'utilisateur est en ligne
   */
  isUserOnline(userId: string): boolean {
    return this.getOnlineStatus(userId).isOnline;
  }

  /**
   * @deprecated Utiliser startTyping() et stopTyping() à la place
   * Envoie le statut de frappe d'un utilisateur (ancienne méthode)
   */
  sendTypingStatus(conversationId: string, receiverId: string, isTyping: boolean): void {
    console.warn('[MessageService] sendTypingStatus is deprecated, use startTyping/stopTyping instead');
    
    // Mettre à jour le cache local pour compatibilité
    const currentStatus = this.typingStatusSubject.getValue();
    const key = `${conversationId}_${receiverId}`;
    const updatedStatus = new Map(currentStatus);
    updatedStatus.set(key, isTyping);
    this.typingStatusSubject.next(updatedStatus);

    // Utiliser la nouvelle méthode
    this.updateTypingStatus(conversationId, receiverId, isTyping);
  }

  /**
   * @deprecated Utiliser isOtherUserTyping() à la place
   * Vérifie si un utilisateur est en train de taper dans une conversation
   */
  isUserTyping(conversationId: string, userId: string): boolean {
    console.warn('[MessageService] isUserTyping is deprecated, use isOtherUserTyping instead');
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
   * Upload un fichier et retourne l'URL
   * @param file Fichier à uploader
   * @param fieldName Nom du champ pour le stockage
   * @returns Observable avec l'URL du fichier uploadé
   */
  uploadFile(file: File, fieldName: string, conversationId: string): Observable<{ url: string; fileName: string }> {
    return this.api.upload(`storage/chat/${conversationId} `, file, fieldName).pipe(
      map((result: any) => ({
        url: result.url,
        fileName: result.data?.fileName || file.name
      })),
      catchError(error => {
        console.error('[MessageService] uploadFile error:', error);
        return throwError(() => error);
      })
    );
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
