export interface Gift {
  id: string;
  name: string;
  category: 'Mythic' | 'Epic' | 'Rare' | 'Common' | string; // Ajout d'un type union avec string pour flexibilité
  price: number;
  animation_url: string;
  is_global_alert: boolean;
  xp_reward: number;
  duration_effect: number; // en secondes
  qty_detained: number;
}