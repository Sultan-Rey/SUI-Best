import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { PaymentGatewayService } from 'src/services/Service_payment/payment-gateway-service';

@Component({
  selector: 'app-payment-callback',
  templateUrl: './payment-callback.page.html',
  styleUrls: ['./payment-callback.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class PaymentCallbackPage implements OnInit {

  constructor(private router:Router, private route:ActivatedRoute, private paymentGateway:PaymentGatewayService) { }

  async ngOnInit() {
  const transactionId = this.route.snapshot.queryParams['transactionId'];
  const token = this.route.snapshot.queryParams['token']; // PayPal
  const orderId = sessionStorage.getItem('pending_order_id');
  const method = sessionStorage.getItem('pending_payment_method') as 'moncash' | 'paypal';
  const context = JSON.parse(sessionStorage.getItem('pending_payment_context') || '{}');

  // Nettoie immédiatement
  sessionStorage.removeItem('pending_order_id');
  sessionStorage.removeItem('pending_payment_method');
  sessionStorage.removeItem('pending_payment_context');

  if (!orderId || !method) {
    this.router.navigate(['/home']);
    return;
  }

  const urlObj = new URL(window.location.href);
  const result = await this.paymentGateway.verifyPayment(method, urlObj, orderId);

  sessionStorage.setItem('payment_result', JSON.stringify({ ...result, context }));

  const route = result.success
    ? (context.redirectOnSuccess || '/home')
    : (context.redirectOnFailure || '/home');

  this.router.navigate([route]);
}

}
