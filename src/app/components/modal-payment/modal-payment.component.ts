import { Component, OnInit, AfterViewInit, Input } from '@angular/core';
import { IonHeader, IonButton, IonToolbar, IonTitle, IonButtons, IonIcon, IonContent, IonImg, ToastController, LoadingController, IonBadge } from "@ionic/angular/standalone";
import { ModalController } from '@ionic/angular';
import { NgIf } from '@angular/common';
import { Browser } from '@capacitor/browser';
import { firstValueFrom } from 'rxjs';
import { PaymentService } from 'src/services/Service_payment/payment-service';

@Component({
  selector: 'app-modal-payment',
  templateUrl: './modal-payment.component.html',
  styleUrls: ['./modal-payment.component.scss'],
  providers: [ModalController],
  imports: [IonBadge, NgIf, IonHeader, IonButton, IonToolbar, IonTitle, IonButtons, IonIcon, IonContent, IonImg]
})
export class ModalPaymentComponent implements OnInit, AfterViewInit {
  paymentMessage = '';
  selectedMethod: 'card' | 'moncash' | 'paypal' = 'card';
  @Input() OrderAmount!: number;
  constructor(private modalCtrl: ModalController,
    private toastController: ToastController,
    private paymentService: PaymentService,
    private loadingController: LoadingController) { }

  ngOnInit() { }

  ngAfterViewInit() {

  }


  selectMethod(method: 'card' | 'moncash' | 'paypal') {
    this.selectedMethod = method;

    // Si PayPal est sélectionné, on attend un tick pour laisser le container apparaître
    if (method === 'paypal') {

    }
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  async proceedToPayment() {
    if (!this.OrderAmount || this.OrderAmount <= 0) {
      this.showToast(`valeur montant invalaide!`, 'error');
      return;
    }
    let URL: string = '';

    try {
      if (this.selectedMethod === 'card') {
        console.log('Ouverture Stripe Checkout...');
      } else if (this.selectedMethod === 'moncash') {
        this.paymentMessage = 'Connexion à MonCash...';
        const paymentResponse = await firstValueFrom(
          this.paymentService.createValidatedPayment(this.OrderAmount)
        );
        this.paymentMessage = 'Redirection vers MonCash...';
        URL = paymentResponse.redirect_url;
      } else if (this.selectedMethod === 'paypal') {
        this.paymentMessage = 'Connexion à PayPal...';
        const paymentResponse = await firstValueFrom(
          this.paymentService.createPaypalOrder(this.OrderAmount)
        );
        this.paymentMessage = 'Redirection vers PayPal...';
        URL = paymentResponse.approvalUrl;
      }

      await Browser.open({
        url: URL,
        windowName: '_self',
        presentationStyle: 'popover'
      });
      // Attendre un peu pour que le navigateur s'ouvre
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error('Payment error:', error);
      throw error;
    } finally {
      this.dismiss();
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

}
