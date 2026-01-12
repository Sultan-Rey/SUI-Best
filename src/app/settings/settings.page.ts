import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons, IonBackButton, IonIcon } from '@ionic/angular/standalone';
import { Auth } from 'src/services/AUTH/auth';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { logOutOutline } from 'ionicons/icons';


@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [IonIcon, IonBackButton, IonButtons, IonButton, IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class SettingsPage implements OnInit {

   constructor(
    private auth: Auth,
    private router: Router
  ) {
    addIcons({ logOutOutline });
  }

  ngOnInit() {
  }

  async onLogout() {
    try {
      await this.auth.logout();
      this.router.navigate(['/login'], { replaceUrl: true });
    } catch (error) {
      console.error('Erreur lors de la déconnexion :', error);
    }
  }
}
