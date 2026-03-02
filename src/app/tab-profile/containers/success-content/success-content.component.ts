import { Component, Input, OnInit } from '@angular/core';
import { IonIcon, IonSpinner } from "@ionic/angular/standalone";
import { addIcons } from 'ionicons';
import { 
  gift, 
  imagesOutline,
  starOutline,
  flashOutline, 
  lockClosedOutline, 
  checkmarkDone,
  checkmarkCircle,
  lockClosed,
  shieldOutline,
  logoBitcoin,
  giftOutline,
  pricetagOutline
} from 'ionicons/icons';
import { NgIf, NgFor } from '@angular/common';
// ─── MODÈLES ──────────────────────────────────────────────────────────────────

export type AchievementStatus = 'unlocked' | 'in_progress' | 'locked';
export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type ProgressType = 'count' | 'percent';
export type SuccessFilter = AchievementStatus | 'all';
export type RewardType = 'coins' | 'gift' | 'coupon';

export interface AchievementReward {
  type: RewardType;
  label: string;   // ex: "500 coins", "Badge Exclusif", "Coupon -20%"
  value?: number;  // montant pour coins
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: AchievementRarity;
  status: AchievementStatus;
  progressType: ProgressType;
  currentProgress: number;
  targetProgress: number;
  rewardXP: number;
  reward: AchievementReward;
  collected: boolean;
  unlockedAt?: Date;
  category: 'social' | 'content' | 'challenge' | 'loyalty';
}

// ─── COMPOSANT ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-success-content',
  templateUrl: './success-content.component.html',
  styleUrls: ['./success-content.component.scss'],
  standalone: true,
  imports: [IonSpinner, IonIcon, NgIf, NgFor]
})
export class SuccessContentComponent implements OnInit {

  @Input() userId!: string;
  @Input() isOwnProfile: boolean = false;

  achievements: Achievement[] = [];
  successFilter: SuccessFilter = 'all';
  isLoading: boolean = false;

  // ─── Cycle de vie ───────────────────────────────────────────────────────────

  ngOnInit(): void {
    addIcons({
      gift,
      imagesOutline,
      starOutline,
      flashOutline,
      lockClosedOutline,
      checkmarkDone,
      checkmarkCircle,
      lockClosed,
      shieldOutline,
      logoBitcoin,
      giftOutline,
      pricetagOutline
    });
    this.loadAchievements();
  }

  // ─── Chargement ─────────────────────────────────────────────────────────────

  private loadAchievements(): void {
    this.isLoading = true;
    setTimeout(() => {
      this.achievements = this.getMockAchievements();
      this.isLoading = false;
    }, 300);
  }

  private getMockAchievements(): Achievement[] {
    return [
      {
        id: 'ach_001',
        title: 'Premier Pas',
        description: 'Publie ton tout premier contenu sur la plateforme.',
        icon: 'rocket-outline',
        rarity: 'common',
        status: 'unlocked',
        progressType: 'count',
        currentProgress: 1,
        targetProgress: 1,
        rewardXP: 50,
        reward: { type: 'coins', label: '100 coins', value: 100 },
        collected: true,
        unlockedAt: new Date('2024-11-01'),
        category: 'content',
      },
      {
        id: 'ach_002',
        title: 'Créateur Prolifique',
        description: 'Publie 50 contenus sur la plateforme.',
        icon: 'images-outline',
        rarity: 'rare',
        status: 'unlocked',
        progressType: 'count',
        currentProgress: 50,
        targetProgress: 50,
        rewardXP: 200,
        reward: { type: 'coins', label: '500 coins', value: 500 },
        collected: false,
        unlockedAt: new Date('2025-01-20'),
        category: 'content',
      },
      {
        id: 'ach_003',
        title: 'Magnétique',
        description: 'Atteins 1 000 fans sur ton profil.',
        icon: 'people-outline',
        rarity: 'epic',
        status: 'in_progress',
        progressType: 'percent',
        currentProgress: 67,
        targetProgress: 100,
        rewardXP: 500,
        reward: { type: 'gift', label: 'Badge Exclusif' },
        collected: false,
        category: 'social',
      },
      {
        id: 'ach_004',
        title: 'Légende Vivante',
        description: 'Accumule 10 000 votes sur l\'ensemble de tes contenus.',
        icon: 'star-outline',
        rarity: 'legendary',
        status: 'locked',
        progressType: 'count',
        currentProgress: 0,
        targetProgress: 10000,
        rewardXP: 2000,
        reward: { type: 'coupon', label: 'Coupon -50%' },
        collected: false,
        category: 'social',
      },
      {
        id: 'ach_005',
        title: 'Challenger',
        description: 'Participe à ton premier challenge.',
        icon: 'trophy-outline',
        rarity: 'common',
        status: 'unlocked',
        progressType: 'count',
        currentProgress: 1,
        targetProgress: 1,
        rewardXP: 75,
        reward: { type: 'coins', label: '150 coins', value: 150 },
        collected: false,
        unlockedAt: new Date('2025-01-15'),
        category: 'challenge',
      },
      {
        id: 'ach_006',
        title: 'Fidèle',
        description: 'Connecte-toi 30 jours consécutifs.',
        icon: 'calendar-outline',
        rarity: 'rare',
        status: 'in_progress',
        progressType: 'count',
        currentProgress: 18,
        targetProgress: 30,
        rewardXP: 300,
        reward: { type: 'gift', label: 'Frame de profil' },
        collected: false,
        category: 'loyalty',
      },
    ];
  }

