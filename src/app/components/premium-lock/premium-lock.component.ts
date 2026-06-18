import { Component } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { IonModal } from "@ionic/angular/standalone";

@Component({
  selector: 'app-premium-lock',
  templateUrl: './premium-lock.component.html',
  styleUrls: ['./premium-lock.component.scss'],
  standalone: true,
  imports: [] // Plus besoin d'importer IonModal ici
})
export class PremiumLockComponent {
  // Plus besoin de @ViewChild('modal') ni des animations manuelles, on gère ça au niveau du contrôleur principal

  constructor(private modalCtrl: ModalController) {}

  dismiss(role: string) {
    this.modalCtrl.dismiss(null, role);
  }
}