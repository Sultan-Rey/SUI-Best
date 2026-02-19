import { Auth } from '../../services/AUTH/auth';
import { PreferenceService } from '../../services/PREFERENCES/preference-service';
import { Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoadingController, AlertController } from '@ionic/angular';
import { Dialog } from '@capacitor/dialog';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';

import { 
  logoGoogle, 
  logoFacebook, 
  mailOutline,
  lockClosedOutline,
  createOutline,
  settingsOutline,
  eyeOutline,
  eyeOffOutline,
  shieldCheckmark, trophyOutline, sparkles, personCircleOutline, keyOutline, helpCircleOutline, star, arrowForward } from 'ionicons/icons';
import { 
  IonIcon, 
  IonButton, 
  IonInput,
 
  IonContent, IonLoading, IonImg } from '@ionic/angular/standalone';
@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [ IonLoading, 
    CommonModule,
    FormsModule,
    IonContent,
    IonButton,
    IonIcon,
    IonInput
  ]
})
export class LoginPage implements OnInit {
  email: string = '';
  password: string = '';
  showPassword: boolean = false;
  isLoading: boolean = false;
  constructor(
    private auth: Auth,
    private router: Router,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private preferenceService: PreferenceService
  ) {
    addIcons({mailOutline,lockClosedOutline,arrowForward,logoGoogle,logoFacebook,trophyOutline,sparkles,personCircleOutline,keyOutline,helpCircleOutline,star,shieldCheckmark,'eyeOutline':eyeOutline,'eyeOffOutline':eyeOffOutline,createOutline,settingsOutline});
  }

  ngOnInit() { }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

loginWithEmail(): void {
  if (!this.email || !this.password) {
    this.showError('Erreur', 'Veuillez saisir un email et un mot de passe');
    return;
  }

  this.loadingController.create({
    message: 'Connexion en cours...',
    spinner: 'crescent',
    duration: 6000
  }).then(loading => {
    loading.present();
     this.auth.login(this.email, this.password).subscribe({
    next: async (authUser) => {
      try {
        // Initialiser les préférences si elles n'existent pas
        const existingSettings = this.preferenceService.getSettingsForUser(authUser.id.toString());
        if (!existingSettings) {
          this.preferenceService.initializeSettings(authUser.id.toString());
        }
        
        await this.router.navigateByUrl('/tabs/tabs/home');
      } catch (error) {
        console.error('Navigation error:', error);
      }finally{
        loading.dismiss();
      }
    },
    error: (err: Error) => {
      let message = 'Identifiants incorrects';
      
      if (err.message.startsWith('TOO_MANY_ATTENTES:')) {
        const minutes = err.message.split(':')[1];
        message = `Trop de tentatives. Réessayez dans ${minutes} minutes.`;
      } else if (err.message === 'ACCOUNT_INACTIVE') {
        message = 'Ce compte est désactivé. Contactez le support.';
      }

      this.showError('Echec de la connexion', message);
      this.password = '';
      loading.dismiss();
    }
  });
  });
  
 



}


  // ✅ Méthode showError robuste pour Web + Android + iOS
  private async showError(header: string, message: string): Promise<void> {
  this.alertController.create({
    header:header,
    message: message,
    buttons: ['OK'],
    animated: true
  }).then((alert)=> alert.present());
   
}

  loginWithGoogle() {
    // Implémentez la connexion Google
  }

  loginWithFacebook() {
    // Implémentez la connexion Facebook
  }

  navigateToForgotPassword() {
    this.router.navigate(['/forgot-password']);
  }

  navigateToRegister() {
    this.router.navigate(['/register']);
  }
}
