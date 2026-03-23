export interface LevelReward {
  level: number;
  name: string;
  subtitle: string;
  image?: string;          // URL du badge hexagonal
  unlocked: boolean;       // niveau déjà atteint et récompense disponible
  current: boolean;        // niveau actuel de l'utilisateur
  collectible?: boolean;   // peut être collectée maintenant
  collected?: boolean;     // déjà collectée
  gift?: any;              // cadeau pouvant etre obtenu 
  xpRequired: number;      // nombre d'XP requis pour atteindre le level
}