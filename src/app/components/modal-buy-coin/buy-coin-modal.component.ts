import { Component, OnInit } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { InAppBrowser } from '@awesome-cordova-plugins/in-app-browser/ngx';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonButtons, IonButton, IonIcon } from '@ionic/angular/standalone';
import { ModalController, ToastController, LoadingController, ActionSheetController } from '@ionic/angular';
import { Router } from '@angular/router';
import { WalletService } from '../../../services/Service_wallet/wallet-service';
import { IncomeService } from 'src/services/service_income/income-service';
import { PaymentService } from '../../../services/Service_payment/payment-service';
import { Pack } from 'src/interfaces/income.interfaces';
import { cardOutline, logoPaypal, cashOutline, chevronBack, chevronForward, close, closeOutline, alertCircle, refresh, cubeOutline, sparklesOutline, refreshOutline, chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { ModalPaymentComponent } from '../modal-payment/modal-payment.component';
import { PaymentGatewayService } from 'src/services/Service_payment/payment-gateway-service';

@Component({
  selector: 'app-buy-coin-modal',
  templateUrl: './buy-coin-modal.component.html',
  styleUrls: ['./buy-coin-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    NgIf,
    IonIcon
  ],
  providers: [ModalController]
})
export class BuyCoinModalComponent implements OnInit {
  private returnUrl: string = '';
  coinPacks: Pack[] = [];
  selectedPaymentMethod: string = 'gpay';
  currentSlideIndex = 0;
  slidesData: { packs: Pack[] }[] = [];
  
  // États pour l'UX
  isLoading = true;
  hasError = false;
  errorMessage = '';
  isProcessingPayment = false;
  paymentStatus: 'idle' | 'preparing' | 'processing' | 'success' | 'error' = 'idle';
  paymentMessage = '';

  constructor(
    private modalController: ModalController,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private actionSheetController: ActionSheetController,
    private router: Router,
    private iab: InAppBrowser,
    private walletService: WalletService,
    private incomeService: IncomeService,
    private paymentGateway: PaymentGatewayService
  ) {
    addIcons({closeOutline,sparklesOutline,refreshOutline,chevronBackOutline,chevronForwardOutline,chevronBack,chevronForward,close,alertCircle,refresh,cubeOutline,cardOutline,logoPaypal,cashOutline});
 

  }

  ngOnInit() {
    this.loadCoinPacks();
  }

  loadCoinPacks() {
    this.isLoading = true;
    this.hasError = false;
    
    this.incomeService.getCoinsPacks().subscribe({
      next: (packs) => {
        this.coinPacks = packs;
        this.prepareSlides();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des packs:', error);
        this.hasError = true;
        this.errorMessage = 'Impossible de charger les packs de coins. Veuillez réessayer.';
        this.isLoading = false;
      }
    });
  }

  prepareSlides() {
    // Grouper les packs par 2 par slide
    this.slidesData = [];
    for (let i = 0; i < this.coinPacks.length; i += 2) {
      this.slidesData.push({
        packs: this.coinPacks.slice(i, i + 2)
      });
    }
  }

  // Getters pour l'état des packs
  get hasPacks(): boolean {
    return this.coinPacks.length > 0;
  }

  get showEmptyState(): boolean {
    return !this.isLoading && !this.hasError && !this.hasPacks;
  }

  retryLoad() {
    this.loadCoinPacks();
  }

  nextSlide() {
    if (this.currentSlideIndex < this.slidesData.length - 1) {
      this.currentSlideIndex++;
    }
  }

  prevSlide() {
    if (this.currentSlideIndex > 0) {
      this.currentSlideIndex--;
    }
  }

  goToSlide(index: number) {
    this.currentSlideIndex = index;
  }

 async purchasePack(pack: Pack) {
  if (this.isProcessingPayment) return;
  this.isProcessingPayment = true;

  try {
    const modal = await this.modalController.create({
      component: ModalPaymentComponent,
      cssClass: 'auto-height',
      componentProps: { OrderAmount: Number(pack.price) },
      initialBreakpoint: 0.90,
      breakpoints: [0, 0.90, 1],
      handle: true
    });

    await modal.present();
    const { data } = await modal.onDidDismiss();

    if (!data?.paymentUrl) return;

    // ── Stocke le contexte métier complet avant toute redirection ──
    sessionStorage.setItem('pending_order_id', data.extra);
    sessionStorage.setItem('pending_payment_method', data.method);
    sessionStorage.setItem('pending_payment_context', JSON.stringify({
      reason: 'purchase_pack',
      pack: {
        id: pack.id,
        name: pack.name,
        amount: pack.amount,
        itemType: pack.itemType,
        couponType: pack.couponType,
      },
      redirectOnSuccess: '/home',
      redirectOnFailure: '/home',
    }));

    // ── Ouvre la passerelle ──
    const result = await this.paymentGateway.processPayment(data.paymentUrl, data.method, data.extra);
    if (result.success) {
          this.modalController.dismiss({success:true});
         
        }else{
          this.errorMessage = "Payment of coins failed";
        }
  } finally {
    this.isProcessingPayment = false;
  }
}



 

 

 getIconByPrice(price: number): string {
    if (price < 100) {
      return 'assets/images/coins/coin_unit.png';
    } else if (price < 200) {
      return 'assets/images/coins/stack_coins.png';
    } else if (price < 500) {
      return 'assets/images/coins/bag_coins.png';
    } else if (price < 1000) {
      return 'assets/images/coins/one_gems.png';
    } else if (price < 2000) {
      return 'assets/images/coins/treasure-chest.png';
    }else if (price < 5000) {
      return 'assets/images/coins/two_diamonds.png';
    }
    else {
      return 'assets/images/coins/diamond_bag.png';
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
