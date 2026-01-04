export interface Challenge {
  id: string;
  name: string;
  description: string;
  creator_id: string;
  duration_days: number;
  vote_rule: 'one_vote_per_user' | 'unlimited_votes' | string; // Vous pouvez étendre avec d'autres règles si nécessaire
  created_at?: Date; // Optionnel : date de création
  start_date?: Date; // Optionnel : date de début
  end_date?: Date; // Optionnel : date de fin
  is_active?: boolean; // Optionnel : statut actif/inactif
  cover_image_url?: string; // Optionnel : URL de l'image de couverture
  prize?: string; // Optionnel : description du prix
  rules?: string[]; // Optionnel : liste des règles du défi
  participants_count?: number; // Optionnel : nombre de participants
  entries_count?: number; // Optionnel : nombre de participations
}

// Exemple d'énumération pour les règles de vote
export enum VoteRule {
  ONE_VOTE_PER_USER = 'one_vote_per_user',
  UNLIMITED_VOTES = 'unlimited_votes',
  // Ajoutez d'autres règles au besoin
}