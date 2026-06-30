// ── NOUVEAUX ENUMS ET INTERFACES POUR LES ADS ──
export enum AdType {
  BANNER = 'BANNER',
  INTERSTITIAL = 'INTER',
  VIDEO_ROLL = 'VIDEO'
}

export enum AdStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  EXPIRED = 'EXPIRED'
}

export interface AdContent {
  id?: string;
  title: string;
  description?: string;
  type: AdType;
  status: AdStatus;
  target_url: string;
  media_url: string;
  start_date: string;
  end_date: string;
  impressions_count: number;
  clicks_count: number;
  advertiser_name: string;
  budget?: {
    value: number;
    type: 'CPC' | 'CPM' | 'FLAT';
    currency: 'HTG' | 'USD';
  };
}