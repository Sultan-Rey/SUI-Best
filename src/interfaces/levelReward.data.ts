import { LevelReward } from 'src/models/LevelReward';

// ─── XP Thresholds ───────────────────────────────────────────
// Chaque niveau indique le XP cumulé requis pour l'atteindre.
// La progression double approximativement à chaque palier.
//
//  Lvl 1 →     100 XP   (onboarding immédiat)
//  Lvl 2 →   2 000 XP
//  Lvl 3 →   5 000 XP
//  Lvl 4 →  12 000 XP
//  Lvl 5 →  25 000 XP
//  Lvl 6 →  50 000 XP
//  Lvl 7 → 100 000 XP  (niveau max)

// ─── ARTIST ──────────────────────────────────────────────────
export const ARTIST_REWARDS: LevelReward[] = [
  {
    level: 7,
    name: 'Legend',
    subtitle: 'Reached Level 7',
    image: undefined,
    unlocked: false,
    current: false,
    collectible: false,
    collected: false,
    xpRequired: 100_000,
    gift: {
      label: 'Badge Legend doré + Statut vérifié + Accès Creator Lab',
      type: 'badge+feature',
    },
  },
  {
    level: 6,
    name: 'Headliner',
    subtitle: 'Reached Level 6',
    image: undefined,
    unlocked: false,
    current: false,
    collectible: false,
    collected: false,
    xpRequired: 50_000,
    gift: {
      label: 'Badge Headliner + Profil mis en avant sur l\'accueil',
      type: 'badge+boost',
    },
  },
  {
    level: 5,
    name: 'Chart Breaker',
    subtitle: 'Reached Level 5',
    image: undefined,
    unlocked: false,
    current: false,
    collectible: false,
    collected: false,
    xpRequired: 25_000,
    gift: {
      label: 'Badge Chart Breaker + Revenus splits activés',
      type: 'badge+monetization',
    },
  },
  {
    level: 4,
    name: 'Spotlight',
    subtitle: 'Reached Level 4',
    image: undefined,
    unlocked: false,
    current: false,
    collectible: false,
    collected: false,
    xpRequired: 12_000,
    gift: {
      label: 'Sticker profil Spotlight + Accès challenges Premium',
      type: 'cosmetic+access',
    },
  },
  {
    level: 3,
    name: 'Crowd Pleaser',
    subtitle: 'Reached Level 3',
    image: 'assets/badges/artist-lvl3.png',
    unlocked: false,
    current: false,
    collectible: false,
    collected: false,
    xpRequired: 5_000,
    gift: {
      label: 'Badge Gold Ear + Boost visibilité 7 jours',
      type: 'badge+boost',
    },
  },
  {
    level: 2,
    name: 'On Stage',
    subtitle: 'Reached Level 2',
    image: undefined,
    unlocked: false,
    current: false,
    collectible: false,
    collected: false,
    xpRequired: 2_000,
    gift: {
      label: 'Cadre de profil animé + Filtre cover',
      type: 'cosmetic',
    },
  },
  {
    level: 1,
    name: 'Rising Star',
    subtitle: 'Reached Level 1',
    image: 'assets/badges/artist-lvl1.png',
    unlocked: false,
    current: false,
    collectible: false,
    collected: false,
    xpRequired: 100,
    gift: {
      label: 'Badge hexagonal Rising Star',
      type: 'badge',
    },
  },
];

