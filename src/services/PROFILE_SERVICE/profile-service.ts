// src/app/services/PROFILE_SERVICE/profile.service.ts
import { Injectable } from '@angular/core';
import { Observable, of, EMPTY, throwError, BehaviorSubject } from 'rxjs';
import { map, switchMap, debounceTime, distinctUntilChanged, startWith, catchError } from 'rxjs/operators';
import { ApiJSON} from '../API/LOCAL/api-json';
import { UserProfile } from '../../models/User';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private resource = 'profiles';
  private readonly uploadResource = 'api/upload';
  private searchQuery$ = new BehaviorSubject<string>('');
  private searchResults$ = new BehaviorSubject<UserProfile[]>([]);

  /**
   * Configure le flux de recherche en temps réel
   */
  private setupSearchStream(): void {
    this.searchQuery$.pipe(
      debounceTime(300), // Attendre 300ms après la dernière frappe
      distinctUntilChanged(), // Éviter les recherches dupliquées
      switchMap(query => this.performSearch(query))
    ).subscribe(results => {
      this.searchResults$.next(results);
    });
  }

  constructor(private api: ApiJSON) {
    this.setupSearchStream();
  }

  
  /* =====================
     CREATE
     ===================== */
  createProfile(profile: Omit<UserProfile, 'id'>): Observable<UserProfile> {
    return this.api.create<UserProfile>(this.resource, profile);
  }

  /* =====================
     READ
     ===================== */
  getProfiles(): Observable<UserProfile[]> {
    return this.api.getAll<UserProfile>(this.resource);
  }

  getProfileById(id: string): Observable<UserProfile> {
    return this.api.getById<UserProfile>(this.resource, id);
  }



  /* =====================
     UPDATE
     ===================== */
  updateProfile(id: string, updates: Partial<UserProfile>): Observable<UserProfile> {
    return this.api.patch<UserProfile>(this.resource, id, updates);
  }

  updateProfileWithAvatar(
    file: File,
    userProfileId: string,
    updatingData : {
        avatar: string;
        displayName: string,
        bio: string,
        contact: string,
      },
    progressCallback?: (progress: number) => void
  ): Observable<UserProfile> {
  
   
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
    updatingData.avatar = uploadResponse.file.path;
    
    // Return the API call that patch the profile
    return this.api.patch<UserProfile>(this.resource, userProfileId, updatingData);
  }),
      catchError(error => {
        console.error('Erreur lors de la mise a jour du profile:', error);
        return throwError(() => error);
      })
    );
  }
  /* =====================
     UPLOAD AVATAR
     ===================== */
  uploadAvatar(
    profileId: string, 
    avatarDataUrl: string, 
    progressCallback?: (progress: number) => void
  ): Observable<{ url: string }> {
    // Convertir dataURL en File
    return new Observable<{ url: string }>((observer) => {
      try {
        // Extraire le type MIME et les données base64
        const matches = avatarDataUrl.match(/^data:(.+?);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          observer.error(new Error('Format d\'image invalide'));
          return;
        }

        const mimeType = matches[1];
        const base64Data = matches[2];
        
        // Convertir base64 en blob
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });

        // Créer un fichier avec un nom approprié
        const fileName = `avatar_${profileId}_${Date.now()}.${mimeType.split('/')[1] || 'jpg'}`;
        const file = new File([blob], fileName, { type: mimeType });

        // Utiliser la méthode upload de l'API avec gestion de progression
        this.api.upload<{ url: string }>(
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
            return of(uploadResponse);
          }),
          catchError(error => {
            console.error('Erreur lors de l\'upload de l\'avatar:', error);
            return throwError(() => error);
          })
        ).subscribe({
          next: (result) => {
            observer.next(result);
            observer.complete();
          },
          error: (error) => {
            observer.error(error);
          }
        });
      } catch (error) {
        observer.error(error);
      }
    });
  }

  /* =====================
     DELETE OLD AVATAR
     ===================== */
  deleteOldAvatar(oldAvatarUrl: string): Observable<void> {
    if (!oldAvatarUrl || oldAvatarUrl.includes('avatar-default.png')) {
      return of(void 0); // Ne rien faire si c'est l'avatar par défaut
    }

    // Pour l'instant, on loggue la demande de suppression
    // La suppression de fichiers devra être implémentée côté backend avec un endpoint dédié
    console.log('Demande de suppression d\'ancien avatar:', oldAvatarUrl);
    
    // TODO: Implémenter un endpoint dédié pour la suppression de fichiers
    // return this.http.delete(`${this.api.BASE_URL}/upload/avatars/${fileName}`);
    
    // Pour l'instant, on retourne un succès pour ne pas bloquer le flux
    return of(void 0);
  }

  /* =====================
     DELETE
     ===================== */
  deleteProfile(id: string): Observable<void> {
    return this.api.delete(this.resource, id);
  }

  /* ====================
     FOLLOW/UNFOLLOW
     ==================== */
  // Dans profile.service.ts

