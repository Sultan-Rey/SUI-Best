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
  challengeId?: string;       // Optionnel : ID du défi associé

  // Métadonnées du contenu
  title: string;              // Titre du contenu
  description?: string;       // Description optionnelle
  tags?: string[];            // Mots-clés pour la recherche
  isPublic: boolean;          // Visibilité publique/privée
  allowDownloads: boolean;    // Autoriser le téléchargement
  allowComments: boolean;     // Autoriser les commentaires
  source: ContentSource;      // Source: caméra ou galerie

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
  commentCount: number;       // Nombre de commentaires
  downloadCount: number;      // Nombre de téléchargements
}