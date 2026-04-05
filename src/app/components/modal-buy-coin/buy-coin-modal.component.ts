import { Component, OnInit } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { MediaUrlPipe } from '../../utils/pipes/mediaUrlPipe/media-url-pipe';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonButtons, IonButton, IonIcon } from '@ionic/angular/standalone';
import { ModalController, ToastController, LoadingController, ActionSheetController } from '@ionic/angular';
import { Router } from '@angular/router';
import { WalletService } from '../../../services/Service_wallet/wallet-service';
import { IncomeService } from 'src/services/service_income/income-service';
import { PaymentService } from '../../../services/Service_payment/payment-service';
import { Pack, PaymentMethod } from 'src/interfaces/income.interfaces';
import { cardOutline, logoPaypal, cashOutline, chevronBack, chevronForward, close, closeOutline, alertCircle, refresh, cubeOutline, sparklesOutline, refreshOutline, chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { firstValueFrom } from 'rxjs';
import { Browser } from '@capacitor/browser';
import { ModalPaymentComponent } from '../modal-payment/modal-payment.component';

@Component({
  selector: 'app-buy-coin-modal',
  templateUrl: './buy-coin-modal.component.html',
  styleUrls: ['./buy-coin-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MediaUrlPipe,
    IonContent,
    NgIf,
    IonIcon
  ]
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
    private walletService: WalletService,
    private incomeService: IncomeService,
    private paymentService: PaymentService
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
     const modal = await this.modalController.create({
          component: ModalPaymentComponent,
          cssClass: 'auto-height',
          componentProps:{OrderAmount: pack.price},
          initialBreakpoint: 0.90,
          breakpoints: [0, 0.90, 1],
          handle: true
        });
        
        await modal.present();
    //await this.showPaymentMethods(pack);
  }

  async showPaymentMethods(pack: Pack) {
    const actionSheet = await this.actionSheetController.create({
      header: 'Méthode de Paiement',
      buttons: [
        {
          text: 'Carte Bancaire (in-app)',
          icon: 'card-outline',
          handler: () => this.processPayment(pack, 'gpay')
        },
        {
          text: 'PayPal',
          icon: 'logo-paypal',
          handler: () => this.processPayment(pack, 'paypal')
        },
        {
          text: 'MonCash',
          icon: 'cash-outline',
          handler: () => this.processPayment(pack, 'moncash')
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
    if (this.isProcessingPayment) return;

    this.isProcessingPayment = true;
    this.paymentStatus = 'preparing';
    this.paymentMessage = 'Préparation de votre achat...';
    
    let loading: HTMLIonLoadingElement | null = null;
    
    try {
      loading = await this.loadingController.create({
        message: this.paymentMessage,
        spinner: 'circles',
        backdropDismiss: false
      });
      await loading.present();

      if (paymentMethod === 'moncash') {
        await this.processMonCashPayment(pack, loading);
      } else if(paymentMethod == 'paypal') {
        await this.processPaypalPayment(pack, loading);
      }else{
        
      }
    } catch (error) {
      await this.handlePaymentError(error, loading);
    } finally {
      this.isProcessingPayment = false;
      if (loading) {
        await loading.dismiss();
      }
      
      setTimeout(() => {
        this.paymentStatus = 'idle';
        this.paymentMessage = '';
      }, 3000);
    }
  }

  private async processMonCashPayment(pack: Pack, loading: HTMLIonLoadingElement): Promise<void> {
    try {
      this.paymentStatus = 'processing';
      this.paymentMessage = 'Connexion à MonCash...';
      
      await loading.dismiss();
      loading = await this.loadingController.create({
        message: this.paymentMessage,
        spinner: 'circles',
        duration: 10000,
        backdropDismiss: false
      });
      await loading.present();

      const paymentResponse = await firstValueFrom(
        this.paymentService.createValidatedPayment(pack.price)
      );

      this.paymentMessage = 'Redirection vers MonCash...';
      await loading.dismiss();
      console.log("reponse payment : ", paymentResponse);
      
      // Stocker l'URL actuelle dans le localStorage pour pouvoir y revenir après le paiement
      this.returnUrl = this.router.url;
      localStorage.setItem('moncash_return_url', this.returnUrl);
      
      // Ouvrir la page de paiement MonCash avec Capacitor Browser
      await Browser.open({ 
        url: paymentResponse.redirect_url,
        windowName: '_self',
        presentationStyle: 'popover'
      });

      // Attendre un peu pour que le navigateur s'ouvre
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error('MonCash payment error:', error);
      throw error;
    }
  }

  private async processPaypalPayment(pack: Pack, loading: HTMLIonLoadingElement): Promise<void> {
  try {
    this.paymentStatus = 'processing';
    this.paymentMessage = 'Connexion à PayPal...';

    await loading.dismiss();
    loading = await this.loadingController.create({
      message: this.paymentMessage,
      spinner: 'circles',
      duration: 10000,
      backdropDismiss: false
    });
    await loading.present();

    const paymentResponse = await firstValueFrom(
      this.paymentService.createPaypalOrder(pack.price)
    );

    this.paymentMessage = 'Redirection vers PayPal...';
    await loading.dismiss();
    console.log("reponse PayPal : ", paymentResponse);

    // Ouvrir la page PayPal avec Capacitor Browser
    await Browser.open({
      url: paymentResponse.approvalUrl,
      windowName: '_self',
      presentationStyle: 'popover'
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

  } catch (error) {
    console.error('PayPal payment error:', error);
    throw error;
  }
}




 

  private async processOtherPayment(pack: Pack, paymentMethod: string, loading: HTMLIonLoadingElement): Promise<void> {
      await new Promise(resolve => setTimeout(resolve, 800));
      this.paymentStatus = 'processing';
      this.paymentMessage = `Paiement de ${pack.amount} coins en cours...`;
      
      await loading.dismiss();
      loading = await this.loadingController.create({
        message: this.paymentMessage,
        spinner: 'circles',
        backdropDismiss: false
      });
      await loading.present();
      
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      this.paymentMessage = 'Finalisation de votre achat...';
      await loading.dismiss();
      loading = await this.loadingController.create({
        message: this.paymentMessage,
        spinner: 'circles',
        backdropDismiss: false
      });
      await loading.present();
      
      const updatedWallet = await firstValueFrom(this.walletService.purchasePackCoins(pack, 'coins', paymentMethod));
      
      if (updatedWallet) {
        this.paymentStatus = 'success';
        this.paymentMessage = `✅ ${pack.amount} coins ajoutés à votre compte!`;
        await loading.dismiss();
        loading = await this.loadingController.create({
          message: this.paymentMessage,
          spinner: 'circles',
          backdropDismiss: false,
          duration: 2000
        });
        await loading.present();
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        this.showToast(`Achat de ${pack.amount} coins réussi!`, 'success');
        this.modalController.dismiss({ success: true, pack, wallet: updatedWallet });
      } else {
        throw new Error('Purchase failed - no wallet returned');
      }
  }

  private async handlePaymentError(error: any, loading: HTMLIonLoadingElement | null): Promise<void> {
    console.error('Payment error:', error);
    this.paymentStatus = 'error';
    
    let errorMessage = 'Erreur lors du paiement. Veuillez réessayer.';
    if (error instanceof Error && error.message?.includes('wallet')) {
      errorMessage = 'Impossible de préparer votre compte. Veuillez réessayer.';
    } else if (error instanceof Error && error.message?.includes('support')) {
      errorMessage = 'Un problème technique est survenu. Contactez le support.';
    } else if (error instanceof Error && error.message?.includes('MonCash')) {
      errorMessage = 'Erreur lors de la communication avec MonCash. Veuillez réessayer.';
    }
    
    this.paymentMessage = `❌ ${errorMessage}`;
    
    if (loading) {
      await loading.dismiss();
      const errorLoading = await this.loadingController.create({
        message: this.paymentMessage,
        spinner: 'circles',
        backdropDismiss: false,
        duration: 3000
      });
      await errorLoading.present();
    }
    
    this.showToast(errorMessage, 'error');
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
