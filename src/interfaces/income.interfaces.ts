import { Coupon, CouponType } from '../models/Coupon';

// Interfaces communes pour les services financiers

export interface Pack {
  id: number;
  name: string;
  ownerId : string;
  amount: number;
  price: number;
  icon: string;
  couponType: CouponType;
  itemType: 'coins' | 'coupons' | 'gift';
  isBestValue?: boolean;
  isBestAcademy: boolean;
  promo?: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
}

export interface CouponTypeInfo {
  type: string;
  count: number;
  color: string;
}

export interface CouponValidation {
  isValid: boolean;
  message: string;
  coupon?: Coupon;
}
