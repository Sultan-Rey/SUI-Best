import { Component, OnInit, AfterViewInit, Input } from '@angular/core';
import { IonHeader, IonButton, IonToolbar, IonTitle, IonButtons, IonIcon, IonContent, IonImg } from "@ionic/angular/standalone";
import { ModalController } from '@ionic/angular';
import { NgIf} from '@angular/common';
declare var paypal: any;

@Component({
  selector: 'app-modal-payment',
  templateUrl: './modal-payment.component.html',
  styleUrls: ['./modal-payment.component.scss'],
  providers: [ModalController],
  imports: [NgIf,IonHeader, IonButton, IonToolbar, IonTitle, IonButtons, IonIcon, IonContent, IonImg ]
})
export class ModalPaymentComponent implements OnInit, AfterViewInit {
  selectedMethod: 'card' | 'moncash' | 'paypal' = 'card';
  @Input() OrderAmount!:number;
  constructor(private modalCtrl: ModalController) {}

  ngOnInit() {}

  ngAfterViewInit() {
 
  }

  initPayPalButton() {
  // 1. Vérification : Si PayPal n'est pas encore chargé par le navigateur
  if (typeof (window as any).paypal === 'undefined') {
    console.warn("SDK PayPal non prêt, nouvelle tentative dans 500ms...");
    setTimeout(() => this.initPayPalButton(), 500);
    return;
  }

  const container = document.getElementById('paypal-button-container');
  if (!container) return;

  // Nettoyage pour éviter les doublons de boutons
  container.innerHTML = '';

  (window as any).paypal.Buttons({
    createOrder: (data: any, actions: any) => {
      return actions.order.create({
        purchase_units: [{
          amount: {
            // Utilise l'input OrderAmount passé à la modale
            value: this.OrderAmount ? this.OrderAmount.toString() : '1.00'
          }
        }]
      });
    },
    onApprove: async (data: any, actions: any) => {
      // On récupère l'orderID pour le backend
      const orderID = data.orderID; 
      this.handleSuccess(orderID);
    },
    onError: (err: any) => {
      console.error('Erreur PayPal SDK:', err);
    }
  }).render('#paypal-button-container');
}

  handleSuccess(order: any) {
    console.log('Paiement réussi ! ID:', order.id);
    // Ici, appelle ton service backend pour créditer les coins à l'utilisateur
  }

  selectMethod(method: 'card' | 'moncash' | 'paypal') {
    this.selectedMethod = method;
    
    // Si PayPal est sélectionné, on attend un tick pour laisser le container apparaître
    if (method === 'paypal') {
      setTimeout(() => this.initPayPalButton(), 100);
    }
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  proceedToPayment() {
    if (this.selectedMethod === 'card') {
      console.log('Ouverture Stripe Checkout...');
    } else if (this.selectedMethod === 'moncash') {
      console.log('Appel API MonCash /payment/create...');
    }
  }

  initPayPal() {
    // Vérifier si le bouton n'est pas déjà rendu
    const container = document.getElementById('paypal-button-container');
    if (container && container.innerHTML === '') {
      // Ton code d'initialisation PayPal ici (vu précédemment)
    }
  }
}
