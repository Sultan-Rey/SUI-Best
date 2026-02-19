// ================================================================
//  Conversation.ts — Modèles du module messagerie
//
//  Architecture :
//    Conversation  →  entité propre avec tableau d'IDs participants
//    Message       →  unité atomique avec statut et IDs sender/receiver
// ================================================================

// ----------------------------------------------------------------
//  Types de base
// ----------------------------------------------------------------

/** Statut d'un message */
export type MessageStatus = 'pending' | 'sent' | 'read';

/** Statut d'ouverture de conversation */
export type ConversationStatus = 'open' | 'closed';

// ----------------------------------------------------------------
//  Conversation
//  Entité propre contenant les participants et les messages
// ----------------------------------------------------------------
export interface Conversation {
  id: string;
  
  /** Tableau des IDs des participants - ne change jamais */
  participantIds: string[];
  
  /** Date de création - ne change jamais */
  createdAt: Date;
  
  /** Statut d'ouverture - variable */
  status: ConversationStatus;
  
  /** Messages de la conversation */
  messages: Message[];
  
  /** Si la conversation est en sourdine */
  isMuted?: boolean;
  
  /** Nombre de messages non lus */
  unreadCount?: number;
  
  /** Informations sur le dernier message */
  lastMessage?: string;
  lastMessageTime?: Date;
  lastMessageType?: 'text' | 'image' | 'video' | 'voice' | 'file';
  
  /** Stories */
  hasActiveStory?: boolean;
  storySeen?: boolean;
  
  /** Informations sur le participant (pour compatibilité avec le template) */
  participant?: {
    id: string;
    username: string;
    avatar?: string;
    isVerified: boolean;
    userType?: 'fan' | 'artist' | 'creator' | 'admin';
    stats?: number;
    isOnline?: boolean;
    isTyping?: boolean;
    plan?: string;
  };
}

// ----------------------------------------------------------------
//  Message
//  Unité atomique d'échange dans une conversation
// ----------------------------------------------------------------
export interface Message {
  id: string;
  conversationId?: string;
  senderId: string;
  receiverId: string;
  content: string;
  
  /** Statut du message */
  status: MessageStatus;
  
  /** Date de création */
  createdAt: Date;
  
  /** Valeurs optionnelles côté client */
  senderName?: string;

  /** Si le message a ete efface */
  isDeleted?:boolean;
  
}

// ----------------------------------------------------------------
//  CreateConversationRequest
//  Payload pour créer une conversation avec son premier message
// ----------------------------------------------------------------
export interface CreateConversationRequest {
  participantIds: string[];
  messages: [{
    id: string;
    receiverId: string;
    content: string;
    status: MessageStatus;
    createdAt: string;
  }];
}

// ----------------------------------------------------------------
//  CreateMessageRequest
//  Payload pour créer un message dans une conversation existante
// ----------------------------------------------------------------
export interface CreateMessageRequest {
  conversationId: string;
  receiverId: string;
  content: string;
  createdAt: string;
}

// ----------------------------------------------------------------
//  Méthode utilitaire pour obtenir le senderName
//  À partir d'un ID utilisateur, renvoie le nom de l'expéditeur
// ----------------------------------------------------------------
export class ConversationUtils {
  /**
   * Obtient le nom de l'expéditeur à partir de l'ID
   * @param senderId - ID de l'expéditeur
   * @param currentUserId - ID de l'utilisateur courant
   * @param participantNames - Map des noms des participants par ID
   * @returns Le nom de l'expéditeur
   */
  static getSenderName(
    senderId: string,
    currentUserId: string,
    participantNames: Map<string, string>
  ): string {
    // Si l'expéditeur est l'utilisateur courant
    if (senderId === currentUserId) {
      return "Moi";
    }
    
    // Sinon, chercher dans les participants
    const senderName = participantNames.get(senderId);
    return senderName || "Utilisateur inconnu";
  }
  
  /**
   * Détermine l'ID du receiver à partir des participants de la conversation
   * @param conversationId - ID de la conversation
   * @param participantIds - Tableau des IDs des participants
   * @param currentUserId - ID de l'utilisateur courant
   * @returns L'ID du receiver
   */
  static getReceiverId(
    participantIds: string[],
    currentUserId: string
  ): string {
    return participantIds.find(id => id !== currentUserId) || currentUserId;
  }
}
