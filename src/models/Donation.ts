export interface Donor {
  id: string;
  name: string;
  totalDonations: number;
  donationCount: number;
  imageUrl: string;
  rank?: number;
  tier: 'legendary' | 'epic' | 'rare' | 'common';
  badge?: string;
  level: number;
}

export interface DonorTier {
  name: string;
  minAmount: number;
  color: string;
  icon: string;
  benefits: string[];
}