async followProfile(userId: string, profileIdToFollow: string): Promise<any> {
  try {
    // 1. Récupérer l'utilisateur qui suit
    const user = await this.api.getById<UserProfile>(this.resource, userId).toPromise();
    if (!user) throw new Error('Utilisateur non trouvé');

    // 2. Récupérer le profil à suivre
    const profileToFollow = await this.api.getById<UserProfile>(this.resource, profileIdToFollow).toPromise();
    if (!profileToFollow) throw new Error('Profil à suivre non trouvé');

    const myFollows = Array.isArray(user.myFollows) ? user.myFollows : [];
    
    if (!myFollows.includes(profileIdToFollow)) {
      // 3. Mettre à jour la liste des follows de l'utilisateur
      user.myFollows = [...myFollows, profileIdToFollow];
      
      // 4. Incrémenter le compteur de followers du profil suivi
      profileToFollow.stats = profileToFollow.stats || { fans: 0, following: 0 };
      profileToFollow.stats.fans = (profileToFollow.stats.fans || 0) + 1;

      // 5. Mettre à jour les deux profils en parallèle
      await Promise.all([
        this.api.update(this.resource, userId, user).toPromise(),
        this.api.update(this.resource, profileIdToFollow, profileToFollow).toPromise()
      ]);

      return { user, profile: profileToFollow };
    }
    return { user, profile: profileToFollow };
  } catch (error) {
    console.error('Erreur followProfile:', error);
    throw error;
  }
}

async unfollowProfile(userId: string, profileIdToUnfollow: string): Promise<any> {
  try {
    // 1. Récupérer l'utilisateur qui se désabonne
    const user = await this.api.getById<UserProfile>(this.resource, userId).toPromise();
    if (!user) throw new Error('Utilisateur non trouvé');

    // 2. Récupérer le profil à ne plus suivre
    const profileToUnfollow = await this.api.getById<UserProfile>(this.resource, profileIdToUnfollow).toPromise();
    if (!profileToUnfollow) throw new Error('Profil à ne plus suivre non trouvé');

    const myFollows = Array.isArray(user.myFollows) ? user.myFollows : [];
    user.myFollows = myFollows.filter(id => id !== profileIdToUnfollow);
    
    // 3. Décrémenter le compteur de followers du profil
    if (profileToUnfollow.stats?.fans && profileToUnfollow.stats.fans > 0) {
      profileToUnfollow.stats.fans -= 1;
    }

    // 4. Mettre à jour les deux profils en parallèle
    await Promise.all([
      this.api.update(this.resource, userId, user).toPromise(),
      this.api.update(this.resource, profileIdToUnfollow, profileToUnfollow).toPromise()
    ]);

    return { user, profile: profileToUnfollow };
  } catch (error) {
    console.error('Erreur unfollowProfile:', error);
    throw error;
  }
}

async blackListProfile(userId: string, profileIdToBlackList: string): Promise<any> {
  try {
    // 1. Récupérer l'utilisateur qui blacklist
    const user = await this.api.getById<UserProfile>(this.resource, userId).toPromise();
    if (!user) throw new Error('Utilisateur non trouvé');

    // 2. Récupérer le profil à blacklister
    const profileToBlackList = await this.api.getById<UserProfile>(this.resource, profileIdToBlackList).toPromise();
    if (!profileToBlackList) throw new Error('Profil à blacklister non trouvé');

    const myBlackList = Array.isArray(user.myBlackList) ? user.myBlackList : [];
    
    if (!myBlackList.includes(profileIdToBlackList)) {
      // 3. Ajouter le profil à la blacklist de l'utilisateur
      user.myBlackList = [...myBlackList, profileIdToBlackList];

      // 4. Si l'utilisateur suivait ce profil, le retirer des follows
      if (user.myFollows && user.myFollows.includes(profileIdToBlackList)) {
        user.myFollows = user.myFollows.filter(id => id !== profileIdToBlackList);
        
        // 5. Décrémenter le compteur de followers du profil blacklisté
        if (profileToBlackList.stats?.fans && profileToBlackList.stats.fans > 0) {
          profileToBlackList.stats.fans -= 1;
        }
      }

      // 6. Mettre à jour les deux profils en parallèle
      await Promise.all([
        this.api.update(this.resource, userId, user).toPromise(),
        this.api.update(this.resource, profileIdToBlackList, profileToBlackList).toPromise()
      ]);

      return { user, profile: profileToBlackList };
    }
    return { user, profile: profileToBlackList };
  } catch (error) {
    console.error('Erreur blackListProfile:', error);
    throw error;
  }
}

