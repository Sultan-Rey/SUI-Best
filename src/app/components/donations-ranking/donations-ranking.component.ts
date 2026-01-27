import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { cash, trophy, star, diamond, ribbon, heart, checkmarkCircle } from 'ionicons/icons';
import { Donor, DonorTier } from '../../../models/Donation';

import { IonIcon, IonButton } from '@ionic/angular/standalone';

@Component({
  selector: 'app-donations-ranking',
  templateUrl: './donations-ranking.component.html',
  styleUrls: ['./donations-ranking.component.scss'],
  standalone: true,
  imports: [IonButton, 
    CommonModule,
    FormsModule,
    IonIcon
  ]
})
export class DonationsRankingComponent {
  @Input() isLoading: boolean = false;
  @Input() topDonors: Donor[] = [];
  @Input() donorTiers: DonorTier[] = [];
  @Output() viewDonor = new EventEmitter<string>();

  constructor() {
    addIcons({ cash, trophy, star, diamond, ribbon, heart, checkmarkCircle });
  }

  // Formate le montant des dons
  formatDonation(amount: number): string {
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(amount);
  }

  // Retourne la couleur associée à un tier
  getTierColor(tier: string): string {
    const tierObj = this.donorTiers.find(t => t.name.toLowerCase() === tier.toLowerCase());
    return tierObj ? tierObj.color : '#10B981';
  }

  // Gestion des erreurs d'image
  onImageError(event: any) {
    event.target.style.display = 'none';
  }

  // Événement lors du clic sur un donateur
  onDonorClick(donorId: string) {
    this.viewDonor.emit(donorId);
  }
}
