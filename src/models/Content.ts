import { Vote } from "./Vote";

export enum ContentType {
  IMAGE = 'image',
  VIDEO = 'video'
}

export enum ContentStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
  DELETED = 'deleted'
}

export enum ContentSource {
  CAMERA = 'camera',
  GALLERY = 'gallery'
}

export interface Content {
  // Identifiants
  id?: string;                // ID unique généré par la base de données
  userId: string;             // ID de l'utilisateur créateur
  challengeId: string;       // Optionnel : ID du défi associé
  commentIds: string[];      // IDs des commentaires associés à ce contenu
  likedIds?:string[];        // IDs des likes associés à ce contenu
  giftIds?:string[];         // IDs des donateurs associés à ce contenu
  votersList?:Vote[];      // Models des votes associés à ce contenu

  // Métadonnées du contenu
  description?: string;       // Description optionnelle
  username?:string;            // Nom d'utilisateur du post
  tags?: string[];            // Mots-clés pour la recherche
  cadrage: 'default' | 'fit'; // cadrage de l'image 
  isPublic: boolean;          // Visibilité publique/privée
  allowDownloads: boolean;    // Autoriser le téléchargement
  allowComments: boolean;     // Autoriser les commentaires
  source: ContentSource;      // Source: caméra ou galerie
  isLikedByUser?: boolean;
  isGiftedByUser?:boolean;
  isVotedByUser?:boolean;

  // Fichier média
  fileUrl: string;            // URL du fichier sur le serveur
  thumbnailUrl?: string;      // URL de la miniature (pour les vidéos)
  mimeType: string;           // Type MIME du fichier
  fileSize: number;           // Taille en octets
  duration?: number;          // Durée en secondes (pour les vidéos)
  width?: number;             // Largeur en pixels
  height?: number;            // Hauteur en pixels
  safeUrl?: string;           // URL sécurisée
  
  // Métadonnées système
  status: ContentStatus;      // État de publication
  createdAt: string;          // Date de création (ISO string)
  updatedAt?: string;         // Date de mise à jour (ISO string)

  // Statistiques
  viewCount: number;          // Nombre de vues
  likeCount: number;          // Nombre de likes
  voteCount?: number          // Nombre de votes
  shareCount:number;         // Nombre de partage
  giftCount?:number;          // Nombre de cadeaux
  commentCount: number;       // Nombre de commentaires
  downloadCount: number;      // Nombre de téléchargements
}


interface PostWithUser extends Content {
  username: string;
  isLikedByUser: boolean;
  avatarUrl?: string;
}