import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalController} from '@ionic/angular';
import { Location } from '@angular/common';
import { addIcons } from 'ionicons';
import { chevronBackOutline } from 'ionicons/icons';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { RewardService } from 'src/services/Rewards/reward-service';
import { Auth } from 'src/services/AUTH/auth';
import { LevelReward } from 'src/models/LevelReward';

export interface AwardBadge {
  id: string;
  level: number;         // numéro de niveau ou rang
  name: string;          // nom affiché
  icon: string;          // id de l'icône SVG sprite ('star', 'trophy', etc.)
  image?: string;        // URL image si dispo (remplace l'icône)
  unlocked: boolean;
  unlockedAt?: Date;
  color: string;         // CSS : couleur principale du badge (ex: '#a78bfa')
  glow: string;          // CSS : couleur du halo (ex: 'rgba(167,139,250,0.4)')
  description?: string;
}

// ── Palette chromatique par rang (7 niveaux → 5 couleurs progressives)
const RANK_PALETTE = [
  { color: '#b0b8c8', glow: 'rgba(176,184,200,0.35)' }, // lvl1 — gris acier
  { color: '#93c5fd', glow: 'rgba(147,197,253,0.35)' }, // lvl2 — bleu ciel
  { color: '#a5b4fc', glow: 'rgba(165,180,252,0.35)' }, // lvl3 — indigo pastel
  { color: '#c084fc', glow: 'rgba(192,132,252,0.40)' }, // lvl4 — violet
  { color: '#f0abfc', glow: 'rgba(240,171,252,0.40)' }, // lvl5 — rose/lilas
  { color: '#fb923c', glow: 'rgba(251,146,60,0.40)'  }, // lvl6 — orange
  { color: '#fbbf24', glow: 'rgba(251,191,36,0.45)'  }, // lvl7 — or
];

@Component({
  selector: 'app-awards-gallery',
  templateUrl: './awards-gallery.component.html',
  styleUrls: ['./awards-gallery.component.scss'],
  standalone: true,
  providers:[ModalController],
  imports: [CommonModule, IonContent, IonIcon],
})
export class AwardsGalleryComponent implements OnInit {

  /** Badges de progression par niveau — générés ou passés en Input */
  @Input() levelBadges: AwardBadge[] = [];

  /** Badges de challenges — optionnel */
  @Input() challengeAwards: AwardBadge[] = [];

  /** Niveau actuel de l'utilisateur — pour générer les badges par défaut */
  @Input() currentLevel: number = 1;

  /** Type d'utilisateur */
  @Input() userType: 'artist' | 'creator' | 'fan' = 'fan';

  constructor(
    private modalController: ModalController,
    private rewardService: RewardService,
    private authService: Auth
  ) {
    addIcons({ chevronBackOutline });
  }

  async ngOnInit(): Promise<void> {
    this.currentLevel = Number(this.currentLevel) || 1;
    
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser?.id) {
        console.warn('Utilisateur non connecté pour charger les récompenses');
        // Fallback vers les données factices si pas d'utilisateur
        this.loadFallbackData();
        return;
      }

      // Charger les récompenses réelles depuis le RewardService
      const userRewards = await this.rewardService.getCalculatedRewards(currentUser.id).toPromise();
      