async unblackListProfile(userId: string, profileIdToUnblackList: string): Promise<any> {
  try {
    // 1. Récupérer l'utilisateur qui unblacklist
    const user = await this.api.getById<UserProfile>(this.resource, userId).toPromise();
    if (!user) throw new Error('Utilisateur non trouvé');

    // 2. Récupérer le profil à unblacklist
    const profileToUnblackList = await this.api.getById<UserProfile>(this.resource, profileIdToUnblackList).toPromise();
    if (!profileToUnblackList) throw new Error('Profil à unblacklist non trouvé');

    const myBlackList = Array.isArray(user.myBlackList) ? user.myBlackList : [];
    user.myBlackList = myBlackList.filter(id => id !== profileIdToUnblackList);

    // 3. Mettre à jour l'utilisateur
    await this.api.update(this.resource, userId, user).toPromise();

    return { user, profile: profileToUnblackList };
  } catch (error) {
    console.error('Erreur unblackListProfile:', error);
    throw error;
  }
}

  /**
   * Récupère les 12 profils d'artistes avec le plus grand nombre de fans
   * @returns Un Observable contenant un tableau des 12 profils d'artistes les plus populaires
   */
  getTopArtists(limit: number = 12): Observable<UserProfile[]> {
    return this.api.getAll<UserProfile>(this.resource).pipe(
      map(profiles => {
        // Filtrer pour ne garder que les artistes
        const artists = profiles.filter(profile => profile.userType === 'artist');
        
        // Trier par nombre de fans décroissant
        return artists.sort((a, b) => {
          const fansA = a.stats?.fans || 0;
          const fansB = b.stats?.fans || 0;
          return fansB - fansA;
        })
        // Prendre les 'limit' premiers
        .slice(0, limit);
      })
    );
  }

  /**
   * Récupère les profils de créateurs avec le plus grand nombre de publications
   * @param limit Nombre maximum de créateurs à retourner (par défaut 12)
   * @returns Un Observable contenant un tableau des profils de créateurs les plus actifs
   */
  getTopCreators(limit: number = 12): Observable<UserProfile[]> {
    return this.api.getAll<UserProfile>(this.resource).pipe(
      map(profiles => {
        // Filtrer pour ne garder que les créateurs
        const creators = profiles.filter(profile => profile.userType === 'creator');
        
        // Trier par nombre de publications décroissant
        return creators.sort((a, b) => {
          const postsA = a.stats?.posts || 0;
          const postsB = b.stats?.posts || 0;
          return postsB - postsA;
        })
        // Prendre les 'limit' premiers
        .slice(0, limit);
      })
    );
  }

  /**
 * Récupère les meilleurs fans basés sur plusieurs critères
 * @param limit Nombre maximum de fans à retourner (par défaut 10)
 * @returns Un Observable contenant un tableau des profils des meilleurs fans
 */
