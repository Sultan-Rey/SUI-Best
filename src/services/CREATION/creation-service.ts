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
  private readonly challengeResource = 'challenges';
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

  // Dans creation-service.ts

// ...

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

createChallengeWithCoverImage(
  coverImage: File,
  challengeData: Omit<Challenge, 'id' | 'created_at' | 'is_active' | 'cover_image_url'>,
  progressCallback?: (progress: number) => void
): Observable<Challenge> {
  return new Observable(observer => {
    this.api.upload<{ file: { path: string } }>(
      this.uploadResource,
      coverImage,  // Envoyer directement le fichier
      'file',      // Nom du champ pour le fichier
      !!progressCallback
    ).subscribe({
      next: (event: any) => {
        if (event.type === 1 && event.loaded && event.total && progressCallback) {
          const progress = Math.round((100 * event.loaded) / event.total);
          progressCallback(progress);
        } else if (event.type === 4) {
          // Gestion de la réponse
          let coverImageUrl: string;
          
          if (typeof event.body === 'string') {
            coverImageUrl = event.body;
          } else if (event.body?.file?.path) {
            coverImageUrl = event.body.file.path;
          } else if (event.body?.path) {
            coverImageUrl = event.body.path;
          } else {
            observer.error(new Error('Format de réponse inattendu'));
            return;
          }

          // Créer le challenge avec l'URL de l'image
          const challengeWithImage = {
            ...challengeData,
            cover_image_url: coverImageUrl
          };

          this.api.create<Challenge>(this.challengeResource, challengeWithImage)
            .subscribe({
              next: (challenge) => observer.next(challenge),
              error: (err) => observer.error(err)
            });
        }
      },
      error: (err) => observer.error(err)
    });
  });
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

  /**
   * Récupère le challenge actif avec le plus grand nombre de participants
   * @returns Observable<Challenge | null> Le challenge actif le plus populaire ou null si aucun challenge actif
   */
  getMostPopularActiveChallenge(): Observable<Challenge | null> {
    return this.getActiveChallenges().pipe(
      map(challenges => {
        if (!challenges || challenges.length === 0) {
          return null;
        }
        
        // Trier les challenges par participants_count décroissant
        const sortedChallenges = [...challenges].sort((a, b) => {
          const aCount = a.participants_count || 0;
          const bCount = b.participants_count || 0;
          return bCount - aCount;
        });

        // Retourner le premier élément (celui avec le plus de participants)
        return sortedChallenges[0];
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération du challenge le plus populaire:', error);
        return of(null);
      })
    );
  }

}