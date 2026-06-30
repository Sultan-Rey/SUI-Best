// coin-confirmation.component.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-coin-confirmation',
  template: `
    <div class="coin-confirmation-modal">
      <div class="modal-content">
        <div class="icon-container">🪙</div>
        
        <h2 class="title">Confirmation d'achat</h2>
        
        <p class="description">
          Voulez-vous utiliser <strong>{{ coinCost }}</strong> coins
          pour débloquer <strong>"{{ contentTitle }}"</strong> ?
        </p>
        
        <div class="balance-info">
          <span class="label">Solde actuel :</span>
          <span class="value">{{ currentBalance }} coins</span>
        </div>
        
        <div class="balance-info" [class.insufficient]="isInsufficient">
          <span class="label">Coût :</span>
          <span class="value">{{ coinCost }} coins</span>
        </div>
        
        <div class="balance-info" [class.insufficient]="isInsufficient">
          <span class="label">Reste :</span>
          <span class="value" [style.color]="isInsufficient ? '#ff4444' : '#4CAF50'">
            {{ currentBalance - coinCost }} coins
          </span>
        </div>

        <div class="button-group">
          <button class="btn-cancel" (click)="dismiss(false)">Annuler</button>
          <button class="btn-confirm" (click)="dismiss(true)" [disabled]="isInsufficient">
            Confirmer
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .coin-confirmation-modal {
      --background: #1a1a1a;
      --border-radius: 16px;
      padding: 24px;
    }

    .modal-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 20px 16px;
    }

    .icon-container {
      font-size: 56px;
      animation: bounce 1s ease-in-out infinite;
    }

    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }

    .title {
      color: #fff;
      font-size: 20px;
      font-weight: 600;
      margin: 0;
    }

    .description {
      color: #ddd;
      font-size: 15px;
      text-align: center;
      margin: 0;
      line-height: 1.5;
    }

    .description strong {
      color: #ffc107;
    }

    .balance-info {
      display: flex;
      justify-content: space-between;
      width: 100%;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.04);
      border-radius: 8px;
      font-size: 14px;
    }

    .balance-info .label {
      color: #888;
    }

    .balance-info .value {
      color: #fff;
      font-weight: 500;
    }

    .balance-info.insufficient .value {
      color: #ff4444;
    }

    .button-group {
      display: flex;
      gap: 12px;
      width: 100%;
      margin-top: 8px;
    }

    .btn-cancel, .btn-confirm {
      flex: 1;
      padding: 12px;
      border: none;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-cancel {
      background: rgba(255, 255, 255, 0.08);
      color: #aaa;
    }

    .btn-cancel:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
    }

    .btn-confirm {
      background: linear-gradient(135deg, #ffc107, #f59e0b);
      color: #1a1a1a;
      font-weight: 600;
    }

    .btn-confirm:hover:not([disabled]) {
      transform: scale(1.02);
    }

    .btn-confirm:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `],
  standalone: true,
  imports: [CommonModule]
})
export class CoinConfirmationComponent {
  @Input() contentTitle: string = '';
  @Input() coinCost: number = 0;
  @Input() currentBalance: number = 0;

  constructor(private modalCtrl: ModalController) {}

  get isInsufficient(): boolean {
    return this.currentBalance < this.coinCost;
  }

  dismiss(confirmed: boolean) {
    this.modalCtrl.dismiss({ confirmed });
  }
}