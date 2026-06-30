export type CouponType = 'standard' | 'premium' | 'legendary' | 'special';

export interface Coupon {
  id: string;
  name: string;
  description: string;
  referencePrice ?: number;
  type: CouponType;
  isUsed?:boolean;
  usageValue: number;
  expiresAt: Date;
}