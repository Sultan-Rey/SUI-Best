import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiJSON } from '../API/LOCAL/api-json';
import { Pack, PaymentMethod } from '../../interfaces/income.interfaces';

@Injectable({
  providedIn: 'root',
})
export class IncomeService {
  private readonly PACKS_RESOURCE = 'packs';
  
  constructor(private api: ApiJSON) {}

  // ============================================
  // PACKS API METHODS
  // ============================================

  /**
   * Récupère tous les packs disponibles depuis l'API
   */
  getAvailablePacks(): Observable<Pack[]> {
    return this.api.get<Pack[]>(this.PACKS_RESOURCE);
  }

  /**
   * Récupère les packs de coins uniquement
   */
  getCoinsPacks(): Observable<Pack[]> {
    return this.getAvailablePacks().pipe(
      map(packs => packs.filter(pack => pack.itemType === 'coins'))
    );
  }

  /**
   * Récupère les packs de coupons uniquement
   */
  getCouponsPacks(): Observable<Pack[]> {
    return this.getAvailablePacks().pipe(
      map(packs => packs.filter(pack => pack.itemType === 'coupons'))
    );
  }

  /**
   * Crée un nouveau pack
   */
  createPack(pack: Omit<Pack, 'id'>): Observable<Pack> {
    return this.api.create<Pack>(this.PACKS_RESOURCE, pack);
  }

  // ============================================
  // STATIC DATA (fallback si API indisponible)
  // ============================================

  /**
   * Retourne les méthodes de paiement disponibles
   */
  getPaymentMethods(): PaymentMethod[] {
    return [
      { id: 'gpay', name: 'Google Pay', icon: 'assets/icon/google-pay.png' },
      { id: 'card', name: '**** 4242', icon: 'assets/icon/visa.png' }
    ];
  }

  /**
   * Applique un code promo
   */
  applyPromoCode(code: string): { valid: boolean; discount: number; message: string } {
    const promoCodes = {
      'BEST10': { discount: 0.10, message: '-10% sur tous les packs!' },
      'SAVE20': { discount: 0.20, message: '-20% sur tous les packs!' },
      'WELCOME': { discount: 0.15, message: '-15% de bienvenue!' }
    };
    
    const upperCode = code.toUpperCase();
    const promo = promoCodes[upperCode as keyof typeof promoCodes];
    
    if (promo) {
      return {
        valid: true,
        discount: promo.discount,
        message: `Code promo appliqué: ${promo.message}`
      };
    }
    
    return {
      valid: false,
      discount: 0,
      message: 'Code promo invalide'
    };
  }
}