getTopFans(limit: number = 10): Observable<UserProfile[]> {
  return this.api.getAll<UserProfile>(this.resource).pipe(
    map(profiles => {
      // Filtrer pour ne garder que les fans (pas les artistes)
      const fans = profiles.filter(profile => 
        profile.userType === 'fan' || !profile.userType
      );

      // Trier selon plusieurs critères
      return fans
        .map(profile => {
          // Calculer un score basé sur plusieurs facteurs
          const followsScore = (profile.myFollows?.length || 0) * 1.5; // Poids plus important pour les follows
          const votesScore = (profile.stats?.votes || 0) * 1.2; // Poids moyen pour les votes
          const starsScore = (profile.stats?.stars || 0); // Poids normal pour les étoiles
          
          // Score total pondéré
          const totalScore = followsScore + votesScore + starsScore;
          
          return {
            ...profile,
            _score: totalScore
          };
        })
        // Trier par score décroissant
        .sort((a, b) => b._score - a._score)
        // Prendre les 'limit' premiers
        .slice(0, limit)
        // Retirer le score temporaire
        .map(({ _score, ...profile }) => profile);
    })
  );
}

  isFollowing(userId: string, profileId: string): Observable<boolean> {
    return this.api.getById<UserProfile>(this.resource, userId).pipe(
      map(user => {
        // Assurez-vous que myFollows est un tableau
      const myFollows = Array.isArray(user.myFollows) ? user.myFollows : [];
      return myFollows.includes(profileId);
    })
  );
}

  /* ====================
     SEARCH PROFILES
     ==================== */

  /**
   * Effectue la recherche de profils selon le critère fourni
   * @param query Terme de recherche (username, displayName, bio, etc.)
   * @returns Observable avec les résultats de la recherche
   */
  private performSearch(query: string): Observable<UserProfile[]> {
    if (!query || query.trim().length < 2) {
      return of([]);
    }

    const searchTerm = query.toLowerCase().trim();

    return this.getProfiles().pipe(
      map(profiles => {
        return profiles.filter(profile => {
          // Recherche dans le username
          const usernameMatch = profile.username?.toLowerCase().includes(searchTerm);
          
          // Recherche dans le displayName
          const displayNameMatch = profile.displayName?.toLowerCase().includes(searchTerm);
          
          // Recherche dans la bio
          const bioMatch = profile.bio?.toLowerCase().includes(searchTerm);
          
          // Recherche dans le type d'utilisateur
          const userTypeMatch = profile.userType?.toLowerCase().includes(searchTerm);
          
          // Recherche dans l'école
          const schoolMatch = profile.school?.toLowerCase().includes(searchTerm);
          
          // Retourner true si au moins un critère correspond
          return usernameMatch || displayNameMatch || bioMatch || userTypeMatch || schoolMatch;
        });
      })
    );
  }

  /**
   * Met à jour la requête de recherche (appelé depuis les composants)
   * @param query Nouveau terme de recherche
   */
  updateSearchQuery(query: string): void {
    this.searchQuery$.next(query);
  }

  /**
   * Observable pour écouter les résultats de recherche en temps réel
   * @returns Observable avec les résultats de recherche actuels
   */
  getSearchResults(): Observable<UserProfile[]> {
    return this.searchResults$.asObservable();
  }

  /**
   * Observable pour écouter la requête de recherche actuelle
   * @returns Observable avec la requête de recherche actuelle
   */
  getSearchQuery(): Observable<string> {
    return this.searchQuery$.asObservable();
  }

  /**
   * Recherche avancée avec filtres multiples
   * @param criteria Critères de recherche avancés
   * @returns Observable avec les résultats filtrés
   */
  searchProfiles(criteria: {
    query?: string;
    userType?: 'artist' | 'creator' | 'fan';
    minFans?: number;
    hasPosts?: boolean;
    limit?: number;
  }): Observable<UserProfile[]> {
    return this.getProfiles().pipe(
      map(profiles => {
        let filteredProfiles = profiles;

        // Filtrer par terme de recherche
        if (criteria.query && criteria.query.trim().length >= 2) {
          const searchTerm = criteria.query.toLowerCase().trim();
          filteredProfiles = filteredProfiles.filter(profile => 
            profile.username?.toLowerCase().includes(searchTerm) ||
            profile.displayName?.toLowerCase().includes(searchTerm) ||
            profile.bio?.toLowerCase().includes(searchTerm)
          );
        }

        // Filtrer par type d'utilisateur
        if (criteria.userType) {
          filteredProfiles = filteredProfiles.filter(profile => 
            profile.userType === criteria.userType
          );
        }

        // Filtrer par nombre minimum de fans
        if (criteria.minFans && criteria.minFans > 0) {
          filteredProfiles = filteredProfiles.filter(profile => 
            (profile.stats?.fans || 0) >= criteria.minFans!
          );
        }

        // Filtrer par présence de publications
        if (criteria.hasPosts) {
          filteredProfiles = filteredProfiles.filter(profile => 
            (profile.stats?.posts || 0) > 0
          );
        }

        // Limiter les résultats
        if (criteria.limit && criteria.limit > 0) {
          filteredProfiles = filteredProfiles.slice(0, criteria.limit);
        }

        return filteredProfiles;
      })
    );
  }

  /**
   * Suggestions de recherche populaires
   * @param limit Nombre de suggestions à retourner
   * @returns Observable avec les suggestions de profils populaires
   */
  getSearchSuggestions(limit: number = 5): Observable<UserProfile[]> {
    return this.getProfiles().pipe(
      map(profiles => {
        // Trier par popularité (fans + posts) et retourner les plus populaires
        return profiles
          .map(profile => ({
            ...profile,
            popularityScore: (profile.stats?.fans || 0) + ((profile.stats?.posts || 0) * 10)
          }))
          .sort((a, b) => b.popularityScore - a.popularityScore)
          .slice(0, limit)
          .map(({ popularityScore, ...profile }) => profile);
      })
    );
  }

  /**
   * Efface les résultats de recherche
   */
  clearSearch(): void {
    this.searchQuery$.next('');
    this.searchResults$.next([]);
  }

}