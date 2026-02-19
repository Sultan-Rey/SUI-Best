import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, EMPTY, map, Observable, of, switchMap, tap, throwError, forkJoin } from 'rxjs';
import { ApiJSON } from '../API/LOCAL/api-json';
import { Content, ContentSource, ContentStatus } from '../../models/Content';
import { Challenge, VoteRule } from '../../models/Challenge';
import { Vote } from '../../models/Vote';
import { ChallengeService } from '../CHALLENGE_SERVICE/challenge-service';
import { ProfileService } from '../PROFILE_SERVICE/profile-service';
import { UserProfile } from '../../models/User';

@Injectable({
  providedIn: 'root',
})
export class CreationService {
  private readonly contentResource = 'contents';
  private readonly uploadResource = 'api/upload'
  
  // BehaviorSubjects isolés par contexte pour éviter le couplage implicite
  private newContentSubject = new BehaviorSubject<Content | null>(null);
  private discoveryFeedSubject = new BehaviorSubject<Content[]>([]);
  private followedFeedSubject = new BehaviorSubject<Content[]>([]);
  
  // Observables publics pour chaque contexte
  newContent$ = this.newContentSubject.asObservable();
  discoveryFeed$ = this.discoveryFeedSubject.asObservable();
  followedFeed$ = this.followedFeedSubject.asObservable();

  constructor(private api: ApiJSON, private challengeService: ChallengeService, private profileService: ProfileService) {}

