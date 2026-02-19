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
    itemType: 'coins' | 'coupons' | 'gift';
    description: string;
    date: string;
    price?: number;
    paymentMethod?: string;
    metadata?: Record<string, any>;
}
