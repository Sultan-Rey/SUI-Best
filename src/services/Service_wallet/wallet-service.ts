import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { tap, catchError, switchMap, map } from 'rxjs/operators';
import { Wallet, Transaction } from '../../models/Wallet';
import { Coupon, CouponType } from '../../models/Coupon';
import { ApiJSON } from '../API/LOCAL/api-json'; // ✅ Migration vers notre ApiJSON unifié
import { IncomeService } from '../service_income/income-service';
import { Pack, CouponTypeInfo, CouponValidation } from '../../interfaces/income.interfaces';
import { Auth } from '../AUTH/auth';
// Import de l'environnement pour récupérer l'adminUID
import { environment } from '../../environments/environment';
  
// Interface locale pour compatibilité
export interface UserBalance {
  coins: number;
  coupons: number;
}

@Injectable({
  providedIn: 'root'
})
export class WalletService {
 
  private readonly STORAGE_KEY = 'best_user_wallet_cache';
  private readonly WALLET_RESOURCE = 'wallets';
  
  // BehaviorSubjects for reactive updates
  private walletSubject = new BehaviorSubject<Wallet | null>(null);
  private balanceSubject = new BehaviorSubject<UserBalance>({
    coins: 0,
    coupons: 0
  });
  
  // Observable streams
  public wallet$ = this.walletSubject.asObservable();
  public balance$ = this.balanceSubject.asObservable();
  public transactions$ = this.wallet$.pipe(
    map(wallet => wallet?.transactions || [])
  );
  public coupons$ = this.wallet$.pipe(
    map(wallet => {
      const allCoupons = wallet?.coupons || [];
     
      
      const filteredCoupons = allCoupons.filter(coupon => {
        const isValid = new Date(coupon.expiresAt) > new Date() && coupon.usageValue > 0;
        if (!isValid) {
          console.log('❌ Coupon filtré:', {
            id: coupon.id,
            name: coupon.name,
            expiresAt: coupon.expiresAt,
            usageValue: coupon.usageValue,
            isExpired: new Date(coupon.expiresAt) <= new Date(),
            hasNoUsage: coupon.usageValue <= 0
          });
        }
        return isValid;
      });
      
      console.log('✅ Coupons valides après filtrage:', filteredCoupons.length, filteredCoupons);
      return filteredCoupons;
    })
  );

