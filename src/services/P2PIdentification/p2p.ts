import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular'; // ou votre service de storage
import { MarkedProfile, MarkedStats } from 'src/models/User';

@Injectable({
  providedIn: 'root',
})
export class P2p {
   private readonly CONFIDENCE_STORAGE_KEY = 'best_confidence_marker';
  
  // Structure du tableau stocké
  // [
  //   { id: 'user_123', status: 'confirmed', timestamp: Date, userName: string },
  //   { id: 'user_456', status: 'declined', timestamp: Date, userName: string }
  // ]

  constructor(private storage: Storage) {
    this.initStorage();
  }

  private async initStorage(): Promise<void> {
    await this.storage.create();
  }

  /**
   * Vérifie si un profil a déjà été marqué (confirmé ou décliné)
   * @param userId - L'ID de l'utilisateur à vérifier
   * @returns boolean - true si l'utilisateur a déjà été marqué, false sinon
   */
  async isMarkedProfile(userId: string): Promise<boolean> {
    try {
      const markedProfiles = await this.getMarkedProfiles();
      return markedProfiles.some(profile => profile.id === userId);
    } catch (error) {
      console.error('Erreur lors de la vérification du profil marqué:', error);
      return false;
    }
  }

  /**
   * Vérifie si un profil a été confirmé spécifiquement
   * @param userId - L'ID de l'utilisateur à vérifier
   * @returns boolean - true si confirmé, false sinon
   */
  async isConfirmedProfile(userId: string): Promise<boolean> {
    try {
      const markedProfiles = await this.getMarkedProfiles();
      const profile = markedProfiles.find(p => p.id === userId);
      return profile?.status === 'confirmed';
    } catch (error) {
      console.error('Erreur lors de la vérification du profil confirmé:', error);
      return false;
    }
  }

  /**
   * Vérifie si un profil a été décliné spécifiquement
   * @param userId - L'ID de l'utilisateur à vérifier
   * @returns boolean - true si décliné, false sinon
   */
  async isDeclinedProfile(userId: string): Promise<boolean> {
    try {
      const markedProfiles = await this.getMarkedProfiles();
      const profile = markedProfiles.find(p => p.id === userId);
      return profile?.status === 'declined';
    } catch (error) {
      console.error('Erreur lors de la vérification du profil décliné:', error);
      return false;
    }
  }

  /**
   * Récupère tous les profils marqués (confirmés et déclinés)
   * @returns Array des profils marqués
   */
  async getMarkedProfiles(): Promise<MarkedProfile[]> {
    try {
      const profiles = await this.storage.get(this.CONFIDENCE_STORAGE_KEY);
      return profiles ? JSON.parse(profiles) : [];
    } catch (error) {
      console.error('Erreur lors de la récupération des profils marqués:', error);
      return [];
    }
  }

  /**
   * Marque un profil comme confirmé
   * @param userId - ID de l'utilisateur
   * @param userName - Nom de l'utilisateur (optionnel)
   */
  async markProfileAsConfirmed(userId: string, userName?: string): Promise<void> {
    await this.markProfile(userId, 'confirmed', userName);
  }

  /**
   * Marque un profil comme décliné
   * @param userId - ID de l'utilisateur
   * @param userName - Nom de l'utilisateur (optionnel)
   */
  async markProfileAsDeclined(userId: string, userName?: string): Promise<void> {
    await this.markProfile(userId, 'declined', userName);
  }

  /**
   * Méthode privée pour marquer un profil
   */
  private async markProfile(userId: string, status: 'confirmed' | 'declined', userName?: string): Promise<void> {
    try {
      const markedProfiles = await this.getMarkedProfiles();
      
      // Vérifier si le profil existe déjà
      const existingIndex = markedProfiles.findIndex(p => p.id === userId);
      
      const profileEntry: MarkedProfile = {
        id: userId,
        status,
        userName: userName || '',
        timestamp: Date.now(),
        updatedAt: new Date().toISOString()
      };
      
      if (existingIndex !== -1) {
        // Mettre à jour le profil existant
        markedProfiles[existingIndex] = {
          ...markedProfiles[existingIndex],
          status,
          userName: userName || markedProfiles[existingIndex].userName,
          updatedAt: new Date().toISOString(),
          timestamp: Date.now()
        };
      } else {
        // Ajouter nouveau profil
        markedProfiles.push(profileEntry);
      }
      
      await this.storage.set(this.CONFIDENCE_STORAGE_KEY, JSON.stringify(markedProfiles));
      
      console.log(`Profil ${userId} marqué comme ${status}`);
    } catch (error) {
      console.error(`Erreur lors du marquage du profil ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Supprime un profil marqué (pour permettre de re-demander)
   * @param userId - ID de l'utilisateur à supprimer
   */
  async removeMarkedProfile(userId: string): Promise<void> {
    try {
      const markedProfiles = await this.getMarkedProfiles();
      const filteredProfiles = markedProfiles.filter(p => p.id !== userId);
      await this.storage.set(this.CONFIDENCE_STORAGE_KEY, JSON.stringify(filteredProfiles));
      
      console.log(`Profil ${userId} supprimé des marquages`);
    } catch (error) {
      console.error(`Erreur lors de la suppression du profil ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Récupère les statistiques des profils marqués
   */
  async getMarkedProfilesStats(): Promise<MarkedStats> {
    const profiles = await this.getMarkedProfiles();
    const confirmed = profiles.filter(p => p.status === 'confirmed').length;
    const declined = profiles.filter(p => p.status === 'declined').length;
    
    return {
      total: profiles.length,
      confirmed,
      declined,
      lastUpdated: profiles.length > 0 ? Math.max(...profiles.map(p => p.timestamp)) : null
    };
  }

  /**
   * Nettoie les anciennes entrées (plus de 30 jours)
   */
  async cleanupOldEntries(daysThreshold: number = 30): Promise<number> {
    try {
      const markedProfiles = await this.getMarkedProfiles();
      const now = Date.now();
      const threshold = daysThreshold * 24 * 60 * 60 * 1000;
      
      const filteredProfiles = markedProfiles.filter(profile => {
        return (now - profile.timestamp) < threshold;
      });
      
      const removedCount = markedProfiles.length - filteredProfiles.length;
      
      if (removedCount > 0) {
        await this.storage.set(this.CONFIDENCE_STORAGE_KEY, JSON.stringify(filteredProfiles));
        console.log(`${removedCount} anciennes entrées nettoyées`);
      }
      
      return removedCount;
    } catch (error) {
      console.error('Erreur lors du nettoyage:', error);
      return 0;
    }
  }
}

