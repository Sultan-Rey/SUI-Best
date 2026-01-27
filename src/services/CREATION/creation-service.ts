import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, EMPTY, map, Observable, of, switchMap, tap, throwError } from 'rxjs';
import { ApiJSON } from '../API/LOCAL/api-json';
import { Content, ContentSource, ContentStatus } from '../../models/Content';
import { Challenge } from '../../models/Challenge';

@Injectable({
  providedIn: 'root',
})
export class CreationService {
  private readonly contentResource = 'contents';
  private readonly uploadResource = 'api/upload'
  private newContentSubject = new BehaviorSubject<Content | null>(null);
newContent$ = this.newContentSubject.asObservable();

  constructor(private api: ApiJSON) {}

  // =====================
  // MÉTHODES POUR LES CONTENUS
  // =====================
// Dans la méthode createContentWithFile, après le succès de la création
createContentWithFile(
  file: File,
  metadata: {
    title: string;
    userId: string;
    description?: string;
    isPublic: boolean;
    allowDownloads: boolean;
    allowComments: boolean;
    commentIds:[],
    likedIds:[],
    challengeId?: string;
    source: ContentSource;
  },
  progressCallback?: (progress: number) => void
): Observable<Content> {

 
 
  return this.api.upload<{ file: { path: string } }>(
    this.uploadResource, 
    file, 
    'file',
    !!progressCallback
  ).pipe(
    switchMap((event: any) => {
  // Handle progress events
  if (event.type) {
    if (progressCallback && event.loaded !== undefined && event.total) {
      const progress = Math.round((100 * event.loaded) / event.total);
      progressCallback(progress);
    }
    // Return an empty observable that doesn't emit any values
    return EMPTY;
  }

  // Handle the final response
  const uploadResponse = event.body || event;
  
  // Create content data
  const contentData: Omit<Content, 'id'> = {
    ...metadata,
    fileUrl: uploadResponse.file.path,
    mimeType: file.type,
    fileSize: file.size,
    status: ContentStatus.PUBLISHED,
    challengeId: metadata.challengeId || '',
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    downloadCount: 0,
    createdAt: new Date().toISOString(),
    tags: this.extractTags(metadata.description || '')
  };

  // Return the API call that creates the content
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
  return this.api.getAll<Content>(this.contentResource).pipe(  // Supprimez les crochets ici
    map((contents: Content[]) => {  // Typez explicitement le paramètre contents
      // Filtre les contenus par userId
      const filteredContents = contents.filter(content => 
        content.userId === userId
      );
      
      // Trie par date de création décroissante
      return filteredContents.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }),
    catchError(error => {
      console.error('Erreur lors de la récupération des contenus:', error);
      return of([]); // Retourne un tableau vide en cas d'erreur
    })
  );
}


getContentById(id: string): Observable<Content> {
  return this.api.getById<Content>(this.contentResource, id);
}

/**
 * Récupère tous les contenus publiés pour le fil d'actualité global
 * @param page Le numéro de la page (commence à 1 ou 0 selon ton API)
 * @param limit Le nombre de contenus à charger par appel
 * @returns Observable<Content[]>
 */
getFeedContents(page: number = 1, limit: number = 10): Observable<Content[]> {
  const params = {
    'status': ContentStatus.PUBLISHED, // Sécurité : on ne prend que le publier
    '_sort': 'createdAt:desc',         // Plus récent en premier
    '_page': page.toString(),          // Pagination
    '_limit': limit.toString()         // Limitation
  };

  return this.api.getAll<Content>(this.contentResource, params).pipe(
    map(contents => contents.map(content => ({
      ...content,
      // Optionnel : on peut forcer la sécurisation de l'URL ici si besoin
      safeUrl: content.fileUrl 
    }))),
    catchError(error => {
      console.error('Erreur lors de la récupération du flux:', error);
      return throwError(() => new Error('Impossible de charger le fil d\'actualité.'));
    })
  );
}

  /**
 * Récupère tous les contenus associés à un défi spécifique
 * @param challengeId L'identifiant du défi
 * @returns Un observable de tableau de contenus
 */
getContentsByChallenge(challengeId: string): Observable<Content[]> {
  return this.api.getAll<Content>(this.contentResource).pipe(
    map((contents: Content[]) => {
      // Filtrer les contenus par challengeId
      const filteredContents = contents.filter(content => 
        content.challengeId === challengeId
      );
      
      // Trier par date de création décroissante
      return filteredContents.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }),
    catchError(error => {
      console.error(`Erreur lors de la récupération des contenus pour le défi ${challengeId}:`, error);
      return of([]); // Retourne un tableau vide en cas d'erreur
    })
  );
}

  /**
   * Ajoute un like à un contenu
   */
 likeContent(contentId: string, userId: string): Observable<Content> {
  console.log('likeContent appelé avec:', { contentId, userId });
  
  return this.api.getById<Content>(this.contentResource, contentId).pipe(
    tap(content => console.log('Contenu récupéré:', content)),
    switchMap(content => {
      const currentLikes = [...(content.likedIds || [])];
      console.log('Likes actuels:', currentLikes);
      
      const userHasLiked = currentLikes.includes(userId);
      console.log('L\'utilisateur a déjà aimé?', userHasLiked);
      
      const updatedLikes = userHasLiked
        ? currentLikes.filter(id => id !== userId)
        : [...currentLikes, userId];
      
      console.log('Nouveaux likes:', updatedLikes);
      
      return this.api.patch<Content>(this.contentResource, contentId, {
        likedIds: updatedLikes,
        likeCount: updatedLikes.length
      }).pipe(
        tap(updatedContent => console.log('Contenu mis à jour avec succès:', updatedContent))
      );
    }),
    catchError(error => {
      console.error('Erreur complète:', {
        error,
        message: error.message,
        status: error.status,
        url: error.url,
        headers: error.headers
      });
      return throwError(() => new Error('Impossible de mettre à jour le like. Veuillez réessayer.'));
    })
  );
}

  /**
   * Retire un like d'un contenu
   */
  unlikeContent(contentId: string, userId: string): Observable<Content> {
    return this.api.getById<Content>(this.contentResource, contentId).pipe(
      switchMap(content => {
        const updatedLikes = (content.likedIds || []).filter(id => id !== userId);
        return this.api.patch<Content>(this.contentResource, contentId, {
          likedIds: updatedLikes,
          likeCount: updatedLikes.length
        });
      }),
      catchError(error => {
        console.error('Erreur lors de la suppression du like:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Vérifie si un utilisateur a aimé un contenu
   */
  hasLikedContent(contentId: string, userId: string): Observable<boolean> {
    return this.api.getById<Content>(this.contentResource, contentId).pipe(
      map(content => (content.likedIds || []).includes(userId)),
      catchError(error => {
        console.error('Erreur lors de la vérification du like:', error);
        return of(false);
      })
    );
  }
 

}