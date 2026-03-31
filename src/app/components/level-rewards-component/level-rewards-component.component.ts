import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ModalController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { LevelReward } from 'src/models/LevelReward';
import { RewardService } from 'src/services/Rewards/reward-service';
import { Auth } from 'src/services/AUTH/auth';
import { NotificationManagerService } from 'src/services/Notification/notification-manager-service';

import {
  star,
  closeOutline,
  giftOutline,
  lockClosedOutline,
  checkmarkCircle,
  checkmarkCircleOutline,
  timeOutline
} from 'ionicons/icons';
import {
  IonContent,
  IonIcon,
} from '@ionic/angular/standalone';
 


@Component({
  selector: 'app-level-rewards-component',
  templateUrl: './level-rewards-component.component.html',
  styleUrls: ['./level-rewards-component.component.scss'],
  imports: [CommonModule, DecimalPipe, IonContent, IonIcon]
})
export class LevelRewardsComponent implements OnInit {
 
  // ── Inputs ────────────────────────────────────────────────
 
  /** XP actuel de l'utilisateur (valeur brute, ex: 350) */
  @Input() userXp: number = 0;
 
  /** Type de l'utilisateur — détermine quelle grille de rewards charger */
  @Input() userType: 'artist' | 'creator' | 'fan' = 'artist';
 
  /** Niveau actuel de l'utilisateur */
  @Input() currentLevel: number = 1;
 
  /**
   * Liste des récompenses filtrées : débloquées + 2 prochains à venir
   */
  @Input() rewards: LevelReward[] = [];
  
  /**
   * Récompenses calculées internellement
   */
  processedRewards: LevelReward[] = [];
 
  // ── State ─────────────────────────────────────────────────
 
  /** XP requis pour le prochain niveau */
  xpRequiredForNext: number = 0;
 
  /** Pourcentage de la ligne verticale colorée (du bas jusqu'au niveau actuel) */
  filledLinePercent: number = 0;
 
  constructor(
    private modalCtrl: ModalController,
    private cdr: ChangeDetectorRef,
    private rewardService: RewardService,
    private authService: Auth,
    private notificationManager: NotificationManagerService
  ) {
    addIcons({ star, closeOutline, giftOutline, lockClosedOutline, checkmarkCircle, checkmarkCircleOutline, timeOutline });
  }
 
  ngOnInit(): void {
    // Forcer le cast numérique — userProfile.level peut arriver en string depuis l'API
    this.currentLevel = Number(this.currentLevel) || 1;
    this.userXp       = Number(this.userXp)       || 0;

    this.initRewards();
    this.resolveNextXp();
    this.processRewardsDisplay();
    this.computeFilledLine();
  }

  // ── Init ──────────────────────────────────────────────────

