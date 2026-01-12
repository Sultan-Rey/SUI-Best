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
  likedBy?: string[];  // Nouveau tableau pour suivre qui a aimé
  isLiked?: boolean;          // Si l'utilisateur actuel a aimé ce commentaire
  parentId?: string;          // ID du commentaire parent (pour les réponses)
  replies?: string[];         // IDs des réponses à ce commentaire
}