  // Observable pour les types de coupons (réactif)
  public couponTypes$ = this.wallet$.pipe(
    map(wallet => {
      const coupons = wallet?.coupons || [];
      
      // Compter les coupons par type
      const couponCounts = coupons.reduce((counts, coupon) => {
        counts[coupon.type] = (counts[coupon.type] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);
      
      return [
        { type: 'standard', count: couponCounts['standard'] || 0, color: '#bdc3c7' },
        { type: 'premium', count: couponCounts['premium'] || 0, color: '#f1c40f' },
        { type: 'legendary', count: couponCounts['legendary'] || 0, color: '#e74c3c' },
        { type: 'special', count: couponCounts['special'] || 0, color: '#3498db' }
      ];
    })
  );

  constructor(
    private api: ApiJSON, // ✅ Migration vers notre ApiJSON unifié
    private incomeService: IncomeService,
    private auth: Auth
  ) {
    this.initializeWallet();
  }

  // ============================================
  // WALLET API METHODS
  // ============================================

  /**
   * Initialise le wallet de l'utilisateur depuis l'API
   */
  private initializeWallet(): void {
    this.loadUserWallet(this.auth.getCurrentUser()?.id as string || 'user_current');
  }

  /**
   * Recharge manuellement le wallet (utilisé après un achat)
   */
  reloadWallet(): void {
    const userId = this.auth.getCurrentUser()?.id as string || 'user_current';
    this.loadUserWallet(userId);
  }

  /**
   * Charge le wallet depuis l'API
   */
  loadUserWallet(userId: string): void {
   // console.log('Chargement du wallet pour l\'utilisateur:', userId);
    // Utiliser getAll avec filtre userId pour éviter les doublons
    this.api.get<Wallet>(this.WALLET_RESOURCE).pipe(
      map(response => {
        // L'API retourne un tableau, on cherche le premier wallet correspondant
        if (Array.isArray(response)) {
          const userWallets = response.filter(wallet => wallet.userId === userId);
         // console.log(`Trouvé ${userWallets.length} wallet(s) pour l'utilisateur ${userId}:`, userWallets);
          return userWallets.length > 0 ? userWallets[0] : null;
        }
        return response;
      }),
      switchMap(wallet => {
        // Si le wallet est null, on en crée un nouveau
        if (!wallet) {
          //console.log('Aucun wallet trouvé, création en cours pour:', userId);
          return this.createWallet(userId);
        }
        
        // Wallet trouvé, on le retourne
        //console.log('Wallet existant trouvé:', wallet.id);
        this.walletSubject.next(wallet);
        this.balanceSubject.next(wallet.balance);
        this.saveWalletCache(wallet);
        return of(wallet);
      }),
      catchError(error => {
        console.error('❌ loadUserWallet: Erreur lors du chargement du wallet depuis l\'API:', error);
        
        // Si le wallet n'existe pas (404), on en crée un nouveau
        if (error.status === 404) {
          console.log('🔄 loadUserWallet: Wallet non trouvé (404), création en cours...');
          return this.createWallet(userId);
        }
        
        // Pour les autres erreurs, fallback vers le cache local
        console.log('📂 loadUserWallet: Erreur autre que 404, tentative de récupération depuis le cache...');
        this.loadWalletCache();
        return of(null);
      })
    ).subscribe();
  }

  /**
   * Crée un nouveau wallet pour l'utilisateur
   */
  createWallet(userId: string): Observable<Wallet> {
   // console.log('🔄 Création d\'un nouveau wallet pour l\'utilisateur:', userId);
    
    const newWallet = {
      userId,
      balance: { coins: 0, coupons: 0 },
      coupons: [],
      transactions: []
    };

    return this.api.create<Wallet>(this.WALLET_RESOURCE, newWallet).pipe(
      tap(wallet => {
        console.log('✅ Wallet créé avec succès:', wallet.id);
        this.walletSubject.next(wallet);
        this.balanceSubject.next(wallet.balance);
        this.saveWalletCache(wallet);
      }),
      catchError(error => {
        console.error('❌ Erreur lors de la création du wallet via API:', error);
        console.error('Status:', error.status);
        console.error('Message:', error.message);
        
        // Si c'est une erreur de conflit (409), essayer de recharger le wallet existant
        if (error.status === 409) {
          console.log('⚠️ Conflit détecté, tentative de rechargement du wallet existant...');
          return this.loadUserWalletAndGet(userId).pipe(
            switchMap(existingWallet => {
              if (existingWallet) {
                return of(existingWallet);
              } else {
                return throwError(() => new Error('Wallet introuvable après conflit'));
              }
            })
          );
        }
        
        return throwError(() => new Error(`Échec de la création du wallet: ${error.message || 'Erreur inconnue'}`));
      })
    );
  }

  /**
   * Met à jour le wallet sur l'API
   */
  private updateWallet(updates: Partial<Wallet>): Observable<Wallet> {
    const currentWallet = this.walletSubject.value;
    if (!currentWallet) {
      return throwError(() => new Error('No wallet loaded'));
    }

    return this.api.update<Wallet>(this.WALLET_RESOURCE, currentWallet.id, updates).pipe(
      tap(updatedWallet => {
        this.walletSubject.next(updatedWallet);
        this.balanceSubject.next(updatedWallet.balance);
        this.saveWalletCache(updatedWallet);
      })
    );
  }

  // ============================================
  // BALANCE METHODS
  // ============================================

  /**
   * Récupère la balance actuelle
   */
  getBalance(): UserBalance {
    return this.balanceSubject.value;
  }

  /**
   * Met à jour la balance via l'API
   */
  updateBalance(coins: number, coupons: number): Observable<Wallet> {
    const currentWallet = this.walletSubject.value;
    if (!currentWallet) {
      // Si aucun wallet n'est chargé, on essaie d'en créer un nouveau
      const userId = this.auth.getCurrentUser()?.id as string || 'user_current';
    
      return this.createWallet(userId).pipe(
        switchMap(newWallet => {
          // Mettre à jour le balance du nouveau wallet
          const updatedBalance = {
            coins: newWallet.balance.coins + coins,
            coupons: newWallet.balance.coupons + coupons
          };
          return this.updateWallet({ balance: updatedBalance });
        })
      );
    }

    const updatedBalance = {
      coins: currentWallet.balance.coins + coins,
      coupons: currentWallet.balance.coupons + coupons
    };

    return this.updateWallet({ balance: updatedBalance });
  }

  /**
   * Ajoute des coins
   */
  addCoins(amount: number): Observable<Wallet> {
    return this.updateBalance(amount, 0);
  }

  /**
   * Ajoute des coupons
   */
  addCoupons(amount: number): Observable<Wallet> {
    return this.updateBalance(0, amount);
  }

  /**
   * Déduit des coins si disponible
   */
  deductCoins(amount: number): Observable<Wallet> {
    const currentBalance = this.balanceSubject.value;
    if (!currentBalance) {
      return throwError(() => new Error('No wallet loaded'));
    }
    if (currentBalance.coins >= amount) {
      return this.updateBalance(-amount, 0);
    }
    return throwError(() => new Error('Insufficient coins'));
  }

  /**
   * Déduit des coupons si disponible
   */
  deductCoupons(amount: number): Observable<Wallet> {
    const currentBalance = this.balanceSubject.value;
    if (currentBalance.coupons >= amount) {
      return this.updateBalance(0, -amount);
    }
    return throwError(() => new Error('Insufficient coupons'));
  }

  // ============================================
  // PURCHASE & TRANSACTIONS
  // ============================================

  /**
   * Traite l'achat d'un pack via l'API
   */
  purchasePack(pack: Pack, itemType: 'coins' | 'coupons', paymentMethod: string, buyerId = ''): Observable<Wallet> {
    const currentWallet = this.walletSubject.value;
    
    // État 1: Wallet non trouvé - création automatique
    if (!currentWallet || !currentWallet.balance) {
      return this.loadUserWalletAndGet(this.auth.getCurrentUser()?.id as string || 'user_current').pipe(
        switchMap(loadedWallet => {
          if (!loadedWallet || !loadedWallet.balance) {
            return throwError(() => new Error('Impossible de créer votre wallet. Veuillez réessayer.'));
          }
          // Notification: Wallet créé avec succès
          return this.processPurchaseByType(loadedWallet, pack, itemType, paymentMethod, buyerId).pipe(
            tap(() => {
              console.log('🎉 Wallet créé et achat effectué avec succès!');
            })
          );
        }),
        catchError(error => {
          console.error('❌ Erreur lors de la création du wallet:', error);
          return throwError(() => new Error('Impossible de préparer votre wallet. Veuillez contacter le support.'));
        })
      );
    }
    
    // État 2: Wallet existant - achat direct
    return this.processPurchaseByType(currentWallet, pack, itemType, paymentMethod, buyerId);
  }

  /**
   * Méthode publique pour l'achat de packs de coins
   */
  purchasePackCoins(pack: Pack, itemType: 'coins', paymentMethod: string): Observable<Wallet> {
    return this.purchasePack(pack, itemType, paymentMethod);
  }

  /**
   * Factorisation - Traite l'achat selon le type d'item
   */
  private processPurchaseByType(currentWallet: Wallet, pack: Pack, itemType: 'coins' | 'coupons', paymentMethod: string, buyerId = ''): Observable<Wallet> {
    if (itemType === 'coins') {
      return this.purchaseCoinsPack(currentWallet, pack, paymentMethod);
    } else if (itemType === 'coupons') {
      return this.purchaseCouponsPack(currentWallet, pack, paymentMethod, buyerId);
    } else {
      return throwError(() => new Error(`Type d'item non supporté: ${itemType}`));
    }
  }

  /**
   * Factorisation - Traite l'achat d'un pack de coins
   */
  private purchaseCoinsPack(currentWallet: Wallet, pack: Pack, paymentMethod: string): Observable<Wallet> {
    // Créer la transaction pour l'achat de coins
    const transaction: Transaction = {
      id: this.generateTransactionId(),
      walletId: currentWallet.id,
      type: 'purchase',
      amount: pack.amount,
      itemType: 'coins',
      description: `Achat de ${pack.amount} coins`,
      date: new Date().toISOString(),
      price: pack.price,
      paymentMethod,
      metadata: { packId: pack.id }
    };

    // Mettre à jour le wallet avec la nouvelle transaction et balance
    const currentTransactions = Array.isArray(currentWallet.transactions) ? currentWallet.transactions : [];
    const updatedTransactions = [transaction, ...currentTransactions];
    
    const updatedBalance = {
      coins: (currentWallet.balance.coins || 0) + pack.amount,
      coupons: currentWallet.balance.coupons || 0
    };

    return this.updateWallet({
      transactions: updatedTransactions,
      balance: updatedBalance,
      coupons: currentWallet.coupons || []
    });
  }

  private loadUserWalletAndGet(userId: string): Observable<Wallet | null> {
   
    
    return this.api.get<Wallet>(this.WALLET_RESOURCE, { userId }).pipe(
      map(response => {
        // L'API retourne un tableau, on prend le premier wallet
        if (Array.isArray(response)) {
         
          return response.length > 0 ? response[0] : null;
        }
        return response;
      }),
      switchMap(wallet => {
        // Si le wallet est null (tableau vide), on en crée un nouveau
        if (!wallet) {
        
          return this.createWallet(userId);
        }
        
        // Wallet trouvé, on le retourne
       
        this.walletSubject.next(wallet);
        this.balanceSubject.next(wallet.balance);
        this.saveWalletCache(wallet);
       
        return of(wallet);
      }),
      catchError(error => {
        console.error('❌ Erreur lors du chargement du wallet depuis l\'API:', error);
        console.error('Status HTTP:', error.status);
        console.error('Message d\'erreur:', error.message);
        
        // Tentative de création si 404
        if (error.status === 404) {
          console.log('🔄 Wallet non trouvé (404), création en cours...');
          return this.createWallet(userId);
        }
        
         this.loadWalletCache();
        return of(null);
      })
    );
  }

  /**
   * Applique un code promo (délégué à IncomeService)
   */
  applyPromoCode(code: string): { valid: boolean; discount: number; message: string } {
    return this.incomeService.applyPromoCode(code);
  }

  /**
   * Récupère les transactions
   */
  getTransactions(): Transaction[] {
    return this.walletSubject.value?.transactions || [];
  }

  /**
   * Retourne les types de coupons disponibles avec les vrais comptes du wallet
   */
  getCouponTypes(): CouponTypeInfo[] {
    const coupons = this.walletSubject.value?.coupons || [];
    
    // Compter les coupons par type
    const couponCounts = coupons.reduce((counts, coupon) => {
      counts[coupon.type] = (counts[coupon.type] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    return [
      { type: 'standard', count: couponCounts['standard'] || 0, color: '#bdc3c7' },
      { type: 'premium', count: couponCounts['premium'] || 0, color: '#f1c40f' },
      { type: 'legendary', count: couponCounts['legendary'] || 0, color: '#e74c3c' },
      { type: 'special', count: couponCounts['special'] || 0, color: '#3498db' }
    ];
  }

  // ============================================
  // COUPON MANAGEMENT (anciennement coupon-service)
  // ============================================

  /**
   * Récupère tous les coupons du wallet
   */
  getUserCoupons(): Observable<Coupon[]> {
    return this.coupons$;
  }

  /**
   * Récupère un coupon par son ID
   */
  getUserCouponById(couponId: string): Observable<Coupon | null> {
    return this.coupons$.pipe(
      map(coupons => coupons.find(c => c.id === couponId) || null)
    );
  }

  /**
   * Ajoute un nouveau coupon via l'API
   */
  addUserCoupon(couponData: Omit<Coupon, 'id'>): Observable<Wallet> {
    const currentWallet = this.walletSubject.value;
    if (!currentWallet) {
      return throwError(() => new Error('No wallet loaded'));
    }

    const newCoupon: Coupon = {
      ...couponData,
      id: `user_${Date.now()}`
    };

    const updatedCoupons = [...currentWallet.coupons, newCoupon];
    return this.updateWallet({ coupons: updatedCoupons });
  }

  /**
   * Met à jour un coupon existant
   */
  updateUserCoupon(couponId: string, updates: Partial<Coupon>): Observable<Wallet> {
    const currentWallet = this.walletSubject.value;
    if (!currentWallet) {
      return throwError(() => new Error('No wallet loaded'));
    }

    const index = currentWallet.coupons.findIndex(c => c.id === couponId);
    if (index === -1) {
      return throwError(() => new Error('Coupon not found'));
    }

    const updatedCoupon = { 
      ...currentWallet.coupons[index], 
      ...updates,
      updatedAt: new Date().toISOString()
    };

    const updatedCoupons = [...currentWallet.coupons];
    updatedCoupons[index] = updatedCoupon;

    return this.updateWallet({ coupons: updatedCoupons });
  }

  /**
   * Supprime un coupon
   */
  deleteUserCoupon(couponId: string): Observable<Wallet> {
    const currentWallet = this.walletSubject.value;
    if (!currentWallet) {
      return throwError(() => new Error('No wallet loaded'));
    }

    const updatedCoupons = currentWallet.coupons.filter(c => c.id !== couponId);
    return this.updateWallet({ coupons: updatedCoupons });
  }

  /**
   * Décrémente la valeur d'utilisation d'un coupon
   */
  decrementUserCouponUsage(couponId: string, usageValue: number = 1): Observable<Wallet> {
    const currentWallet = this.walletSubject.value;
    if (!currentWallet) {
      return throwError(() => new Error('No wallet loaded'));
    }

    const index = currentWallet.coupons.findIndex(c => c.id === couponId);
    if (index === -1) {
      return throwError(() => new Error('Coupon not found'));
    }

    const coupon = currentWallet.coupons[index];
    
    if (coupon.usageValue <= 0) {
      return throwError(() => new Error('Coupon already used'));
    }

    const updatedCoupon = {
      ...coupon,
      usageValue: coupon.usageValue - usageValue,
      isUsed: coupon.usageValue - usageValue <= 0,
      updatedAt: new Date().toISOString()
    };

    const updatedCoupons = [...currentWallet.coupons];
    updatedCoupons[index] = updatedCoupon;

    return this.updateWallet({ coupons: updatedCoupons });
  }

  /**
   * Valide un coupon
   */
  validateUserCoupon(couponId: string): Observable<CouponValidation> {
    return this.getUserCouponById(couponId).pipe(
      map(coupon => {
        if (!coupon) {
          return { isValid: false, message: 'Coupon non trouvé' };
        }

        const now = new Date();
        const expiryDate = new Date(coupon.expiresAt);

        if (coupon.usageValue <= 0) {
          return { isValid: false, message: 'Ce coupon a atteint sa limite d\'utilisation' };
        }
        
        if (expiryDate < now) {
          return { isValid: false, message: 'Ce coupon a expiré' };
        }
        
        return { 
          isValid: true, 
          message: 'Coupon valide',
          coupon 
        };
      })
    );
  }
  generateIndividualCoupons(pack: Pack, currentWallet: Wallet): Observable<Wallet> {
    // Génère les coupons individuels avec IDs uniques
    const individualCoupons: Coupon[] = [];
    
    // Règles d'usage basées sur Fibonacci selon le type de coupon
    const getUsageValueByType = (couponType: CouponType): number => {
      const fibonacci = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];
      
      switch (couponType) {
        case 'standard':
          return fibonacci[0]; // 1 utilisation
        case 'premium':
          return fibonacci[2]; // 2 utilisations
        case 'legendary':
          return fibonacci[4]; // 5 utilisations
        case 'special':
          return fibonacci[6]; // 13 utilisations
        default:
          return fibonacci[0]; // 1 par défaut
      }
    };
    
    for (let i = 0; i < pack.amount; i++) {
      const coupon: Coupon = {
        id: `${pack.id}_coupon_${i + 1}_${Date.now()}`,
        name: `${pack.couponType} - ${pack.name}`,
        description: `Coupon de réduction ${pack.couponType} issu du pack ${pack.name}`,
        type: pack.couponType,
        usageValue: getUsageValueByType(pack.couponType),
        expiresAt: pack.expiryDate
      };
      individualCoupons.push(coupon);
    }
    
    // Mettre à jour le wallet avec les nouveaux coupons
    const currentCoupons = Array.isArray(currentWallet.coupons) ? currentWallet.coupons : [];
    const updatedWallet = {
      ...currentWallet,
      coupons: [...currentCoupons, ...individualCoupons]
    };
    
    // Mettre à jour le wallet via l'API
    return this.updateWallet(updatedWallet);
  }
  private generateTransactionId(): string {
    return `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Génère un ID de coupon unique
   */
  private generateCouponId(): string {
    return `CPN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Définit la valeur d'usage selon le type de coupon
   */
  private getCouponUsageValue(couponType: string): number {
    switch (couponType) {
      case 'standard':
        return 1;      // Usage unique
      case 'premium':
        return 3;      // 3 utilisations
      case 'legendary':
        return 5;      // 5 utilisations
      case 'special':
        return 2;      // 2 utilisations
      default:
        return 1;      // Valeur par défaut
    }
  }

  /**
   * Sauvegarde le wallet en cache local
   */
  private saveWalletCache(wallet: Wallet): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(wallet));
    } catch (error) {
      console.error('Failed to save wallet cache:', error);
    }
  }

  /**
   * Charge le wallet depuis le cache local
   */
  private loadWalletCache(): void {
    try {
      const savedData = localStorage.getItem(this.STORAGE_KEY);
      if (savedData) {
        const wallet = JSON.parse(savedData);
        const currentUserId = this.auth.getCurrentUser()?.id;
        
        // Vérifier que le wallet appartient à l'utilisateur actuel
        if (wallet.userId === currentUserId) {
          this.walletSubject.next(wallet);
          this.balanceSubject.next(wallet.balance);
        } else {
          console.warn('Wallet cache ignored: userId mismatch. Cache userId:', wallet.userId, 'Current userId:', currentUserId);
          // Nettoyer le cache invalide
          localStorage.removeItem(this.STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('Failed to load wallet cache:', error);
    }
  }

  /**
   * Nettoie le cache local
   */
  clearWalletCache(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.walletSubject.next(null);
    this.balanceSubject.next({ coins: 0, coupons: 0 });
  }

  /**
   * Force le rechargement depuis l'API
   */
  refreshWallet(userId: string): void {
    this.loadUserWallet(userId);
  }

  /**
   * Méthode publique pour l'achat de packs de coupons
   */
  purchaseCouponsPack(currentWallet: Wallet, pack: Pack, paymentMethod: string, buyerId: string): Observable<Wallet> {
    // Créer la transaction pour l'achat de coupons
    const transaction: Transaction = {
      id: this.generateTransactionId(),
      walletId: currentWallet.id,
      type: 'purchase',
      amount: pack.amount,
      itemType: 'coupons',
      description: `Achat de ${pack.amount} coupons`,
      date: new Date().toISOString(),
      price: pack.price,
      paymentMethod,
      metadata: { packId: pack.id }
    };

    // Mettre à jour le wallet avec la nouvelle transaction et générer les coupons
    const currentTransactions = Array.isArray(currentWallet.transactions) ? currentWallet.transactions : [];
    const updatedTransactions = [transaction, ...currentTransactions];
    
    const updatedBalance = {
      coins: (currentWallet.balance.coins || 0) - pack.price,
      coupons: (currentWallet.balance.coupons || 0) + pack.amount
    };

    return this.generateIndividualCoupons(pack, currentWallet).pipe(
      switchMap(walletWithCoupons => {
        return this.updateWallet({
          transactions: updatedTransactions,
          balance: updatedBalance,
          coupons: walletWithCoupons.coupons || []
        });
      })
    );
  }

  /**
 * Met à jour les transactions du wallet de l'administrateur système
 * @param transactions - Nouvelles transactions à ajouter ou remplacer
 * @param replace - Si true, remplace toutes les transactions; si false, ajoute à l'existant
 */
updateAdminWalletTransactions(transactions: Transaction[], replace: boolean = false): Observable<Wallet> {
  
  return this.auth.getAdminUID().pipe(
    switchMap(adminId => {
      if (!adminId) {
        return throwError(() => new Error('Admin UID not found'));
      }

      // Récupérer le wallet de l'admin
      return this.api.get<Wallet>(this.WALLET_RESOURCE, { userId: adminId }).pipe(
        map(response => {
          if (Array.isArray(response)) {
            return response.length > 0 ? response[0] : null;
          }
          return response;
        }),
        switchMap(adminWallet => {
          if (!adminWallet) {
            // Créer le wallet de l'admin s'il n'existe pas
            return this.createWallet(adminId);
          }
          return of(adminWallet);
        }),
        switchMap(adminWallet => {
          const currentTransactions = Array.isArray(adminWallet.transactions) ? adminWallet.transactions : [];
          const updatedTransactions = replace ? transactions : [...transactions, ...currentTransactions];

          return this.api.update<Wallet>(this.WALLET_RESOURCE, adminWallet.id, {
            transactions: updatedTransactions
          });
        }),
        catchError(error => {
          console.error('❌ Erreur lors de la mise à jour des transactions du wallet admin:', error);
          return throwError(() => new Error(`Failed to update admin wallet transactions: ${error.message}`));
        })
      );
    })
  );
}

 /**
 * Crée une transaction d'utilisation de coupon et l'ajoute au wallet de l'administrateur
 * @param couponId - ID du coupon utilisé
 * @param usageValue - Valeur d'utilisation du coupon
 * @param userId - ID de l'utilisateur qui utilise le coupon
 * @param contentId - ID du contenu concerné (optionnel)
 * @param challengeId - ID du challenge concerné (optionnel)
 * @returns Observable<Wallet> - Le wallet de l'admin mis à jour
 */
createCouponUsageTransaction(
  couponId: string, 
  usageValue: number, 
  userId: string, 
  contentId?: string, 
  challengeId?: string
): Observable<Wallet> {
  
  // Créer la transaction d'utilisation
  const transaction: Transaction = {
    id: 'TR_'+couponId,
    walletId: `admin_${this.auth.getAdminUID()}`, // Référence au wallet admin
    type: 'usage',
    amount: usageValue,
    itemType: 'coupons',
    description: `Utilisation de coupon ${couponId} par utilisateur ${userId}`,
    date: new Date().toISOString(),
    metadata: {
      couponId,
      userId,
      contentId,
      challengeId,
      usageValue,
      actionType: 'coupon_usage'
    }
  };

  // Ajouter cette transaction au wallet de l'admin
  return this.updateAdminWalletTransactions([transaction], false);
}

}
