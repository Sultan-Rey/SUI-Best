// src/app/services/PROFILE_SERVICE/profile.service.ts
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ApiJSON} from '../API/LOCAL/api-json';
import { UserProfile } from '../../models/User';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private resource = 'profiles';

  constructor(private api: ApiJSON) {}

  
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
    return this.api.update<UserProfile>(this.resource, id, updates);
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

}