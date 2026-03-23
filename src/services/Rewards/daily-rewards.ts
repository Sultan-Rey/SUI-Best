import { Injectable } from '@angular/core';

export interface RecompenseJournaliere {
  recoltee: boolean;
  disponible: boolean;
}

export interface DonneesUtilisateur {
  recompensesQuotidiennes: {
    jour1: RecompenseJournaliere;
    jour2: RecompenseJournaliere;
    jour3: RecompenseJournaliere;
    jour4: RecompenseJournaliere;
    jour5: RecompenseJournaliere;
  };
  derniereReclamation: string | null;
  debutSemaineCourante: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class DailyRewards {
  
  private readonly CLE_STOCKAGE = 'best_user_rewards';
  
  constructor() {}
  
  /**
   * Initialise l'état des récompenses quotidiennes
   */
  initialiserRecompenses(): {
    recompenses: Record<string, RecompenseJournaliere>;
    indexJourActuel: number;
    estWeekend: boolean;
    peutReclamerAujourdHui: boolean;
  } {
    const aujourdHui = new Date();
    const jourSemaine = aujourdHui.getDay(); // 0 = Dimanche, 6 = Samedi
    
    // Vérifier si c'est le weekend
    const estWeekend = jourSemaine === 0 || jourSemaine === 6;
    
    if (estWeekend) {
      return {
        recompenses: this.getRecompensesParDefaut(),
        indexJourActuel: 0,
        estWeekend: true,
        peutReclamerAujourdHui: false
      };
    }
    
    // Calculer l'index du jour actuel (Lundi=0, Mardi=1, Mercredi=2, Jeudi=3, Vendredi=4)
    const indexJourActuel = jourSemaine === 0 ? 4 : jourSemaine - 1;
    
    return {
      recompenses: this.getRecompensesParDefaut(),
      indexJourActuel,
      estWeekend: false,
      peutReclamerAujourdHui: true
    };
  }
  
  /**
   * Charge le statut des récompenses quotidiennes depuis le localStorage
   */
  async chargerStatutRecompenses(utilisateurId: string): Promise<{
    recompenses: Record<string, RecompenseJournaliere>;
    peutReclamerAujourdHui: boolean;
    indexJourActuel: number;
    estWeekend: boolean;
  }> {
    try {
      const donneesStockees = localStorage.getItem(this.CLE_STOCKAGE);
      
      let donneesRecompenses: any = {};
      if (donneesStockees) {
        try {
          donneesRecompenses = JSON.parse(donneesStockees);
        } catch (erreurParsing) {
          console.error('Erreur parsing localStorage:', erreurParsing);
          donneesRecompenses = {};
        }
      }
      
      // Données spécifiques à cet utilisateur
      const donneesUtilisateur = donneesRecompenses[utilisateurId] || {};
      const recompensesQuotidiennes = donneesUtilisateur.recompensesQuotidiennes || {};
      const derniereReclamation = donneesUtilisateur.derniereReclamation;
      const debutSemaineCourante = donneesUtilisateur.debutSemaineCourante;
      
      // Vérifier si on est dans une nouvelle semaine (pour réinitialiser)
      const aujourdHui = new Date();
      const lundiSemaine = this.getLundiSemaine(aujourdHui);
      const estNouvelleSemaine = debutSemaineCourante !== lundiSemaine.toDateString();
      
      if (estNouvelleSemaine) {
        console.log('Nouvelle semaine détectée, réinitialisation des récompenses quotidiennes');
        await this.reinitialiserRecompensesHebdomadaires(utilisateurId, lundiSemaine);
        return this.initialiserRecompenses();
      }
      
      // Vérifier si on a déjà réclamé aujourd'hui
      const chaineAujourdHui = aujourdHui.toDateString();
      const aReclameAujourdHui = derniereReclamation === chaineAujourdHui;
      
      // Convertir les données en format français
      const recompenses = this.convertirEnFormatFrancais(recompensesQuotidiennes);
      
      // Initialiser l'état
      const etatInitial = this.initialiserRecompenses();
      
      // Mettre à jour l'état des récompenses
      this.mettreAJourEtatRecompenses(recompenses, aReclameAujourdHui, etatInitial.indexJourActuel);
      
      return {
        recompenses,
        peutReclamerAujourdHui: !aReclameAujourdHui && etatInitial.indexJourActuel < 5,
        indexJourActuel: etatInitial.indexJourActuel,
        estWeekend: etatInitial.estWeekend
      };
      
    } catch (error) {
      console.error('Erreur lors du chargement des récompenses quotidiennes:', error);
      return this.initialiserRecompenses();
    }
  }
  
  /**
   * Réclame la récompense quotidienne (100 XP)
   */
  async reclamerRecompenseQuotidienne(utilisateurId: string, indexJour: number): Promise<{
    succes: boolean;
    message: string;
    recompensesMisesAJour?: Record<string, RecompenseJournaliere>;
  }> {
    try {
      const etat = await this.chargerStatutRecompenses(utilisateurId);
      
      if (!etat.peutReclamerAujourdHui || etat.estWeekend) {
        return {
          succes: false,
          message: 'Pas de récompense disponible aujourd\'hui'
        };
      }
      
      const cleJour = `jour${indexJour + 1}`;
      
      // Mettre à jour l'état local
      const recompensesMisesAJour = { ...etat.recompenses };
      recompensesMisesAJour[cleJour] = {
        recoltee: true,
        disponible: false
      };
      
      // Sauvegarder dans localStorage
      this.sauvegarderRecompensesLocalStorage(utilisateurId, cleJour as any, true);
      
      return {
        succes: true,
        message: '+100 XP réclamés avec succès!',
        recompensesMisesAJour
      };
      
    } catch (error) {
      console.error('Erreur lors de la réclamation de la récompense quotidienne:', error);
      return {
        succes: false,
        message: 'Erreur lors de la réclamation'
      };
    }
  }
  
  /**
   * Obtient le message approprié selon le jour
   */
  getMessageRecompense(peutReclamerAujourdHui: boolean, estWeekend: boolean): string {
    if (estWeekend) {
      return 'Profitez de votre weekend! Revenez lundi.';
    }
    
    if (peutReclamerAujourdHui) {
      return 'Check in each day to multiply!';
    }
    
    return 'Revenez demain pour votre prochaine récompense!';
  }
  
  /**
   * Retourne le texte du bouton selon l'état
   */
  getTexteBouton(peutReclamerAujourdHui: boolean, estWeekend: boolean): string {
    if (estWeekend) {
      return 'Weekend';
    }
    
    if (peutReclamerAujourdHui) {
      return 'Claim';
    }
    
    return 'Claimed';
  }
  
  /**
   * Retourne le tableau des jours pour le template
   */
  getTableauJours(): string[] {
    return ['jour1', 'jour2', 'jour3', 'jour4', 'jour5'];
  }
  
  // Méthodes privées
  
  /**
   * Obtient les récompenses par défaut
   */
  private getRecompensesParDefaut(): Record<string, RecompenseJournaliere> {
    return {
      jour1: { recoltee: false, disponible: false },
      jour2: { recoltee: false, disponible: false },
      jour3: { recoltee: false, disponible: false },
      jour4: { recoltee: false, disponible: false },
      jour5: { recoltee: false, disponible: false }
    };
  }
  
  /**
   * Convertit les données en format français
   */
  private convertirEnFormatFrancais(donnees: any): Record<string, RecompenseJournaliere> {
    const recompenses = this.getRecompensesParDefaut();
    
    // Conversion day1 -> jour1, day2 -> jour2, etc.
    if (donnees.day1) recompenses['jour1'] = { recoltee: donnees.day1.collected, disponible: donnees.day1.available };
    if (donnees.day2) recompenses['jour2'] = { recoltee: donnees.day2.collected, disponible: donnees.day2.available };
    if (donnees.day3) recompenses['jour3'] = { recoltee: donnees.day3.collected, disponible: donnees.day3.available };
    if (donnees.day4) recompenses['jour4'] = { recoltee: donnees.day4.collected, disponible: donnees.day4.available };
    if (donnees.day5) recompenses['jour5'] = { recoltee: donnees.day5.collected, disponible: donnees.day5.available };
    
    return recompenses;
  }
  
  /**
   * Met à jour l'état des récompenses
   */
  private mettreAJourEtatRecompenses(
    recompenses: Record<string, RecompenseJournaliere>, 
    aReclameAujourdHui: boolean, 
    indexJourActuel: number
  ): void {
    // Réinitialiser les jours précédents comme récoltés
    for (let i = 0; i < 5; i++) {
      const cleJour = `jour${i + 1}`;
      recompenses[cleJour] = {
        recoltee: i < indexJourActuel || (i === indexJourActuel && aReclameAujourdHui),
        disponible: i === indexJourActuel && !aReclameAujourdHui
      };
    }
  }
  
  /**
   * Réinitialise les récompenses pour une nouvelle semaine dans localStorage
   */
  private async reinitialiserRecompensesHebdomadaires(utilisateurId: string, lundi: Date): Promise<void> {
    try {
      const donneesStockees = localStorage.getItem(this.CLE_STOCKAGE);
      let donneesRecompenses: any = {};
      
      if (donneesStockees) {
        try {
          donneesRecompenses = JSON.parse(donneesStockees);
        } catch (erreurParsing) {
          console.error('Erreur parsing localStorage lors reset:', erreurParsing);
          donneesRecompenses = {};
        }
      }
      
      // Réinitialiser toutes les récompenses de la semaine
      const recompensesReinitialisees = {
        day1: { collected: false, available: false },
        day2: { collected: false, available: false },
        day3: { collected: false, available: false },
        day4: { collected: false, available: false },
        day5: { collected: false, available: false }
      };
      
      // Mettre à jour les données utilisateur
      donneesRecompenses[utilisateurId] = {
        recompensesQuotidiennes: recompensesReinitialisees,
        derniereReclamation: null,
        debutSemaineCourante: lundi.toDateString()
      };
      
      // Sauvegarder dans localStorage
      localStorage.setItem(this.CLE_STOCKAGE, JSON.stringify(donneesRecompenses));
      
      console.log('Récompenses hebdomadaires réinitialisées dans localStorage');
      
    } catch (error) {
      console.error('Erreur lors de la réinitialisation des récompenses:', error);
    }
  }
  
  /**
   * Sauvegarde l'état des récompenses dans localStorage
   */
  private sauvegarderRecompensesLocalStorage(
    utilisateurId: string, 
    cleJour: string, 
    recoltee: boolean
  ): void {
    try {
      const donneesStockees = localStorage.getItem(this.CLE_STOCKAGE);
      let donneesRecompenses: any = {};
      
      if (donneesStockees) {
        try {
          donneesRecompenses = JSON.parse(donneesStockees);
        } catch (erreurParsing) {
          console.error('Erreur parsing localStorage lors save:', erreurParsing);
          donneesRecompenses = {};
        }
      }
      
      // S'assurer que l'utilisateur existe dans les données
      if (!donneesRecompenses[utilisateurId]) {
        donneesRecompenses[utilisateurId] = {
          recompensesQuotidiennes: {},
          derniereReclamation: null,
          debutSemaineCourante: this.getLundiSemaine(new Date()).toDateString()
        };
      }
      
      // Convertir la clé française en anglaise pour la compatibilité
      const cleAnglaise = cleJour.replace('jour', 'day');
      
      // Mettre à jour le jour spécifique
      donneesRecompenses[utilisateurId].recompensesQuotidiennes[cleAnglaise] = {
        collected: recoltee,
        available: !recoltee // Si c'est récolté, ce n'est plus disponible
      };
      
      // Mettre à jour la date de dernière réclamation
      if (recoltee) {
        donneesRecompenses[utilisateurId].derniereReclamation = new Date().toDateString();
      }
      
      // Sauvegarder
      localStorage.setItem(this.CLE_STOCKAGE, JSON.stringify(donneesRecompenses));
      
      console.log('Récompenses sauvegardées dans localStorage pour:', { utilisateurId, cleJour, recoltee });
      
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des récompenses:', error);
    }
  }
  
  /**
   * Obtient le lundi de la semaine courante
   */
  private getLundiSemaine(date: Date): Date {
    const d = new Date(date);
    const jour = d.getDay();
    const diff = d.getDate() - jour + (jour === 0 ? -6 : 1); // Ajuster pour que lundi soit le jour 0
    return new Date(d.setDate(diff));
  }
}
