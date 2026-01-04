export enum ContentType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  OTHER = 'other'
}

export enum ContentStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
  DELETED = 'deleted'
}

export interface Content {
  // Identifiants
  id?: string; // ID unique de la publication
  userId: string; // ID de l'utilisateur qui a créé la publication
  
  // Contenu principal
  title: string; // Titre de la publication
  description?: string; // Description ou légende
  contentUrl: string; // URL du contenu (image, vidéo, etc.)
  thumbnailUrl?: string; // URL de la miniature (pour les vidéos ou images redimensionnées)
  contentType: ContentType; // Type de contenu (image, vidéo, etc.)
  challengeId?: string; // ID du défi auquel la publication est associée
  challengeName?: string; // Nom du défi (pour affichage)
  isChallengeEntry: boolean; // Si la publication est une participation à un défi

  
  // Métadonnées du fichier
  fileName: string; // Nom original du fichier
  fileSize: number; // Taille du fichier en octets
  mimeType: string; // Type MIME du fichier
  
  // Paramètres de visibilité
  isPublic: boolean; // Si le contenu est public ou privé
  allowComments: boolean; // Si les commentaires sont autorisés
  allowDownloads: boolean; // Si le téléchargement est autorisé
  
  // Données de suivi
  viewCount: number; // Nombre de vues
  likeCount: number; // Nombre de likes
  commentCount: number; // Nombre de commentaires
  downloadCount: number; // Nombre de téléchargements
  
  // Métadonnées système
  status: ContentStatus; // Statut de la publication
  tags?: string[]; // Étiquettes pour la catégorisation
  categories?: string[]; // Catégories de contenu
  
  // Horodatages
  createdAt: Date | string; // Date de création
  updatedAt?: Date | string; // Date de dernière mise à jour
  publishedAt?: Date | string; // Date de publication
  
  // Relations
  relatedContent?: string[]; // IDs de contenus liés
  
  // Données de localisation
  location?: {
    name?: string; // Nom du lieu
    latitude?: number; // Coordonnée de latitude
    longitude?: number; // Coordonnée de longitude
  };
  
  // Métadonnées personnalisées
  metadata?: Record<string, any>; // Pour les métadonnées personnalisées
}

// Interface pour la création d'un nouveau contenu
export interface CreateContentDto extends Omit<Content, 'id' | 'createdAt' | 'updatedAt' | 'viewCount' | 'likeCount' | 'commentCount' | 'downloadCount'> {
  file: File; // Le fichier à uploader
}

// Interface pour la mise à jour d'un contenu
export interface UpdateContentDto extends Partial<Omit<Content, 'id' | 'userId' | 'createdAt' | 'updatedAt'>> {
  file?: File; // Nouveau fichier optionnel
}

// Interface pour la réponse de l'API après création/mise à jour
export interface ContentResponse {
  success: boolean;
  message: string;
  data?: Content;
  error?: string;
}

// Interface pour la pagination des contenus
export interface ContentPagination {
  items: Content[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Interface pour les filtres de recherche de contenu
export interface ContentFilter {
  userId?: string;
  contentType?: ContentType | ContentType[];
  status?: ContentStatus | ContentStatus[];
  isPublic?: boolean;
  tags?: string[];
  categories?: string[];
  searchTerm?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}