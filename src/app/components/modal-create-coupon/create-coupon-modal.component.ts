import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf, DecimalPipe } from '@angular/common';
import { ModalController, AlertController } from '@ionic/angular';
import { IncomeService } from 'src/services/INCOME_SERVICE/income-service';
import { WalletService } from 'src/services/WALLET_SERVICE/wallet-service';
import { CouponType } from 'src/models/Coupon';
import { Auth } from 'src/services/AUTH/auth';

export interface CouponPackConfig {
  type: CouponType;
  amount: number;
  customPrice?: number;
  discount?: number;
  name: string;
  description: string;
  expiryDays: number;
}

@Component({
  selector: 'app-create-coupon-modal',
  templateUrl: './create-coupon-modal.component.html',
  styleUrls: ['./create-coupon-modal.component.scss'],
  standalone: true,
  imports: [FormsModule, NgFor, NgIf, DecimalPipe]
})

export class CreateCouponModalComponent implements OnInit {
  @Output() packCreated = new EventEmitter<CouponPackConfig>();
  @Output() modalClosed = new EventEmitter<void>();

  // Taux de conversion: 1 HTG = 10 coins
  readonly CONVERSION_RATE = 10;

  // Getter pour garantir l'accès depuis le template
  get conversionRate(): number {
    return this.CONVERSION_RATE;
  }

  // Prix de référence en HTG pour chaque type (prix d'achat du système)
  readonly REFERENCE_PRICES: Record<CouponType, number> = {
    standard: 10,    // 10 HTG
    premium: 20,     // 20 HTG
    legendary: 50,   // 50 HTG
    special: 30      // 30 HTG
  };

  // Configuration du pack
  packConfig: CouponPackConfig = {
    type: 'standard',
    amount: 10,
    customPrice: undefined,
    discount: 0,
    name: '',
    description: '',
    expiryDays: 30
  };

  // Types disponibles avec leurs métadonnées
  couponTypes: Array<{
    type: CouponType;
    label: string;
    color: string;
    icon: string;
  }> = [
    { type: 'standard', label: 'Standard', color: '#64748b', icon: '⚡' },
    { type: 'premium', label: 'Premium', color: '#8b5cf6', icon: '💎' },
    { type: 'legendary', label: 'Legendary', color: '#f59e0b', icon: '👑' },
    { type: 'special', label: 'Special', color: '#ec4899', icon: '✨' }
  ];

  constructor(
    private modalController: ModalController, 
    private alertCtrl: AlertController,
    private incomeService: IncomeService,
    private walletService: WalletService,
    private auth: Auth
  ) {}

  // Getter pour la balance actuelle
  get currentBalance() {
    return this.walletService.getBalance();
  }

  ngOnInit() {
    this.updatePackName();
    // Initialiser le prix personnalisé avec le coût de base
    this.packConfig.customPrice = this.baseCostInCoins;
  }

  // Calcul du coût de base en coins (coût d'achat pour le système)
  get baseCostInCoins(): number {
    const priceInHTG = this.REFERENCE_PRICES[this.packConfig.type];
    return priceInHTG * this.packConfig.amount * this.CONVERSION_RATE;
  }

  // Prix de vente final (avec réduction appliquée au prix personnalisé)
  get finalSalePriceInCoins(): number {
    const basePrice = this.packConfig.customPrice !== undefined && this.packConfig.customPrice >= 0
      ? this.packConfig.customPrice
      : this.baseCostInCoins;

    const discount = this.packConfig.discount || 0;
    return Math.round(basePrice * (1 - discount / 100));
  }

  // Montant de la réduction en coins
  get discountAmount(): number {
    const basePrice = this.packConfig.customPrice !== undefined && this.packConfig.customPrice >= 0
      ? this.packConfig.customPrice
      : this.baseCostInCoins;
    
    return basePrice - this.finalSalePriceInCoins;
  }

  // Profit/perte par rapport au coût de base
  get profitAmount(): number {
    return this.finalSalePriceInCoins - this.baseCostInCoins;
  }

  // Pourcentage de profit
  get profitPercentage(): number {
    if (this.baseCostInCoins === 0) return 0;
    return Math.round((this.profitAmount / this.baseCostInCoins) * 100);
  }

  // Prix de référence en HTG
  get referencePriceHTG(): number {
    return this.REFERENCE_PRICES[this.packConfig.type];
  }