  // =====================
  // MÉTHODES POUR LES CONTENUS
  // =====================
// Dans la méthode createContentWithFile, après le succès de la création
createContentWithFile(
  file: File,
  metadata: {
    userId: string;
    description?: string;
    isPublic: boolean;
    allowDownloads: boolean;
    allowComments: boolean;
    commentIds:[],
    likedIds:[],
    challengeId?: string;
    cadrage: 'default'| 'fit';
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
    cadrage: metadata.cadrage,  
    viewCount: 0,
    likeCount: 0,
    voteCount: 0,
    shareCount: 0,
    giftCount: 0,
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

  /**
   * Ajoute un vote au tableau votersList d'un contenu
   * @param vote Le vote à ajouter
   * @param voteRule La règle de vote (par défaut UNLIMITED_VOTES)
   * @returns Observable<Content> Le contenu mis à jour
   */
  addVoteToContent(vote: Vote, voteRule: VoteRule = VoteRule.UNLIMITED_VOTES): Observable<Content> {
    return this.api.getById<Content>(this.contentResource, vote.contentId).pipe(
      switchMap(content => {
        const currentVotersList = [...(content.votersList || [])];
        
        if (voteRule === VoteRule.UNLIMITED_VOTES) {
          // Mode UNLIMITED_VOTES: on cherche si l'utilisateur a déjà voté POUR CE CONTENU
          // currentVotersList contient uniquement les votes du contenu actuel (vote.contentId)
          const existingVoteIndex = currentVotersList.findIndex(v => v.userId === vote.userId && v.challengeId === vote.challengeId);
          
          if (existingVoteIndex !== -1) {
            // L'utilisateur a déjà voté, on incrémente le vote existant
            currentVotersList[existingVoteIndex] = {
              ...currentVotersList[existingVoteIndex],
              nbVotes: currentVotersList[existingVoteIndex].nbVotes + vote.nbVotes
            };
          } else {
            // L'utilisateur n'a pas encore voté, on crée un nouveau vote
            const newVote: Vote = {
              ...vote,
              createdAt: vote.createdAt || new Date().toISOString()
            };
            currentVotersList.push(newVote);
          }
        } else {
          // Autres règles de vote ONE_VOTE_PER_USER
          // Pour l'instant, on ajoute simplement le vote
          const newVote: Vote = {
            ...vote,
            createdAt: vote.createdAt || new Date().toISOString()
          };
          currentVotersList.push(newVote);
        }
        
        // Calcul du nombre total de votes
        const totalVotes = currentVotersList.reduce((sum, v) => sum + v.nbVotes, 0);
        
        return this.api.patch<Content>(this.contentResource, vote.contentId, {
          votersList: currentVotersList,
          voteCount: totalVotes
        });
      }),
      catchError(error => {
        console.error('Erreur lors de l\'ajout du vote:', error);
        return throwError(() => new Error('Impossible d\'ajouter le vote. Veuillez réessayer.'));
      })
    );
  }

  /**
   * Vérifie si un utilisateur peut voter pour un contenu dans un challenge spécifique
   * @param userId ID de l'utilisateur
   * @param contentId ID du contenu
   * @param challengeId ID du challenge
   * @returns Observable<{canVote: boolean, voteRule: VoteRule, existingVote?: Vote}>
   */
  canUserVoteForChallenge(userId: string, contentId: string, challengeId: string): Observable<{
    canVote: boolean;
    voteRule: VoteRule;
    existingVote?: Vote;
  }> {
    // Récupérer le challenge pour connaître la règle de vote
    return this.challengeService.getChallengeById(challengeId).pipe(
      switchMap(challenge => {
        const voteRule = challenge.vote_rule as VoteRule;
        
        // Si la règle est UNLIMITED_VOTES, l'utilisateur peut toujours voter
        if (voteRule === VoteRule.UNLIMITED_VOTES) {
          return of({ canVote: true, voteRule });
        }
        
        // Pour ONE_VOTE_PER_USER, on vérifie si l'utilisateur a déjà voté
        return this.api.getById<Content>(this.contentResource, contentId).pipe(
          map(content => {
            const existingVote = (content.votersList || []).find(v => 
              v.userId === userId && v.challengeId === challengeId
            );
            
            return {
              canVote: !existingVote,
              voteRule,
              existingVote
            };
          })
        );
      }),
      catchError(error => {
        console.error('Erreur lors de la vérification du droit de vote:', error);
        return of({ 
          canVote: false, 
          voteRule: VoteRule.ONE_VOTE_PER_USER 
        });
      })
    );
  }

  /**
   * Met à jour le viewCount d'un contenu avec une valeur spécifique
   * @param contentId ID du contenu à mettre à jour
   * @param viewCount Nouvelle valeur du viewCount
   * @returns Observable<Content> avec le viewCount mis à jour
   */
  incrementViewCount(contentId: string, viewCount: number): Observable<Content> {
    // Mettre à jour directement avec la valeur fournie
    return this.api.patch<Content>(this.contentResource, contentId, {
      viewCount: viewCount
    }).pipe(
      tap(updatedContent => {
       // console.log('ViewCount mis à jour avec succès:', updatedContent.id, '->', updatedContent.viewCount);
      }),
      catchError(error => {
        console.error('Erreur lors de la mise à jour du viewCount:', error);
        return throwError(() => new Error('Impossible de mettre à jour le nombre de vues'));
      })
    );
  }

  /**
   * Calcule le nombre total de vues pour un challenge
   * @param challengeId ID du challenge
   * @returns Observable<number> Nombre total de vues
   */
  getTotalViewsForChallenge(challengeId: string): Observable<number> {
    return this.api.filter<Content>(this.contentResource, { challengeId }).pipe(
      map(contents => {
        if (!contents || contents.length === 0) {
          return 0;
        }
        
        return contents.reduce((total: number, content: Content) => {
          const viewCount = content.viewCount;
          const numericViewCount = typeof viewCount === 'string' ? parseFloat(viewCount) : (viewCount || 0);
          return total + (isNaN(numericViewCount) ? 0 : numericViewCount);
        }, 0);
      }),
      catchError(error => {
        console.error('Erreur lors du calcul des vues pour le challenge:', error);
        return of(0);
      })
    );
  }

    /**
   * Calcule le nombre total de votes pour un challenge donné
   * @param challengeId ID du challenge
   * @returns Observable<number> Nombre total de votes
   */
  getTotalVotesForChallenge(challengeId: string): Observable<number> {
    return this.api.filter<Content>(this.contentResource, { challengeId }).pipe(
      map(contents => {
        if (!contents || contents.length === 0) {
          return 0;
        }
        
        return contents.reduce((total: number, content: Content) => {
          const voteCount = content.voteCount;
          const numericVoteCount = typeof voteCount === 'string' ? parseFloat(voteCount) : (voteCount || 0);
          return total + (isNaN(numericVoteCount) ? 0 : numericVoteCount);
        }, 0);
      }),
      catchError(error => {
        console.error('Erreur lors du calcul des votes pour le challenge:', error);
        return of(0);
      })
    );
  }

  /**
   * Calcule le nombre total de partages pour un challenge donné
   * @param challengeId ID du challenge
   * @returns Observable<number> Nombre total de partages
   */
  getTotalSharesForChallenge(challengeId: string): Observable<number> {
    return this.api.filter<Content>(this.contentResource, { challengeId }).pipe(
      map(contents => {
        if (!contents || contents.length === 0) {
          return 0;
        }
        
        return contents.reduce((total: number, content: Content) => {
          const shareCount = content.shareCount;
          const numericShareCount = typeof shareCount === 'string' ? parseFloat(shareCount) : (shareCount || 0);
          return total + (isNaN(numericShareCount) ? 0 : numericShareCount);
        }, 0);
      }),
      catchError(error => {
        console.error('Erreur lors du calcul des partages pour le challenge:', error);
        return of(0);
      })
    );
  }

  /**
   * Récupère la liste des participants à un challenge avec leurs profils
   * @param challengeId ID du challenge
   * @returns Observable<{content: Content, profile: UserProfile}[]> Liste des participants avec leurs contenus et profils
   */
  getChallengeParticipants(challengeId: string): Observable<{content: Content, profile: UserProfile}[]> {
    return this.api.filter<Content>(this.contentResource, { challengeId }).pipe(
      switchMap(contents => {
        if (!contents || contents.length === 0) {
          return of([]);
        }
        
        // Extraire les userId uniques pour éviter les doublons
        const uniqueUserIds = [...new Set(contents.map(content => content.userId))];
        
        // Récupérer les profils pour tous les utilisateurs uniques
        const profileRequests = uniqueUserIds.map(userId => 
          this.profileService.getProfileById(userId).pipe(
            catchError(error => {
              console.warn(`Profil non trouvé pour l'utilisateur ${userId}:`, error);
              return of(null);
            })
          )
        );
        
        // Utiliser forkJoin pour attendre toutes les requêtes
        return forkJoin(profileRequests).pipe(
          map(profiles => {
            // Créer un map des profils par userId
            const profileMap = new Map<string, UserProfile>();
            profiles.forEach((profile, index) => {
              if (profile) {
                profileMap.set(uniqueUserIds[index], profile);
              }
            });
            
            // Retourner les contenus avec leurs profils associés
            return contents.map((content: Content) => ({
              content,
              profile: profileMap.get(content.userId)
            })).filter((item: {content: Content, profile: UserProfile | undefined}) => item.profile !== undefined) as {content: Content, profile: UserProfile}[];
          })
        );
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des participants du challenge:', error);
        return of([]);
      })
    );
  }

  /**
   * Récupère la liste des profils des participants à un challenge (sans doublons)
   * @param challengeId ID du challenge
   * @returns Observable<UserProfile[]> Liste des profils des participants
   */
  getChallengeParticipantProfiles(challengeId: string): Observable<UserProfile[]> {
    return this.api.filter<Content>(this.contentResource, { challengeId }).pipe(
      map(contents => {
        if (!contents || contents.length === 0) {
          return [];
        }
        
        // Extraire les userId uniques
        return [...new Set(contents.map(content => content.userId))];
      }),
      switchMap(userIds => {
        if (userIds.length === 0) {
          return of([]);
        }
        
        // Récupérer les profils pour tous les utilisateurs
        const profileRequests = userIds.map(userId => 
          this.profileService.getProfileById(userId).pipe(
            catchError(error => {
              console.warn(`Profil non trouvé pour l'utilisateur ${userId}:`, error);
              return of(null);
            })
          )
        );
        
        // Utiliser forkJoin pour combiner les résultats
        return forkJoin(profileRequests);
      }),
      map(profiles => {
        // Filtrer les profils null et retourner la liste
        return profiles.filter((profile): profile is UserProfile => profile !== null);
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des profils des participants:', error);
        return of([]);
      })
    );
  }

  /**
   * Récupère les contenus pour le feed Discovery (utilisateurs non suivis)
   * @param currentUserProfile Profil de l'utilisateur courant
   * @param page Le numéro de la page
   * @param limit Le nombre de contenus à charger
   * @param relevanceWeights Poids personnalisés pour les métriques (optionnel)
   * @returns Observable<Content[]>
   */
  getDiscoveryFeedContents(
    currentUserProfile: UserProfile, 
    page: number = 1, 
    limit: number = 10,
    relevanceWeights?: {
      voteWeight?: number;
      viewWeight?: number;
      shareWeight?: number;
      recencyWeight?: number;
    }
  ): Observable<Content[]> {
    // Poids par défaut optimisés pour le discovery : focus sur les vues et la découverte
    const defaultDiscoveryWeights = {
      voteWeight: 2,      // Moins important en discovery
      viewWeight: 5,      // Très important pour découvrir du contenu populaire
      shareWeight: 3,     // Moyennement important
      recencyWeight: 0.3  // Plus de poids sur la nouveauté en discovery
    };

    // Fusionner les poids fournis avec les défauts
    const finalWeights = { ...defaultDiscoveryWeights, ...relevanceWeights };

    return this.getFeedContents(page, limit).pipe(
      map(contents => contents.filter(content => 
        content.userId !== currentUserProfile.id &&
        !currentUserProfile.myFollows.includes(content.userId)
      )),
      map(contents => {
        // Trier par pertinence : combinaison pondérée des métriques d'engagement
        return contents.sort((a, b) => {
          // Calcul du score de pertinence pour chaque contenu
          const scoreA = this.calculateRelevanceScore(a, finalWeights);
          const scoreB = this.calculateRelevanceScore(b, finalWeights);
          
          // Tri par ordre décroissant (score le plus élevé en premier)
          return scoreB - scoreA;
        });
      }),
      tap(contents => {
        // Alimenter le BehaviorSubject spécifique au discovery
        if (page === 1) {
          this.discoveryFeedSubject.next(contents);
        } else {
          const currentContents = this.discoveryFeedSubject.value;
          this.discoveryFeedSubject.next([...currentContents, ...contents]);
        }
      })
    );
  }

  /**
   * Récupère les contenus pour le feed Followed (utilisateurs suivis)
   * @param currentUserProfile Profil de l'utilisateur courant
   * @param page Le numéro de la page
   * @param limit Le nombre de contenus à charger
   * @returns Observable<Content[]>
   */
  getFollowedFeedContents(
    currentUserProfile: UserProfile, 
    page: number = 1, 
    limit: number = 10,
    relevanceWeights?: {
      voteWeight?: number;
      viewWeight?: number;
      shareWeight?: number;
      recencyWeight?: number;
    }
  ): Observable<Content[]> {
    return this.getFeedContents(page, limit).pipe(
      map(contents => contents.filter(content => 
        content.userId === currentUserProfile.id ||
        currentUserProfile.myFollows.includes(content.userId)
      )),
      map(contents => {
            
        // Trier par pertinence : combinaison pondérée des métriques d'engagement
        return contents.sort((a, b) => {
          // Calcul du score de pertinence pour chaque contenu
          const scoreA = this.calculateRelevanceScore(a, relevanceWeights);
          const scoreB = this.calculateRelevanceScore(b, relevanceWeights);
          
          // Tri par ordre décroissant (score le plus élevé en premier)
          return scoreB - scoreA;
        });
      }),
      tap(contents => {
        // Alimenter le BehaviorSubject spécifique au followed
        if (page === 1) {
          this.followedFeedSubject.next(contents);
        } else {
          const currentContents = this.followedFeedSubject.value;
          this.followedFeedSubject.next([...currentContents, ...contents]);
        }
      })
    );
  }

  /**
   * Calcule un score de pertinence basé sur l'engagement
   * @param content Le contenu à évaluer
   * @param weights Poids personnalisés pour les métriques (optionnel)
   * @returns Le score de pertinence (plus élevé = plus pertinent)
   */
  private calculateRelevanceScore(
    content: Content, 
    weights?: {
      voteWeight?: number;
      viewWeight?: number;
      shareWeight?: number;
      recencyWeight?: number;
    }
  ): number {
    const now = new Date().getTime();
    const contentTime = new Date(content.createdAt).getTime();
    const hoursSinceCreation = (now - contentTime) / (1000 * 60 * 60);
    
    // Poids pour chaque métrique avec valeurs par défaut
    const VOTE_WEIGHT = weights?.voteWeight ?? 5;
    const VIEW_WEIGHT = weights?.viewWeight ?? 1;
    const SHARE_WEIGHT = weights?.shareWeight ?? 3;
    const RECENCY_WEIGHT = weights?.recencyWeight ?? 0.1;
    
    // Calcul du score de base avec valeurs par défaut sécurisées
    const voteCount = content.voteCount ?? 0;
    const viewCount = content.viewCount ?? 0;
    const shareCount = content.shareCount ?? 0;
    
    let score = 
      voteCount * VOTE_WEIGHT +
      viewCount * VIEW_WEIGHT +
      shareCount * SHARE_WEIGHT;
    
    // Bonus de récence : les contenus plus récents gagnent des points
    // Mais avec une décroissance exponentielle pour ne pas avantager exagérément les contenus très récents
    const recencyBonus = Math.max(0, 50 - hoursSinceCreation) * RECENCY_WEIGHT;
    score += recencyBonus;
    
    // Bonus pour les contenus avec beaucoup d'engagement relatif
    if (voteCount > 10) score += 10;
    if (shareCount > 5) score += 15;
    if (viewCount > 100) score += 5;
    
    return score;
  }

  /**
   * Met à jour le challengeId d'un contenu existant
   * @param content Le contenu à mettre à jour avec le nouveau challengeId
   * @returns Observable<Content> Le contenu mis à jour
   */
  updateContentChallengeId(content: Content): Observable<Content> {
    if (!content.id) {
      return throwError(() => new Error('Content ID is required for update'));
    }

    return this.api.patch<Content>(this.contentResource, content.id, {
      challengeId: content.challengeId
    }).pipe(
      tap(updatedContent => {
       // console.log('ChallengeId du contenu mis à jour avec succès:', updatedContent.id, '->', updatedContent.challengeId);
        
        // Mettre à jour les feeds locaux si le contenu est présent
        this.updateLocalContentInFeeds(updatedContent);
      }),
      catchError(error => {
        console.error('Erreur lors de la mise à jour du challengeId du contenu:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Met à jour localement le contenu dans les feeds après une modification
   * @param updatedContent Le contenu mis à jour
   */
  private updateLocalContentInFeeds(updatedContent: Content): void {
    // Mettre à jour le feed de découverte
    const discoveryFeed = this.discoveryFeedSubject.value;
    const discoveryIndex = discoveryFeed.findIndex(c => c.id === updatedContent.id);
    if (discoveryIndex !== -1) {
      const newDiscoveryFeed = [...discoveryFeed];
      newDiscoveryFeed[discoveryIndex] = updatedContent;
      this.discoveryFeedSubject.next(newDiscoveryFeed);
    }

    // Mettre à jour le feed suivi
    const followedFeed = this.followedFeedSubject.value;
    const followedIndex = followedFeed.findIndex(c => c.id === updatedContent.id);
    if (followedIndex !== -1) {
      const newFollowedFeed = [...followedFeed];
      newFollowedFeed[followedIndex] = updatedContent;
      this.followedFeedSubject.next(newFollowedFeed);
    }

    // Mettre à jour le nouveau contenu si c'est le même
    if (this.newContentSubject.value?.id === updatedContent.id) {
      this.newContentSubject.next(updatedContent);
    }
  }
}