import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonImg, IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { ModalController, ToastController, LoadingController, ActionSheetController } from '@ionic/angular';
import { UserBalance, WalletService } from '../../../services/Service_wallet/wallet-service';
import { IncomeService } from '../../../services/service_income/income-service';
import { Pack } from '../../../interfaces/income.interfaces';
import { cardOutline, logoPaypal, ticket, cashOutline, close, schoolOutline, businessOutline, flash, timeOutline, checkmarkCircle, ticketOutline, layersOutline, walletOutline, logoBitcoin, alertCircleOutline, refreshOutline, lockClosed } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { Auth, AuthUser } from 'src/services/AUTH/auth';
import { ModalPaymentComponent } from '../modal-payment/modal-payment.component';

// Interface pour les packs avec informations du propriétaire
interface CouponPackWithOwner extends Pack {
  ownerName: string;
}

@Component({
  selector: 'app-buy-coupon-modal',
  templateUrl: './buy-coupon-modal.component.html',
  styleUrls: ['./buy-coupon-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonImg,
    IonIcon,
    IonSpinner
  ]
})
export class BuyCouponModalComponent implements OnInit {
  couponPacks: CouponPackWithOwner[] = [];
  isProcessingPayment = false;
  balance!: UserBalance;
  isLoading = true;
  loadingError: string | null = null;
  currentUser!: AuthUser;
  
  constructor(
    private modalController: ModalController,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private actionSheetController: ActionSheetController,
    private walletService: WalletService,
    private incomeService: IncomeService,
    private authService: Auth
  ) {
    this.balance = {} as UserBalance;
    this.balance = this.walletService.getBalance();
    addIcons({lockClosed, close,alertCircleOutline,refreshOutline,schoolOutline,layersOutline,businessOutline,ticketOutline,ticket,logoBitcoin,checkmarkCircle,flash,timeOutline,cardOutline,logoPaypal,cashOutline,walletOutline});
  }

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser() as AuthUser;
    this.loadCouponPacksFromAPI();
  }

  loadCouponPacksFromAPI() {
    this.isLoading = true;
    this.loadingError = null;
    
    this.incomeService.getCouponsPacks().subscribe({
      next: (packs: Pack[]) => {
        this.couponPacks = packs.map(pack => ({
          ...pack,
          ownerName: 'BEST Academy'
        }));
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des packs:', error);
        this.loadingError = 'Impossible de charger les packs. Veuillez réessayer.';
        this.isLoading = false;
      }
    });
  }

   getCouponIcon(type: string): string {
    const icons: { [key: string]: string } = {
      standard: 'ticket-outline',
      premium: 'star',
      legendary: 'trophy',
      special: 'sparkles'
    };
    return icons[type] || 'ticket-outline';
  }

   // Méthode de débogage pour vérifier l'état
   debugState() {
    console.log('isLoading:', this.isLoading);
    console.log('loadingError:', this.loadingError);
    console.log('couponPacks:', this.couponPacks);
   }

  retryLoading() {
    this.loadCouponPacksFromAPI();
  }

  async showPaymentMethods(pack: CouponPackWithOwner) {
    // const actionSheet = await this.actionSheetController.create({
    //   header: 'Méthode de Paiement',
    //   buttons: [
    //     {
    //       text: 'Gpay',
    //       icon: 'card-outline',
    //       handler: () => this.processPayment(pack, 'gpay')
    //     },
    //     {
    //       text: 'PayPal',
    //       icon: 'logo-paypal',
    //       handler: () => this.processPayment(pack, 'paypal')
    //     },
    //     {
    //       text: 'MonCash',
    //       icon: 'cash-outline',
    //       handler: () => this.processPayment(pack, 'moncash')
    //     },
    //     {
    //       text: 'Annuler',
    //       icon: 'close-outline',
    //       role: 'cancel'
    //     }
    //   ]
    // });

    // await actionSheet.present();

     if (this.isProcessingPayment) return;
         const modal = await this.modalController.create({
              component: ModalPaymentComponent,
              cssClass: 'auto-height',
              componentProps:{OrderAmount: pack.price},
              initialBreakpoint: 0.90,
              breakpoints: [0, 0.90, 1],
              handle: true
            });
            
            await modal.present();
  }

  async processPayment(pack: CouponPackWithOwner, paymentMethod: string) {
       if (this.isProcessingPayment) return;

    // Vérifier si l'utilisateur a assez de coins
    const currentBalance = this.walletService.getBalance();
    const requiredCoins = pack.price;
    
    if (!currentBalance || currentBalance.coins < requiredCoins) {
      const currentCoins = currentBalance?.coins || 0;
      this.showToast(`Solde insuffisant: ${currentCoins} / ${requiredCoins} coins requis`, 'error');
      return;
    }

    this.isProcessingPayment = true;
    const loading = await this.loadingController.create({
      message: 'Traitement du paiement...',
      spinner: 'circles',
      backdropDismiss: false
    });
    await loading.present();

    try {
      // Mise à jour du message de chargement pour plus de feedback
      loading.message = 'Communication avec le serveur...';
      
      // Utiliser walletService pour l'achat (il gère maintenant la mise à jour du pack)
      this.walletService.purchasePack(pack, 'coupons', paymentMethod, String(this.currentUser.id)).subscribe({
        next: (updatedWallet) => {
          // Succès de l'achat
          loading.message = 'Achat réussi! Mise à jour du solde...';
          
          // Mettre à jour la balance locale
          this.balance = this.walletService.getBalance();
          
          setTimeout(() => {
            loading.dismiss();
            this.showToast(`Achat de ${pack.amount} coupons réussi!`, 'success');
            
            // Fermer le modal avec succès
            this.modalController.dismiss({ 
              success: true, 
              pack: pack,
              newBalance: this.balance
            });
          }, 1000);
        },
        error: (error) => {
          console.error('Erreur lors de l\'achat:', error);
          loading.dismiss();
          
          // Messages d'erreur spécifiques
          let errorMessage = 'Erreur lors de l\'achat. Veuillez réessayer.';
          if (error.message?.includes('insufficient')) {
            errorMessage = 'Solde insuffisant pour cet achat.';
          } else if (error.message?.includes('network')) {
            errorMessage = 'Erreur réseau. Vérifiez votre connexion.';
          } else if (error.message?.includes('server')) {
            errorMessage = 'Erreur serveur. Veuillez réessayer plus tard.';
          }
          
          this.showToast(errorMessage, 'error');
        },
        complete: () => {
          this.isProcessingPayment = false;
        }
      });
      
    } catch (error) {
      console.error('Erreur inattendue:', error);
      loading.dismiss();
      this.showToast('Une erreur inattendue est survenue. Veuillez réessayer.', 'error');
      this.isProcessingPayment = false;
    }
  }

  async showToast(message: string, type: 'success' | 'error' | 'warning' = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color: type === 'success' ? 'success' : type === 'error' ? 'danger' : 'warning',
      cssClass: `custom-toast ${type}-toast`
    });
    await toast.present();
  }

  dismiss() {
    this.modalController.dismiss();
  }
}
