import { Injectable } from '@angular/core';
import { InAppBrowser } from '@awesome-cordova-plugins/in-app-browser/ngx'; // Ajustez l'import selon votre version
import { firstValueFrom } from 'rxjs';
import { PaymentResult, PaymentService } from './payment-service';
import { Platform } from '@ionic/angular';
import { Router } from '@angular/router';
@Injectable({
  providedIn: 'root'
})
export class PaymentGatewayService {

  constructor(
    private iab: InAppBrowser,
    private platform: Platform,
    private router: Router,
    private paymentService: PaymentService // Votre service qui gère les requêtes HTTP (MonCash/PayPal)
  ) {}

  /**
   * Ouvre la passerelle de paiement et résout la promesse une fois le flux terminé.
   */
  public processPayment(url: string, method: 'moncash' | 'paypal', orderId: string = ''): Promise<PaymentResult> {
  if (this.platform.is('capacitor')) {
    return this.processMobile(url, method, orderId);
  }
  return this.processWeb(url, method, orderId);
}

private processWeb(url: string, method: 'moncash' | 'paypal', orderId: string): Promise<PaymentResult> {
  // La page va être détruite, la promesse ne résoudra jamais
  // C'est /payment/callback qui prend le relais
  window.location.href = url;
  return new Promise(() => {});
}

private processMobile(url: string, method: 'moncash' | 'paypal', orderId: string): Promise<PaymentResult> {
  return new Promise((resolve) => {
    const browser = this.iab.create(url, '_self', 'location=yes,clearsessioncache=yes,clearcache=yes,zoom=no');

    const subscription = browser.on('loadstart').subscribe({
      next: async (event: any) => {
        if (!event.url?.includes('apis.majorware.net/fallbacks/payment-success')) return;

        browser.close();
        subscription.unsubscribe();

        const urlObj = new URL(event.url);
        const result = await this.verifyPayment(method, urlObj, orderId);

        // Récupère la route depuis le contexte déjà stocké dans purchasePack
        const context = JSON.parse(sessionStorage.getItem('pending_payment_context') || '{}');

        // Même mécanique que le web : stocke et laisse la page de destination gérer
        sessionStorage.setItem('payment_result', JSON.stringify({ ...result, context }));
        
        const route = result.success
          ? (context.redirectOnSuccess || '/home')
          : (context.redirectOnFailure || '/home');

        // Nettoie
        sessionStorage.removeItem('pending_order_id');
        sessionStorage.removeItem('pending_payment_method');
        sessionStorage.removeItem('pending_payment_context');

        resolve(result);
        this.router.navigate([route]);
      },
      error: () => resolve({ success: false, method, error: 'Erreur navigateur.' })
    });

    browser.on('exit').subscribe(() => {
      setTimeout(() => {
        if (!subscription.closed) {
          subscription.unsubscribe();
          resolve({ success: false, method, error: 'Navigateur fermé par l\'utilisateur.' });
        }
      }, 500);
    });
  });
}

public async verifyPayment(method: 'moncash' | 'paypal', urlObj: URL, orderId: string): Promise<PaymentResult> {
  try {
    if (method === 'moncash') {
      const data = await firstValueFrom(this.paymentService.verifyMonCashPayment(orderId));
      return data?.success || data?.data?.status === 'successfully'
        ? { success: true, method, data }
        : { success: false, method, error: 'Paiement non validé MonCash.', data };
    }

    if (method === 'paypal') {
      const token = urlObj.searchParams.get('token');
      if (!token) return { success: false, method, error: 'Token PayPal manquant.' };
      const response = await firstValueFrom(this.paymentService.capturePaypalOrder(token));
      return response?.status === 'COMPLETED'
        ? { success: true, method, data: response }
        : { success: false, method, error: 'Capture PayPal invalide.', data: response };
    }

    return { success: false, method, error: 'Méthode inconnue.' };
  } catch {
    return { success: false, method, error: 'Erreur de vérification.' };
  }
}
}