  private async initRewards(): Promise<void> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser?.id) {
        console.warn('Utilisateur non connecté pour initialiser les récompenses de niveau');
        return;
      }

      // Utiliser le RewardService pour obtenir les récompenses calculées
      const userRewards = await this.rewardService.getCalculatedRewards(currentUser.id).toPromise();
      
      if (userRewards && userRewards.length > 0) {
        this.rewards = userRewards;
      } else {
        // Fallback : utiliser les récompenses passées en input si le service ne retourne rien
        console.warn('Aucune récompense trouvée via le service, utilisation des données input');
      }

      // Recalculer les flags dynamiques pour s'assurer de la cohérence
      this.rewards = this.rewards.map((r: LevelReward) => {
        const lvl = Number(r.level);
        return {
          ...r,
          unlocked:    lvl < this.currentLevel,
          current:     lvl === this.currentLevel,
          collectible: lvl === this.currentLevel && !r.collected,
        };
      });
      
    } catch (error) {
      console.error('Erreur lors de l\'initialisation des récompenses:', error);
      // En cas d'erreur, continuer avec les récompenses existantes ou vides
    }
  }

  /**
   * Construit la liste affichée (tri décroissant = niveau max en haut) :
   *   - les 2 niveaux immédiatement supérieurs (locked, les plus proches)
   *   - le niveau actuel (current)
   *   - tous les niveaux déjà débloqués (unlocked, level < current)
   */
  private processRewardsDisplay(): void {
    const nextTwo = this.rewards
      .filter(r => !r.unlocked && !r.current)
      .sort((a, b) => a.level - b.level)
      .slice(0, 2);

    const current = this.rewards.find(r => r.current);
    const unlocked = this.rewards.filter(r => r.unlocked);

    const merged: LevelReward[] = [
      ...nextTwo,
      ...(current ? [current] : []),
      ...unlocked,
    ];
    this.processedRewards = merged.sort((a, b) => b.level - a.level);
  }

  /**
   * XP requis pour le niveau suivant = xpRequired de level currentLevel+1.
   * Doit tourner après initRewards().
   */
  private resolveNextXp(): void {
    const next = this.rewards.find(r => r.level === this.currentLevel + 1);
    this.xpRequiredForNext = next?.xpRequired ?? 0;
  }

  /**
   * Hauteur de la ligne dorée depuis le bas.
   * La ligne est gold de la base jusqu'au badge gift (niveau actuel).
   * On distribue les items en slots égaux et on colore les slots
   * depuis le bas jusqu'au slot du niveau current (inclus).
   *
   * processedRewards[0]       = niveau le plus haut  (haut écran)
   * processedRewards[total-1] = niveau le plus bas   (bas écran)
   */
  private computeFilledLine(): void {
    const total = this.processedRewards.length;
    if (total === 0) { this.filledLinePercent = 0; return; }
    const idx = this.processedRewards.findIndex(r => r.current);
    if (idx < 0) { this.filledLinePercent = 0; return; }
    // processedRewards[0] = plus haut (haut écran), [total-1] = plus bas (bas écran)
    // Le fill monte depuis le bas. Pour atteindre le marqueur du slot `idx`,
    // on couvre (total - idx) slots entiers depuis le bas.
    this.filledLinePercent = Math.round(((total - idx) / total) * 100);
  }
 
  // ── Computed ──────────────────────────────────────────────
 
  /**
   * % de progression DANS le niveau actuel.
   * Utilise processedRewards pour les calculs
   */
  get xpProgressPercent(): number {
    // Chercher dans la liste complète, pas processedRewards (subset)
    const cur = this.rewards.find(r => r.current);
    if (!cur || !this.xpRequiredForNext) return 0;
    const range = this.xpRequiredForNext - cur.xpRequired;
    if (range <= 0) return 100;
    return Math.min(100, Math.max(0,
      Math.round(((this.userXp - cur.xpRequired) / range) * 100)
    ));
  }
 
  // ── Actions ───────────────────────────────────────────────
 
  collect(reward: LevelReward): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.id) {
      console.warn('Utilisateur non connecté pour collecter la récompense');
      return;
    }

    // Utiliser le RewardService pour collecter la récompense
    this.rewardService.collectReward(currentUser.id, reward.level).subscribe({
      next: (success) => {
        if (success) {
          reward.collected = true;
          reward.collectible = false;
          this.cdr.markForCheck();
          console.log(`Récompense de niveau ${reward.level} collectée avec succès`);
          
          // Notifier la collecte réussie
          this.notificationManager.notifyRewardCollected(reward.level, currentUser.id);
        } else {
          console.error('Échec de la collecte de la récompense');
        }
      },
      error: (error) => {
        console.error('Erreur lors de la collecte de la récompense:', error);
        // En cas d'erreur, on peut quand même mettre à jour l'interface localement
        reward.collected = true;
        reward.collectible = false;
        this.cdr.markForCheck();
      }
    });
  }
 
  dismiss(): void {
    this.modalCtrl.dismiss();
  }
 
  trackByLevel(_: number, r: LevelReward): number {
    return r.level;
  }
}