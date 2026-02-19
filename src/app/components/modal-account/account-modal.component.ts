import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonBackButton, IonToolbar, IonSegment, IonSegmentButton, IonList, IonItem, IonRadioGroup, IonRadio, IonThumbnail, IonLabel, IonButton, IonButtons, IonIcon, IonInput } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { ToastController, LoadingController, ModalController, ActionSheetController } from '@ionic/angular';
import { WalletService, UserBalance } from '../../../services/WALLET_SERVICE/wallet-service';
import { Pack, CouponTypeInfo } from '../../../interfaces/income.interfaces';
import { Observable } from 'rxjs';
import { CreateCouponModalComponent } from '../modal-create-coupon/create-coupon-modal.component';
import { BuyCoinModalComponent } from '../modal-buy-coin/buy-coin-modal.component';
import { cardOutline, timeOutline, ticket, receiptOutline, logoPaypal, cashOutline, close, ticketOutline, chevronForwardOutline, walletOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { BuyCouponModalComponent } from '../modal-buy-coupon/buy-coupon-modal.component';
import { TransactionHistoryModalComponent } from '../modal-transaction-history/transaction-history-modal.component';
import { Auth } from 'src/services/AUTH/auth';

@Component({
  selector: 'app-account-modal',
  templateUrl: './account-modal.component.html',
  styleUrls: ['./account-modal.component.scss'],
  standalone: true,
  providers: [ModalController],
  imports: [
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    CommonModule, 
    FormsModule
  ]
})
export class AccountModalComponent  implements OnInit {
 // Observable streams
  balance$!: Observable<UserBalance>;
  couponTypes$!: Observable<CouponTypeInfo[]>;
  // Current balance (for template binding)
  userBalance: UserBalance = { coins: 0, coupons: 0 };
  
  // Animation states
  isCoinsCounting = false;
  isCouponsCounting = false;
  // Loading states
  isProcessingPayment = false;
  constructor(private router: Router,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private actionSheetController: ActionSheetController,
    private modalController: ModalController,
    private authService: Auth,
    private walletService: WalletService) { addIcons({close, receiptOutline,ticket,chevronForwardOutline,walletOutline,ticketOutline,cardOutline,timeOutline,logoPaypal,cashOutline}); }

  ngOnInit() {
    // Initialize observables
    this.balance$ = this.walletService.balance$;
    this.couponTypes$ = this.walletService.couponTypes$;
    
    // Subscribe to balance changes with animation
    this.balance$.subscribe(balance => {
      const previousCoins = this.userBalance.coins;
      const previousCoupons = this.userBalance.coupons;
      
      this.userBalance = balance || { coins: 0, coupons: 0 };
      
      // Trigger animation if values changed
      if (previousCoins !== this.userBalance.coins) {
        this.isCoinsCounting = true;
        setTimeout(() => this.isCoinsCounting = false, 800);
      }
      
      if (previousCoupons !== this.userBalance.coupons) {
        this.isCouponsCounting = true;
        setTimeout(() => this.isCouponsCounting = false, 800);
      }
    });
  }

  goToHistory() {
    this.modalController.dismiss();
    this.modalController.create({
      component: TransactionHistoryModalComponent,
      componentProps: {
        walletId: this.authService.getCurrentUser()?.id as string || ''
      }
    }).then(modal => modal.present());
  }

    async showPaymentMethods(pack: Pack) {
    const actionSheet = await this.actionSheetController.create({
      header: 'Méthode de Paiement',
      buttons: [
        {
          text: 'Gpay',
          icon: 'card-outline',
          handler: () => {
            this.processPayment(pack, 'gpay');
          }
        },
        {
          text: 'PayPal',
          icon: 'logo-paypal',
          handler: () => {
            this.processPayment(pack, 'paypal');
          }
        },
        {
          text: 'MonCash',
          icon: 'cash-outline',
          handler: () => {
            this.processPayment(pack, 'moncash');
          }
        },
        {
          text: 'Annuler',
          icon: 'close-outline',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  async processPayment(pack: Pack, paymentMethod: string) {
    if (this.isProcessingPayment) {
      return;
    }

    this.isProcessingPayment = true;
    const loading = await this.loadingController.create({
      message: 'Traitement du paiement...',
      spinner: 'circles'
    });
    await loading.present();

    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Purchase the pack with correct parameters
     const success = true;
      
      if (success) {
        // Show success message
        this.showToast(
          `Achat de 500 coins`,
          'success'
        );
        
        // Animate balance update
        this.animateBalanceUpdate();
      } else {
        throw new Error('Purchase failed');
      }
      
    } catch (error) {
      console.error('Payment error:', error);
      this.showToast(
        'Erreur lors du paiement. Veuillez réessayer.',
        'error'
      );
    } finally {
      this.isProcessingPayment = false;
      await loading.dismiss();
    }
  }

  // Animate balance update
  private animateBalanceUpdate() {
    const balanceCards = document.querySelectorAll('.balance-card');
    balanceCards.forEach(card => {
      card.classList.add('success-animation');
      setTimeout(() => {
        card.classList.remove('success-animation');
      }, 300);
    });
  }
  
  // Show toast notification
  private async showToast(message: string, type: 'success' | 'error' | 'warning' = 'success') {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'bottom',
      color: type === 'success' ? 'success' : type === 'error' ? 'danger' : 'warning',
      cssClass: `custom-toast ${type}-toast`
    });
    await toast.present();
  }

  // Créer des coupons
  async createCoupon() {
    const modal = await this.modalController.create({
      component: CreateCouponModalComponent,
      componentProps: {}
    });
    
    await modal.present();
    
    modal.onDidDismiss().then((data) => {
      if (data.data && data.data.success) {
        // Le pack a été créé avec succès, maintenant on déduit les coins et ajoute les coupons
        this.walletService.deductCoins(data.data.price).subscribe({
          next: () => {
            this.walletService.addCoupons(data.data.amount);
            this.animateBalanceUpdate();
            this.showToast('Pack de coupons créé avec succès!', 'success');
          },
          error: (error) => {
            console.error('Erreur lors de la déduction de coins:', error);
            this.showToast('Erreur lors du paiement du pack', 'error');
          }
        });
      } else if (data.data && !data.data.success) {
        // Le modal s'est fermé mais la création a échoué
        this.showToast('Erreur lors de la création du pack', 'error');
      }
      // Si data.data est null, l'utilisateur a simplement fermé le modal
    });
  }

  // Acheter des coins
  async buyCoins() {
    const modal = await this.modalController.create({
      component: BuyCoinModalComponent,
      componentProps: {},
      cssClass: 'buy-coin-modal',
      initialBreakpoint: 0.5,
      breakpoints: [0, 0.5, 1],
      backdropDismiss: true
    });
    
    await modal.present();
    
    modal.onDidDismiss().then((data) => {
      if (data.data && data.data.success) {
        //console.log('Achat de coins réussi, rechargement du wallet...');
        this.showToast('Achat de coins effectué avec succès!', 'success');
        
        // Forcer le rechargement du wallet pour mettre à jour la balance
        this.walletService.reloadWallet();
        
        // Mettre à jour le solde si nécessaire
        this.animateBalanceUpdate();
      }
    });
  }

  // Acheter des coupons
  async buyCoupons() {
    const modal = await this.modalController.create({
      component: BuyCouponModalComponent,
      componentProps: {},
      cssClass: 'buy-coupon-modal',
    });
    
    await modal.present();
    
    modal.onDidDismiss().then((data) => {
      if (data.data && data.data.success) {
        console.log('Achat de coins réussi:', data.data.pack);
        this.showToast('Achat de coins effectué avec succès!', 'success');
        // Mettre à jour le solde si nécessaire
        this.animateBalanceUpdate();
      }
    });
  }
  // Fermer le modal
  dismiss() {
    this.modalController.dismiss();
  }

}