  // ─── Getters calculés ───────────────────────────────────────────────────────

  get filteredAchievements(): Achievement[] {
    if (this.successFilter === 'all') return this.achievements;
    return this.achievements.filter(a => a.status === this.successFilter);
  }

  get unlockedSuccessCount(): number {
    return this.achievements.filter(a => a.status === 'unlocked').length;
  }

  get inProgressSuccessCount(): number {
    return this.achievements.filter(a => a.status === 'in_progress').length;
  }

  get totalCollectedXP(): number {
    return this.achievements
      .filter(a => a.collected)
      .reduce((sum, a) => sum + a.rewardXP, 0);
  }

  get userLevel(): number {
    return Math.floor(this.totalCollectedXP / 500) + 1;
  }

  get currentXP(): number {
    return this.totalCollectedXP % 500;
  }

  get nextLevelXP(): number {
    return 500;
  }

  get xpProgressPercent(): number {
    return (this.currentXP / this.nextLevelXP) * 100;
  }

  // ─── Méthodes ───────────────────────────────────────────────────────────────

  setSuccessFilter(filter: SuccessFilter): void {
    this.successFilter = filter;
  }

  getProgressPercent(achievement: Achievement): number {
    if (achievement.targetProgress === 0) return 0;
    return Math.min(
      (achievement.currentProgress / achievement.targetProgress) * 100,
      100
    );
  }

  getRarityLabel(rarity: AchievementRarity): string {
    const labels: Record<AchievementRarity, string> = {
      common: 'Commun',
      rare: 'Rare',
      epic: 'Épique',
      legendary: 'Légendaire',
    };
    return labels[rarity];
  }

  getRewardIcon(type: RewardType): string {
    const icons: Record<RewardType, string> = {
      coins: 'logo-bitcoin',
      gift: 'gift-outline',
      coupon: 'pricetag-outline',
    };
    return icons[type];
  }

  getRewardLabel(reward: AchievementReward): string {
    return reward.label;
  }

  /**
   * Point d'entrée vers la collecte.
   * Pour l'instant : log enrichi + animation visuelle via classe CSS.
   * TODO: naviguer vers la page/modal de collecte avec l'achievement en paramètre.
   */
  onCollect(event: Event, achievement: Achievement): void {
    event.stopPropagation();
    if (achievement.status !== 'unlocked' || achievement.collected) return;

    console.log(
      `%c🎁 RÉCLAMER — "${achievement.title}"`,
      'background:#FFCC00;color:#1a1a1a;font-weight:bold;padding:4px 8px;border-radius:4px;',
      '\nRécompense:', achievement.reward,
      '\nXP gagné:', achievement.rewardXP,
    );

    // TODO: this.router.navigate(['/collect', achievement.id])
    // ou   this.modalCtrl.create({ component: CollectRewardModal, componentProps: { achievement } })
  }

  openAchievementDetail(achievement: Achievement): void {
    if (achievement.status === 'locked') return;
    console.log(
      `%c🔍 DÉTAIL — "${achievement.title}"`,
      'background:#444;color:#fff;padding:4px 8px;border-radius:4px;',
      achievement,
    );
    // TODO: this.modalCtrl.create({ component: AchievementDetailModal, ... })
  }

  trackByAchievement(_index: number, item: Achievement): string {
    return item.id;
  }
}