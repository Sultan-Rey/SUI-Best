import { Coupon } from "./Coupon";

export interface Wallet {
    id: string;
    userId: string;
    balance: {
        coins: number;
        coupons: number;
    };
    coupons: Coupon[];
    transactions: Transaction[];
    createdAt: string;
    updatedAt: string;
}

export interface Transaction {
    id: string;
    walletId: string;
    type: 'purchase' | 'usage' | 'refund';
    amount: number;
    itemType: 'coins' | 'coupons' | 'gift' |  'subscription';
    description: string;
    date: string;
    price?: number;
    paymentMethod?: string;
    metadata?: Record<string, any>;
}

export interface Setting{
    admin_validation_limit:number;
    collaborator_payout_limit:number;
    email_notification:boolean;
    two_factor_authentication:boolean;
    profile_visibility:boolean;
    coin_conversion_rate:number;
}