import { Injectable } from '@angular/core';
import { ProfileService } from '../Service_profile/profile-service';
import { Observable, of, throwError } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { UserProfile } from '../../models/User';
import { LevelReward } from '../../models/LevelReward';
import { getRewardsForUserType } from '../../interfaces/levelReward.data';

@Injectable({
  providedIn: 'root',
})
export class RewardService {
  constructor(private profileService: ProfileService) {}

  // ─── GET METHODS ───────────────────────────────────────────

  /**
   * Récupère les récompenses de niveau pour un utilisateur
   * @param userId ID de l'utilisateur
   * @returns Observable avec les récompenses de niveau
   */
  getUserRewards(userId: string): Observable<LevelReward[]> {
    return this.profileService.getProfileById(userId).pipe(
      map(profile => {
        if (!profile) {
          throw new Error('Profil non trouvé');
        }
        return profile.level_rewards || [];
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des récompenses:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Récupère les récompenses calculées basées sur le niveau et XP actuels
   * @param userId ID de l'utilisateur
   * @returns Observable avec les récompenses mises à jour
   */
  getCalculatedRewards(userId: string): Observable<LevelReward[]> {
    return this.profileService.getProfileById(userId).pipe(
      map(profile => {
        if (!profile) {
          throw new Error('Profil non trouvé');
        }
        
        const userType = profile.type;
        const currentLevel = profile.level;
        const userXp = this.calculateUserXp(profile);
        
        return getRewardsForUserType(userType, currentLevel, userXp);
      }),
      catchError(error => {
        console.error('Erreur lors du calcul des récompenses:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Récupère une récompense spécifique par niveau
   * @param userId ID de l'utilisateur
   * @param level Niveau de la récompense
   * @returns Observable avec la récompense spécifique
   */
  getRewardByLevel(userId: string, level: number): Observable<LevelReward | null> {
    return this.getUserRewards(userId).pipe(
      map(rewards => rewards.find(reward => reward.level === level) || null)
    );
  }

  /**
   * Récupère les récompenses débloquées (unlocked)
   * @param userId ID de l'utilisateur
   * @returns Observable avec les récompenses débloquées
   */
  getUnlockedRewards(userId: string): Observable<LevelReward[]> {
    return this.getUserRewards(userId).pipe(
      map(rewards => rewards.filter(reward => reward.unlocked))
    );
  }

  /**
   * Récupère les récompenses collectées
   * @param userId ID de l'utilisateur
   * @returns Observable avec les récompenses collectées
   */
  getCollectedRewards(userId: string): Observable<LevelReward[]> {
    return this.getUserRewards(userId).pipe(
      map(rewards => rewards.filter(reward => reward.collected))
    );
  }

  /**
   * Récupère les récompenses disponibles à la collection (collectible)
   * @param userId ID de l'utilisateur
   * @returns Observable avec les récompenses collectables
   */
  getCollectibleRewards(userId: string): Observable<LevelReward[]> {
    return this.getUserRewards(userId).pipe(
      map(rewards => rewards.filter(reward => reward.collectible))
    );
  }

  /**
   * Récupère la récompense actuelle (current level)
   * @param userId ID de l'utilisateur
   * @returns Observable avec la récompense actuelle
   */
  getCurrentReward(userId: string): Observable<LevelReward | null> {
    return this.getUserRewards(userId).pipe(
      map(rewards => rewards.find(reward => reward.current) || null)
    );
  }

  // ─── UPDATE METHODS ───────────────────────────────────────────

  /**
   * Met à jour les récompenses de niveau d'un utilisateur
   * @param userId ID de l'utilisateur
   * @param rewards Nouvelle liste de récompenses
   * @returns Observable avec le profil mis à jour
   */
  updateUserRewards(userId: string, rewards: LevelReward[]): Observable<UserProfile> {
    return this.profileService.updateProfile(userId, { level_rewards: rewards });
  }

  /**
   * Collecte une récompense spécifique
   * @param userId ID de l'utilisateur
   * @param level Niveau de la récompense à collecter
   * @returns Observable avec le profil mis à jour
   */
  collectReward(userId: string, level: number): Observable<UserProfile> {
    return this.getUserRewards(userId).pipe(
      switchMap(rewards => {
        const updatedRewards = rewards.map(reward => {
          if (reward.level === level && reward.collectible) {
            return { ...reward, collected: true, collectible: false };
          }
          return reward;
        });
        
        return this.updateUserRewards(userId, updatedRewards);
      })
    );
  }

  /**
   * Met à jour les récompenses basées sur le nouveau niveau et XP
   * @param userId ID de l'utilisateur
   * @param newLevel Nouveau niveau
   * @param newXp Nouveau XP total
   * @returns Observable avec le profil mis à jour
   */
  updateRewardsForLevel(userId: string, newLevel: number, newXp: number): Observable<UserProfile> {
    return this.profileService.getProfileById(userId).pipe(
      switchMap(profile => {
        if (!profile) {
          throw new Error('Profil non trouvé');
        }
        
        const userType = profile.type;
        const calculatedRewards = getRewardsForUserType(userType, newLevel, newXp);
        
        return this.updateUserRewards(userId, calculatedRewards);
      })
    );
  }

  /**
   * Marque une récompense comme collectible (disponible à la collection)
   * @param userId ID de l'utilisateur
   * @param level Niveau de la récompense
   * @returns Observable avec le profil mis à jour
   */
  markRewardAsCollectible(userId: string, level: number): Observable<UserProfile> {
    return this.getUserRewards(userId).pipe(
      switchMap(rewards => {
        const updatedRewards = rewards.map(reward => {
          if (reward.level === level && reward.unlocked && !reward.collected) {
            return { ...reward, collectible: true };
          }
          return reward;
        });
        
        return this.updateUserRewards(userId, updatedRewards);
      })
    );
  }

  // ─── UTILITY METHODS ───────────────────────────────────────────

  /**
   * Calcule l'XP total d'un utilisateur basé sur son niveau et pourcentage
   * @param profile Profil utilisateur
   * @returns XP total calculé
   */
  private calculateUserXp(profile: UserProfile): number {
    const levelThresholds = [0, 100, 2000, 5000, 12000, 25000, 50000, 100000];
    
    if (profile.level <= 0 || profile.level > levelThresholds.length - 1) {
      return 0;
    }
    
    const currentLevelThreshold = levelThresholds[profile.level - 1] || 0;
    const nextLevelThreshold = levelThresholds[profile.level] || currentLevelThreshold;
    const levelRange = nextLevelThreshold - currentLevelThreshold;
    
    return currentLevelThreshold + (profile.xpPercent / 100) * levelRange;
  }

  /**
   * Vérifie si une récompense est disponible à la collection
   * @param reward Récompense à vérifier
   * @returns true si la récompense est collectible
   */
  isRewardCollectible(reward: LevelReward): boolean {
    return reward.unlocked && !reward.collected && !!reward.collectible;
  }

  /**
   * Compte le nombre de récompenses collectées
   * @param userId ID de l'utilisateur
   * @returns Observable avec le nombre de récompenses collectées
   */
  getCollectedRewardsCount(userId: string): Observable<number> {
    return this.getCollectedRewards(userId).pipe(
      map(rewards => rewards.length)
    );
  }

  /**
   * Compte le nombre de récompenses disponibles à la collection
   * @param userId ID de l'utilisateur
   * @returns Observable avec le nombre de récompenses collectables
   */
  getCollectibleRewardsCount(userId: string): Observable<number> {
    return this.getCollectibleRewards(userId).pipe(
      map(rewards => rewards.length)
    );
  }

   /**
   * Compte le nombre d'utilisateur ayant collecté cette récompense
   * @param name nom de la recompense
   * @param xp nombre de XP pour obtenir la recompense
   * @returns Observable avec le nombre de récompenses collectables
   */
  getCollectedRewardsTotalCount(name: string, xp: number): Observable<number> {
    return this.profileService.getProfiles().pipe(
      map(profiles => {
        if (!profiles) return 0;
        
        return profiles.filter(profile => {
          if (!profile.level_rewards) return false;
          
          // Chercher la récompense spécifique dans les récompenses de l'utilisateur
          const targetReward = profile.level_rewards.find(reward => 
            reward.name === name && 
            reward.xpRequired === xp
          );
          
          // Vérifier si la récompense existe et a été collectée
          return targetReward?.collected === true;
        }).length;
      }),
      catchError(error => {
        console.error('Erreur lors du comptage des récompenses collectées:', error);
        return of(0);
      })
    );
  }

  /**
   * Calcule la progression vers la prochaine récompense
   * @param userId ID de l'utilisateur
   * @returns Observable avec la progression en pourcentage
   */
  getProgressToNextReward(userId: string): Observable<number> {
    return this.profileService.getProfileById(userId).pipe(
      map(profile => {
        if (!profile) {
          throw new Error('Profil non trouvé');
        }
        
        return profile.xpPercent;
      })
    );
  }

  /**
   * Réinitialise toutes les récompenses (débloque tout)
   * @param userId ID de l'utilisateur
   * @returns Observable avec le profil mis à jour
   */
  resetAllRewards(userId: string): Observable<UserProfile> {
    return this.getUserRewards(userId).pipe(
      switchMap(rewards => {
        const resetRewards = rewards.map(reward => ({
          ...reward,
          unlocked: true,
          collected: false,
          collectible: true
        }));
        
        return this.updateUserRewards(userId, resetRewards);
      })
    );
  }

  /**
   * Vérifie si l'utilisateur a des récompenses à collecter
   * @param userId ID de l'utilisateur
   * @returns Observable avec true s'il y a des récompenses à collecter
   */
  hasCollectibleRewards(userId: string): Observable<boolean> {
    return this.getCollectibleRewardsCount(userId).pipe(
      map(count => count > 0)
    );
  }
}
