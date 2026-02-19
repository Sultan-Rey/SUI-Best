import { Component } from '@angular/core';
import { NgFor, NgIf, CommonModule } from '@angular/common';
import { ModalController } from '@ionic/angular';
import { AnimationService } from '../../../services/ANIMATION_SERVICE/animation-service';
import { LottieComponent } from 'ngx-lottie';
import { IonIcon } from '@ionic/angular/standalone';
import { globeOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';

@Component({
  selector: 'app-gift-modal',
  standalone: true,
  imports: [CommonModule, LottieComponent, IonIcon],
  templateUrl: './gift-modal.component.html',
  styleUrls: ['./gift-modal.component.scss']
})
export class GiftModalComponent {
  constructor(
    private modalCtrl: ModalController,
    private animService: AnimationService 
  ) { addIcons({ globeOutline }); }
  currentCategory = 'Tous'; // Par défaut
  selectedGift: any = null;

  gifts = [
    // Classiques
    { id: 'g_rose', name: 'Rose', price: 10, cat: 'Classiques', lottie: 'assets/lottie/Rose.json' },
    { id: 'g_clap', name: 'Cœur', price: 20, cat: 'Classiques', lottie: 'assets/lottie/clap.json' },
    // Luxe
    { id: 'g_cheer', name: 'Supercar', price: 1500, cat: 'Luxe', lottie: 'assets/lottie/cheers!.json' },
    // Épiques
    { id: 'g_dragon', name: 'Dragon', price: 50000, cat: 'Épiques', lottie: 'assets/lottie/dragon.json', is_global: true },
    // ... complète avec les 18 items
     { id: 'g_celebration', name: 'celebration', price: 10, cat: 'Classiques', lottie: 'assets/lottie/Celebration.json' },
    { id: 'g_heart', name: 'crown', price: 20, cat: 'Classiques', lottie: 'assets/lottie/heart.json' },
  
  ];

  get filteredGifts() {
    if (this.currentCategory === 'Tous') {
      return this.gifts;
    }
    return this.gifts.filter(g => g.cat === this.currentCategory);
  }

  setCategory(cat: string) {
    this.currentCategory = cat;
  }

  
  

  selectGift(gift: any) {
    this.selectedGift = gift;
  }

  async sendGift() {
    if (!this.selectedGift) return;

    // 1. Fermer la modale
    await this.modalCtrl.dismiss();

    // 2. Déclencher l'animation plein écran
    this.animService.playAnimation(this.selectedGift.lottie);

    // 3. TODO: Appel API pour déduire les jetons
    console.log(`Cadeau ${this.selectedGift.name} envoyé !`);
  }
}