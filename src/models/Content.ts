import { Vote } from "./Vote";

export enum ContentType {
  IMAGE = 'image',
  VIDEO = 'video'
}

export enum ContentCategory{
  POST = 'post',
  ADS_BANNER = 'ads_banner',
  ADS_POST = 'ads_post'
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
  category: ContentCategory;
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
  created_at: string;          // Date de création (ISO string)
  updatedAt?: string;         // Date de mise à jour (ISO string)

  // Statistiques
  viewCount?: number;          // Nombre de vues
  likeCount?: number;          // Nombre de likes
  voteCount?: number          // Nombre de votes
  shareCount?:number;         // Nombre de partage
  giftCount?:number;          // Nombre de cadeaux
  commentCount?: number;       // Nombre de commentaires
  downloadCount?: number;      // Nombre de téléchargements
  score?:number;              // Score temporaire obtenus 
}

export interface Author {
  name: string;
  initials: string;
  color: string; // CSS gradient string
}

export enum ExclusiveContentType {
  VIDEO = 'video',
  BEHIND = 'behind', 
  MASTERCLASS = 'masterclass',
  SERIES = 'series'
}

export enum ExclusiveContentStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived'
}

export interface SeriesInfo {
  seriesId?: string;
  seriesTitle?: string;
  episodeNumber?: number;
  season?: number;
  totalEpisodes?: number;
  isSeries?: boolean;
  nextEpisodeId?: string;
  previousEpisodeId?: string;
}

export interface MediaInfo {
  videoFile?: File;
  thumbnail?: string;
  mimeType: string;
  fileSize: number;
  duration: number;
}

export interface ExclusiveContent {
  // Identifiants système
  id?: string;
  userId: string;
  created_at?: string;
  updatedAt?: string;
  
  // Métadonnées principales
  title: string;
  description: string;
  author: Author;
  type: ExclusiveContentType;
  status: ExclusiveContentStatus;
  
  // Média
  media: MediaInfo;
  
  // Monétisation
  locked: boolean;
  price?: number;
  isLive?: boolean;
  
  // Série (optionnel)
  series?: SeriesInfo;
}

export interface Series {
  id: string;
  title: string;
  description: string;
  author: Author;
  thumbnail: string;
  type: 'masterclass' | 'behind' | 'series';
  totalEpisodes: number;
  totalSeasons?: number;        // Optionnel, pour les séries multi-saisons
  price?: number;               // Prix pour toute la série
  isCompleted?: boolean;        // Indique si la série est terminée
  created_at: string;
  updated_at?: string;
  
  // Statistiques
  viewCount?: number;
  likeCount?: number;
  
  // Métadonnées pour l'affichage
  duration?: number;            // Durée totale estimée en secondes
  episodeIds: string[];         // IDs des épisodes dans l'ordre
}