// src/models/Comment.ts
export interface Comment {
  id?: string;                // ID unique du commentaire
  contentId: string;          // ID du contenu associé
  userId: string;             // ID de l'auteur du commentaire
  userAvatar?: string;        // URL de l'avatar de l'auteur
  username: string;           // Nom d'utilisateur de l'auteur
  text: string;               // Texte du commentaire
  createdAt: string;          // Date de création (ISO string)
  updatedAt?: string;         // Date de mise à jour (ISO string)
  likes: number;              // Nombre de likes du commentaire
  likedBy?: string[];        // Tableau pour suivre qui a aimé
  isLiked?: boolean;          // Si l'utilisateur actuel a aimé ce commentaire
  parentId?: string;          // ID du commentaire parent (pour les réponses)
  replies?: Comment[];        // Réponses directes au commentaire (objets complets)
  replyCount?: number;        // Nombre total de réponses
  isAggregated?: boolean;     // Si ce commentaire est une agrégation de plusieurs commentaires du même utilisateur
  aggregatedComments?: Comment[]; // Commentaires agrégés (si isAggregated = true)
  userCommentCount?: number;   // Nombre de commentaires de cet utilisateur dans ce fil
}