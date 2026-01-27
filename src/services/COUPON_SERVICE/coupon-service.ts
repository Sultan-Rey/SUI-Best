import { Injectable } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import { Coupon, CouponType } from '../../models/coupon';
import { ApiJSON } from '../API/LOCAL/api-json';

@Injectable({
  providedIn: 'root',
})
export class CouponService {
  private readonly endpoint = 'coupons';
  private couponTypes: CouponType[] = ['standard', 'premium', 'legendary', 'special'];
  private couponNames = [
    'Réduction Été',
    'Spécial Étudiant',
    'Première Commande',
    'Fidélité',
    'Spécial Membre',
    'Promo Flash',
    'Anniversaire',
    'Black Friday'
  ];

  constructor(private api: ApiJSON) {}

  // Créer un nouveau coupon
  createCoupon(couponData: Omit<Coupon, 'id'>): Observable<Coupon> {
    return this.api.create<Coupon>(this.endpoint, couponData);
  }

  // Supprimer un coupon par son ID
  deleteCouponById(couponId: string): Observable<void> {
    return this.api.delete(this.endpoint, couponId);
  }

  // Décrémenter la valeur d'utilisation d'un coupon
  // Décrémenter la valeur d'utilisation d'un coupon
decrementCouponUsage(couponId: string): Observable<Coupon> {
  return this.getCouponById(couponId).pipe(
    switchMap(coupon => {
      if (!coupon) {
        throw new Error('Coupon non trouvé');
      }
      
      if (coupon.usageValue <= 0) {
        throw new Error('Ce coupon a déjà été utilisé');
      }

      const updatedCoupon = {
        ...coupon,
        usageValue: coupon.usageValue - 1
      };

      return this.api.update<Coupon>(this.endpoint, couponId, updatedCoupon);
    })
  );
}

  // Générer les données d'un coupon aléatoire (utilisé en interne)
  private generateRandomCouponData(): Omit<Coupon, 'id'> {
    const randomType = this.couponTypes[Math.floor(Math.random() * this.couponTypes.length)];
    const randomName = this.couponNames[Math.floor(Math.random() * this.couponNames.length)];
    
    return {
      name: `${randomName} ${Math.floor(Math.random() * 1000)}`,
      description: `Coupon ${randomType} - ${randomName}`,
      type: randomType,
      usageValue: Math.floor(Math.random() * 10) + 1,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Expire dans 30 jours
    };
  }

  // Générer des coupons aléatoires
  generateRandomCoupons(count: number = 1): Observable<Coupon[]> {
    const randomCoupons = Array(count).fill(null).map(() => this.generateRandomCouponData());
    return this.api.create<Coupon[]>(`${this.endpoint}/batch`, randomCoupons as Coupon[]);
  }

  // Récupérer tous les coupons
  getAllCoupons(): Observable<Coupon[]> {
    return this.api.getAll<Coupon>(this.endpoint);
  }

  // Récupérer un coupon par son ID
  getCouponById(couponId: string): Observable<Coupon> {
    return this.api.getById<Coupon>(this.endpoint, couponId);
  }
}
