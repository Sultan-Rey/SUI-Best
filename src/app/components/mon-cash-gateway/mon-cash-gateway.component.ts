import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { SafePipe } from './safe-url.pipe';
import { IonIcon}  from '@ionic/angular/standalone';
import {closeOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';
@Component({
  selector: 'app-mon-cash-gateway',
  templateUrl: './mon-cash-gateway.component.html',
  styleUrls: ['./mon-cash-gateway.component.scss'],
  standalone: true,
  imports: [SafePipe, IonIcon]
})
export class MonCashGatewayComponent implements OnInit {
  
  @Input() paymentUrl: string = '';
  @Output() paymentCompleted = new EventEmitter<{success: boolean, orderId?: string}>();
  @Output() paymentCancelled = new EventEmitter<void>();

  constructor() {
      addIcons({closeOutline}); }

  ngOnInit() { addIcons({closeOutline});}

  closePayment() {
    this.paymentCancelled.emit();
  }

  // Cette méthode sera appelée depuis l'iframe via postMessage
  onPaymentMessage(event: MessageEvent) {
    // Vérifier que le message vient de MonCash
    if (event.origin.includes('moncashbutton.digicelgroup.com')) {
      const data = event.data;
      
      if (data.status === 'success') {
        this.paymentCompleted.emit({
          success: true,
          orderId: data.orderId
        });
      } else if (data.status === 'cancelled') {
        this.paymentCancelled.emit();
      }
    }
  }

  ngOnDestroy() {
    // Nettoyer les écouteurs d'événements
    window.removeEventListener('message', this.onPaymentMessage.bind(this));
  }

  ngAfterViewInit() {
    // Écouter les messages de l'iframe
    window.addEventListener('message', this.onPaymentMessage.bind(this));
  }
}