      if (userRewards && userRewards.length > 0) {
        // Convertir les LevelReward en AwardBadge
        this.levelBadges = this.convertLevelRewardsToBadges(userRewards);
      } else {
        console.warn('Aucune récompense trouvée via le service, utilisation des données factices');
        this.loadFallbackData();
      }

    } catch (error) {
      console.error('Erreur lors du chargement des récompenses:', error);
      this.loadFallbackData();
    }

    // Toujours charger les challenges (pour l'instant factices)
    if (this.challengeAwards.length === 0) {
      this.challengeAwards = this.buildChallengeBadges();
    }
  }

  /**
   * Charge les données factices en fallback
   */
  private loadFallbackData(): void {
    if (this.levelBadges.length === 0) {
      this.levelBadges = this.buildLevelBadges();
    }
  }

  /**
   * Convertit les LevelReward du RewardService en AwardBadge pour l'affichage
   */
  private convertLevelRewardsToBadges(levelRewards: LevelReward[]): AwardBadge[] {
    const iconsByType: Record<string, string[]> = {
      fan:     ['star', 'music', 'mic',   'trophy', 'flame', 'crown', 'star'],
      artist:  ['mic',  'music', 'flame', 'trophy', 'crown', 'star',  'trophy'],
      creator: ['video','flame', 'star',  'trophy', 'crown', 'music', 'crown'],
    };
    const icons = iconsByType[this.userType] ?? iconsByType['fan'];

    return levelRewards.map((reward: LevelReward) => {
      const paletteIndex = Math.min(reward.level - 1, RANK_PALETTE.length - 1);
      const palette = RANK_PALETTE[paletteIndex] ?? RANK_PALETTE[0];
      
      return {
        id: `level-${reward.level}`,
        level: reward.level,
        name: reward.name || `Level ${reward.level}`,
        icon: icons[reward.level - 1] || 'star',
        image: reward.unlocked ? reward.image : undefined,
        unlocked: reward.unlocked,
        unlockedAt: reward.collected ? new Date() : undefined, // TODO: utiliser une vraie date du backend
        color: palette.color,
        glow: palette.glow,
        description: reward.subtitle,
      };
    });
  }

  // ── Builders ────────────────────────────────────────────

  private buildLevelBadges(): AwardBadge[] {
    const iconsByType: Record<string, string[]> = {
      fan:     ['star', 'music', 'mic',   'trophy', 'flame', 'crown', 'star'],
      artist:  ['mic',  'music', 'flame', 'trophy', 'crown', 'star',  'trophy'],
      creator: ['video','flame', 'star',  'trophy', 'crown', 'music', 'crown'],
    };
    const icons = iconsByType[this.userType] ?? iconsByType['fan'];

    return Array.from({ length: 7 }, (_, i) => {
      const lvl     = i + 1;
      const palette = RANK_PALETTE[i] ?? RANK_PALETTE[RANK_PALETTE.length - 1];
      return {
        id:       `level-${lvl}`,
        level:    lvl,
        name:     `Level ${lvl}`,
        icon:     icons[i],
        image:    lvl <= this.currentLevel ? `assets/badges/${this.userType}-lvl${lvl}.png` : undefined,
        unlocked: lvl <= this.currentLevel,
        color:    palette.color,
        glow:     palette.glow,
      };
    });
  }

  private buildChallengeBadges(): AwardBadge[] {
    // Badges de challenges — exemples à brancher sur l'API
    const defs = [
      { id: 'ch-1', name: 'First Win',   icon: 'trophy', palette: 1 },
      { id: 'ch-2', name: 'Hot Streak',  icon: 'flame',  palette: 2 },
      { id: 'ch-3', name: 'Top Voter',   icon: 'star',   palette: 3 },
      { id: 'ch-4', name: 'Live Hero',   icon: 'mic',    palette: 4 },
      { id: 'ch-5', name: 'Viral Post',  icon: 'video',  palette: 5 },
      { id: 'ch-6', name: 'Fan Fave',    icon: 'dance',  palette: 6 },
      { id: 'ch-7', name: 'Legend',      icon: 'crown',  palette: 6 },
      { id: 'ch-8', name: 'Trendsetter', icon: 'music',  palette: 4 },
    ];

    return defs.map((d, i) => {
      const palette = RANK_PALETTE[d.palette] ?? RANK_PALETTE[0];
      return {
        id:       d.id,
        level:    i + 1,
        name:     d.name,
        icon:     d.icon,
        unlocked: i < 2, // Exemple : 2 premiers débloqués
        color:    palette.color,
        glow:     palette.glow,
      };
    });
  }

  // ── Actions ─────────────────────────────────────────────

  openBadge(badge: AwardBadge): void {
    // TODO: ouvrir un modal détail du badge
    console.log('[Awards] open badge:', badge.name);
  }

  goBack(): void {
    this.modalController.dismiss();
  }

  trackById(_: number, b: AwardBadge): string {
    return b.id;
  }
}