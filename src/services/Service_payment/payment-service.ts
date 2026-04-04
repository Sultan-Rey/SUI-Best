import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiJSON } from '../API/api-json';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface PaymentRequest {
  orderId: string;
  amount: number;
}

export interface PaymentResponse {
  orderId: string;
  amount: number;
  redirect_url: string;
}

// ─── Interfaces PayPal ────────────────────────────────────────────────────────

export interface PaypalCreateResponse {
  orderId: string;
  approvalUrl: string;
}

export interface PaypalCaptureResponse {
  id: string;
  status: string;
  [key: string]: any;
}

export interface PaymentVerificationRequest {
  transactionId: string;
}

export interface PaymentVerificationResponse {
  transactionId: string;
  status: string;
  amount?: number;
  orderId?: string;
  timestamp?: string;
  [key: string]: any;
}

export interface PaymentCallbackResponse {
  status: string;
  transactionId: string;
}

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  
  constructor(private api: ApiJSON) {}

  // ─── Créer un paiement ────────────────────────────────────────────────────────
  /**
   * Crée un nouveau paiement MonCash
   * @param paymentRequest - Contient orderId et amount
   * @returns Observable<PaymentResponse> - URL de paiement et détails
   */
  createPayment(paymentRequest: PaymentRequest): Observable<PaymentResponse> {
    return this.api.post<PaymentResponse>('payment/create', paymentRequest).pipe(
      catchError(error => {
        console.error('Erreur lors de la création du paiement:', error);
        return throwError(() => new Error('Impossible de créer le paiement'));
      })
    );
  }

  // ─── Vérifier un paiement ───────────────────────────────────────────────────────
  /**
   * Vérifie le statut d'un paiement
   * @param transactionId - ID de transaction MonCash
   * @returns Observable<PaymentVerificationResponse> - Détails du paiement
   */
  verifyPayment(transactionId: string): Observable<PaymentVerificationResponse> {
    return this.api.post<PaymentVerificationResponse>('payment/verify', { transactionId }).pipe(
      catchError(error => {
        console.error('Erreur lors de la vérification du paiement:', error);
        return throwError(() => new Error('Impossible de vérifier le paiement'));
      })
    );
  }

  /**
   * Vérifie un paiement MonCash par orderId
   * @param orderId - ID de commande
   * @returns Observable<{success: boolean, data?: PaymentVerificationResponse}> - Résultat de la vérification
   */
  verifyMonCashPayment(orderId: string): Observable<{success: boolean, data?: PaymentVerificationResponse}> {
    return this.api.post<{success: boolean, data?: PaymentVerificationResponse}>('payment/verify/order', { orderId }).pipe(
      catchError(error => {
        console.error('Erreur lors de la vérification du paiement par orderId:', error);
        return throwError(() => new Error('Impossible de vérifier le paiement'));
      })
    );
  }

  // ─── Callback de paiement ───────────────────────────────────────────────────────
  /**
   * Gère le callback de MonCash (généralement appelé par le serveur)
   * @param transactionId - ID de transaction
   * @returns Observable<PaymentCallbackResponse> - Confirmation de réception
   */
  handlePaymentCallback(transactionId: string): Observable<PaymentCallbackResponse> {
    return this.api.post<PaymentCallbackResponse>('payment/callback', { transactionId }).pipe(
      catchError(error => {
        console.error('Erreur lors du callback de paiement:', error);
        return throwError(() => new Error('Erreur lors du traitement du callback'));
      })
    );
  }

  // ─── Méthodes utilitaires ───────────────────────────────────────────────────────

  /**
   * Génère un ID de commande unique
   * @returns string - ID de commande formaté
   */
  generateOrderId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `ORDER-${timestamp}-${random}`;
  }

  /**
   * Valide les données de paiement avant envoi
   * @param paymentRequest - Données à valider
   * @returns boolean - true si valide
   */
  validatePaymentRequest(paymentRequest: PaymentRequest): boolean {
    return !!(
      paymentRequest.orderId &&
      paymentRequest.amount &&
      paymentRequest.amount > 0 &&
      typeof paymentRequest.amount === 'number'
    );
  }

  /**
   * Formate le montant pour MonCash (format décimal)
   * @param amount - Montant à formater
   * @returns number - Montat formaté
   */
  formatAmount(amount: number): number {
    return Math.round(amount * 100) / 100; // 2 décimales max
  }

  /**
   * Crée un paiement complet avec validation
   * @param amount - Montant du paiement
   * @returns Observable<PaymentResponse> - Résultat de la création
   */
  createValidatedPayment(amount: number): Observable<PaymentResponse> {
    const formattedAmount = this.formatAmount(amount);
    const orderId = this.generateOrderId();
    
    const paymentRequest: PaymentRequest = {
      orderId,
      amount: formattedAmount
    };

    if (!this.validatePaymentRequest(paymentRequest)) {
      return throwError(() => new Error('Données de paiement invalides'));
    }

    return this.createPayment(paymentRequest);
  }


  // ─── PayPal ───────────────────────────────────────────────────────────────────

  createPaypalOrder(amount: number, currency: string = 'USD'): Observable<PaypalCreateResponse> {
    return this.api.post<PaypalCreateResponse>('payment/paypal-create', { amount, currency }).pipe(
      catchError(error => {
        console.error('Erreur création PayPal:', error);
        return throwError(() => new Error('Impossible de créer le paiement PayPal'));
      })
    );
  }

  capturePaypalOrder(orderID: string): Observable<PaypalCaptureResponse> {
    return this.api.post<PaypalCaptureResponse>('payment/paypal-capture', { orderID }).pipe(
      catchError(error => {
        console.error('Erreur capture PayPal:', error);
        return throwError(() => new Error('Impossible de capturer le paiement PayPal'));
      })
    );
  }

  getPaypalStatus(orderId: string): Observable<any> {
    return this.api.get<any>(`payment/paypal-status?order_id=${orderId}`).pipe(
      catchError(error => {
        console.error('Erreur statut PayPal:', error);
        return throwError(() => new Error('Impossible de vérifier le statut PayPal'));
      })
    );
  }
  
}