  // Obtenir le prix de référence pour un type spécifique
  getReferencePriceForType(type: CouponType): number {
    return this.REFERENCE_PRICES[type];
  }

  // Métadonnées du type sélectionné
  get selectedTypeMetadata() {
    return this.couponTypes.find(ct => ct.type === this.packConfig.type);
  }

  // Sélection du type
  selectType(type: CouponType) {
    const previousType = this.packConfig.type;
    this.packConfig.type = type;
    this.updatePackName();
    
    // Calculer le nouveau coût de base avec le type sélectionné
    const newBaseCost = this.REFERENCE_PRICES[type] * this.packConfig.amount * this.CONVERSION_RATE;
    
    // Réinitialiser le prix personnalisé avec le nouveau coût de base
    this.packConfig.customPrice = newBaseCost;
  }

  // Mise à jour automatique du nom du pack
  updatePackName() {
    if (!this.packConfig.name || this.isAutoGeneratedName(this.packConfig.name)) {
      const typeLabel = this.selectedTypeMetadata?.label || 'Standard';
      this.packConfig.name = `Pack ${typeLabel} x${this.packConfig.amount}`;
    }
  }

  // Vérifier si le nom est auto-généré
  private isAutoGeneratedName(name: string): boolean {
    return /^Pack (Standard|Premium|Legendary|Special) x\d+$/.test(name);
  }

  // Mise à jour de la quantité
  onAmountChange() {
    if (this.packConfig.amount < 1) {
      this.packConfig.amount = 1;
    }
    this.updatePackName();
    
    // Calculer le nouveau coût de base avec la nouvelle quantité
    const newBaseCost = this.REFERENCE_PRICES[this.packConfig.type] * this.packConfig.amount * this.CONVERSION_RATE;
    
    // Réinitialiser le prix personnalisé avec le nouveau coût de base
    this.packConfig.customPrice = newBaseCost;
  }

  // Mise à jour de la réduction
 onDiscountChange() {
    if (this.packConfig.discount !== undefined) {
      if (this.packConfig.discount < 0) {
        this.packConfig.discount = 0;
      }
      if (this.packConfig.discount > 100) {
        this.packConfig.discount = 100;
      }
    }
  }

  // Indicateur de chargement
  isCreating = false;

  // Création du pack
  createPack() {
    if (this.isFormValid()) {
      // Utiliser le coût d'achat réel (baseCostInCoins) pour la déduction de balance
      const requiredCoins = this.baseCostInCoins;
      
      // Vérifier si l'utilisateur a assez de coins
      const balance = this.currentBalance;
      if (!balance || balance.coins < requiredCoins) {
        const currentCoins = balance?.coins || 0;
        this.alertCtrl.create({
          header: 'Solde insuffisant',
          message: `Vous avez ${currentCoins} coins mais il en faut ${requiredCoins} coins pour créer ce pack.`,
          buttons: ['OK']
        }).then(alert => alert.present());
        return;
      }
      
      this.isCreating = true;
      
      this.incomeService.createPack({
        amount: this.packConfig.amount,
        couponType: this.packConfig.type,
        name: this.packConfig.name,
        isBestAcademy: false,
        ownerId: this.auth.getCurrentUser()?.id as string || 'user_current',
        price: requiredCoins,
        icon: this.selectedTypeMetadata?.icon || '⚡',
        itemType: 'coupons',
        promo: this.packConfig.discount ? this.packConfig.discount + "%" : undefined
      }).subscribe({
        next: (createdPack) => {
          //console.log('Pack créé avec succès:', createdPack);
          this.modalController.dismiss({ 
            ...this.packConfig, 
            success: true,
            createdPack: createdPack,
            price: requiredCoins
          });
        },
        error: (error) => {
          console.error('Erreur lors de la création du pack:', error);
          this.isCreating = false;
          // TODO: Afficher un message d'erreur à l'utilisateur
          // Pour l'instant, on pourrait utiliser un toast ou une alerte
          alert('Erreur lors de la création du pack. Veuillez réessayer.');
        }
      });
    }
  }

  // Validation du formulaire
  isFormValid(): boolean {
    return (
      this.packConfig.name.trim().length > 0 &&
      this.packConfig.amount > 0 &&
      this.packConfig.expiryDays > 0
    );
  }

  // Fermeture du modal
  closeModal() {
    this.modalController.dismiss();
  }

  // Format des nombres avec séparateurs
  formatNumber(num: number): string {
    return num.toLocaleString('fr-FR');
  }
}