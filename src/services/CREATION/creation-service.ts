import { Injectable } from '@angular/core';
import { catchError, Observable, switchMap, throwError } from 'rxjs';
import { ApiJSON } from '../API/LOCAL/api-json';
import { Content, ContentSource, ContentStatus } from '../../models/Content';
import { Challenge } from '../../models/Challenge';

@Injectable({
  providedIn: 'root',
})
export class CreationService {
  private readonly contentResource = 'contents';
  private readonly challengeResource = 'challenges';
  private readonly uploadResource = 'api/upload'

  constructor(private api: ApiJSON) {}

  // =====================
  // MÉTHODES POUR LES CONTENUS
  // =====================

  createContentWithFile(
  file: File,
  metadata: {
    title: string;
    description?: string;
    isPublic: boolean;
    allowDownloads: boolean;
    allowComments: boolean;
    challengeId?: string;
    source: ContentSource;
  },
  progressCallback?: (progress: number) => void
): Observable<Content> {
  // 1. Upload du fichier avec suivi de progression
  return this.api.upload<{ file: { path: string } }>(
    this.uploadResource, 
    file, 
    'file',
    !!progressCallback // Active le reportProgress uniquement si un callback est fourni
  ).pipe(
    switchMap((event: any) => {
      // Si c'est un événement de progression
      if (event.type) {
        if (progressCallback && event.loaded !== undefined && event.total) {
          const progress = Math.round((100 * event.loaded) / event.total);
          progressCallback(progress);
        }
        // On ignore les événements de progression dans le switchMap
        return new Observable<never>(() => {});
      }

      // Si c'est la réponse finale
      const uploadResponse = event.body || event;
      
      // 2. Création du contenu avec les métadonnées
      const contentData: Omit<Content, 'id'> = {
        ...metadata,
        userId: 'current-user-id',
        fileUrl: uploadResponse.file.path,
        mimeType: file.type,
        fileSize: file.size,
        status: ContentStatus.PUBLISHED,
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        downloadCount: 0,
        createdAt: new Date().toISOString(),
        tags: this.extractTags(metadata.description || '')
      };

      // 3. Enregistrement des métadonnées en base
      return this.api.create<Content>(this.contentResource, contentData);
    }),
    catchError(error => {
      console.error('Erreur lors de la création du contenu:', error);
      return throwError(() => error);
    })
  );
}
  // Extrait les tags du texte (ex: #tag)
  private extractTags(text: string): string[] {
    const tagRegex = /#(\w+)/g;
    const matches = text.match(tagRegex) || [];
    return matches.map(tag => tag.substring(1)); // Enlève le #
  }

  /**
 * Récupère les contenus d'un utilisateur spécifique
 * @param userId ID de l'utilisateur
 * @returns Observable<Content[]> Liste des contenus de l'utilisateur triés par date de création décroissante
 */
getUserContents(userId: string): Observable<Content[]> {
  return this.api.getAll<Content>(this.contentResource, {
    'user_id': userId,
    '_sort': 'created_at:desc'
  });
}

getContentById(id: string): Observable<Content> {
  return this.api.getById<Content>(this.contentResource, id);
}
  // =====================
  // MÉTHODES POUR LES DÉFIS
  // =====================

  createChallenge(challengeData: Omit<Challenge, 'id' | 'created_at' | 'is_active'>): Observable<Challenge> {
    const challenge = {
      ...challengeData,
      created_at: new Date(Date.now()),
      is_active: true
    };
    return this.api.create<Challenge>(this.challengeResource, challenge);
  }

  /**
 * Récupère la liste des défis actifs
 * @returns Observable<Challenge[]> Liste des défis actifs
 */
getActiveChallenges(): Observable<Challenge[]> {
  return this.api.getAll<Challenge>(this.challengeResource, {
    is_active: 'true',
    _sort: 'created_at',
    _order: 'desc'
  });
}

  // =====================
  // MÉTHODES UTILITAIRES
  // =====================

  /**
 * Désactive un défi
 * @param id ID du défi à désactiver
 * @returns Observable<Challenge> Le défi mis à jour
 */
updateChallenge(id: string, updates: Partial<Challenge>): Observable<Challenge> {
  return this.api.update<Challenge>(this.challengeResource, id, updates);
}

  /**
   * Récupère un défi par son ID
   * @param id ID du défi à récupérer
   * @returns Observable<Challenge> Le défi correspondant à l'ID
   */
  getChallengeById(id: string): Observable<Challenge> {
    return this.api.getById<Challenge>(this.challengeResource, id);
  }

  /**
   * Récupère tous les défis créés par un utilisateur spécifique
   * @param creatorId ID du créateur des défis
   * @returns Observable<Challenge[]> Liste des défis créés par l'utilisateur
   */
  getChallengesByCreator(creatorId: string): Observable<Challenge[]> {
    return this.api.getAll<Challenge>(this.challengeResource, {
      creator_id: creatorId,
      _sort: 'created_at',
      _order: 'desc'
    });
  }

}