// ─── CREATOR ─────────────────────────────────────────────────
export const CREATOR_REWARDS: LevelReward[] = [
  {
    level: 7,
    name: 'Icon Maker',
    subtitle: 'Reached Level 7',
    image: undefined,
    unlocked: false,
    current: false,
    collectible: false,
    collected: false,
    xpRequired: 100_000,
    gift: {
      label: 'Badge Icon Maker + Partenariat plateformes streaming',
      type: 'badge+partnership',
    },
  },
  {
    level: 6,
    name: 'Impresario',
    subtitle: 'Reached Level 6',
    image: undefined,
    unlocked: false,
    current: false,
    collectible: false,
    collected: false,
    xpRequired: 50_000,
    gift: {
      label: 'Badge Impresario + Page créateur mise en avant',
      type: 'badge+boost',
    },
  },
  {
    level: 5,
    name: 'Amplifier',
    subtitle: 'Reached Level 5',
    image: undefined,
    unlocked: false,
    current: false,
    collectible: false,
    collected: false,
    xpRequired: 25_000,
    gift: {
      label: 'Badge Amplifier + Commission réduite sur les prix',
      type: 'badge+monetization',
    },
  },
  {
    level: 4,
    name: 'Stage Builder',
    subtitle: 'Reached Level 4',
    image: undefined,
    unlocked: false,
    current: false,
    collectible: false,
    collected: false,
    xpRequired: 12_000,
    gift: {
      label: 'Accès challenges sponsorisés + Badge Stage Builder',
      type: 'access+badge',
    },
  },
  {
    level: 3,
    name: 'Trendsetter',
    subtitle: 'Reached Level 3',
    image: 'assets/badges/creator-lvl3.png',
    unlocked: false,
    current: false,
    collectible: false,
    collected: false,
    xpRequired: 5_000,
    gift: {
      label: 'Badge Trendsetter + Analytics avancées',
      type: 'badge+feature',
    },
  },
  {
    level: 2,
    name: 'Curator',
    subtitle: 'Reached Level 2',
    image: undefined,
    unlocked: false,
    current: false,
    collectible: false,
    collected: false,
    xpRequired: 2_000,
    gift: {
      label: 'Personnalisation visuelle du challenge (couleurs / bannière)',
      type: 'cosmetic',
    },
  },
  {
    level: 1,
    name: 'Spark',
    subtitle: 'Reached Level 1',
    image: 'assets/badges/creator-lvl1.png',
    unlocked: false,
    current: false,
    collectible: false,
    collected: false,
    xpRequired: 100,
    gift: {
      label: 'Badge Spark + 1 template challenge offert',
      type: 'badge+template',
    },
  },
];

// ─── FAN ─────────────────────────────────────────────────────
export const FAN_REWARDS: LevelReward[] = [
  {
    level: 7,
    name: 'Legend Fan',
    subtitle: 'Reached Level 7',
    image: undefined,
    unlocked: false,
    current: false,
    collectible: false,
    collected: false,
    xpRequired: 100000,
    gift: {
      label: 'Badge Legend Fan doré + Mention Hall of Fame',
      type: 'badge+honor',
    },
  },
  {
    level: 6,
    name: 'Inner Circle',
    subtitle: 'Reached Level 6',
    image: undefined,
    unlocked: false,
    current: false,
    collectible: false,
    collected: false,
    xpRequired: 50000,
    gift: {
      label: 'Badge Inner Circle + Accès backstage challenges privés',
      type: 'badge+access',
    },
  },
  {
    level: 5,
    name: 'Scene Scout',
    subtitle: 'Reached Level 5',
    image: undefined,
    unlocked: false,
    current: false,
    collectible: false,
    collected: false,
    xpRequired: 25000,
    gift: {
      label: 'Badge Scene Scout + Crédits vote bonus mensuels',
      type: 'badge+credits',
    },
  },
  {
    level: 4,
    name: 'Fanatic',
    subtitle: 'Reached Level 4',
    image: undefined,
    unlocked: false,
    current: false,
    collectible: false,
    collected: false,
    xpRequired: 12000,
    gift: {
      label: 'Badge Fanatic + Siège juré officiel débloqué',
      type: 'badge+role',
    },
  },
  {
    level: 3,
    name: 'Tastemaker',
    subtitle: 'Reached Level 3',
    image: 'assets/badges/fan-lvl3.png',
    unlocked: false,
    current: false,
    collectible: false,
    collected: false,
    xpRequired: 5000,
    gift: {
      label: 'Badge Tastemaker + Accès avant-premières challenges',
      type: 'badge+access',
    },
  },
  {
    level: 2,
    name: 'Supporter',
    subtitle: 'Reached Level 2',
    image: undefined,
    unlocked: false,
    current: false,
    collectible: false,
    collected: false,
    xpRequired: 2000,
    gift: {
      label: 'Réactions exclusives + Badge Supporter',
      type: 'cosmetic+badge',
    },
  },
  {
    level: 1,
    name: 'Discoverer',
    subtitle: 'Reached Level 1',
    image: 'assets/badges/fan-lvl1.png',
    unlocked: false,
    current: false,
    collectible: false,
    collected: false,
    xpRequired: 100,
    gift: {
      label: 'Badge Discoverer + Accès fil découverte étendu',
      type: 'badge+feature',
    },
  },
];

// ─── Helper : charge les bons rewards selon le type d'utilisateur ──
export function getRewardsForUserType(
  userType: 'artist' | 'creator' | 'fan' | 'admin',
  currentLevel: number,
  userXp: number
): LevelReward[] {
  const source =
    userType === 'artist' ? ARTIST_REWARDS :
    userType === 'creator' ? CREATOR_REWARDS :
    FAN_REWARDS;

  // Clone + mise à jour des flags unlocked / current en fonction du niveau réel
  return source.map(r => ({
    ...r,
    unlocked:    r.level < currentLevel,
    current:     r.level === currentLevel,
    collectible: r.level === currentLevel && !r.collected,
  }));
}