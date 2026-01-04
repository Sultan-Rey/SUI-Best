import { Auth } from '../../services/AUTH/auth';
import { Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertController } from '@ionic/angular';
import { Dialog } from '@capacitor/dialog';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';

import { 
  logoGoogle, 
  logoFacebook, 
  mailOutline,
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
  shieldCheckmark
} from 'ionicons/icons';
import { 
  IonIcon, 
  IonButton, 
  IonInput,
 
  IonContent 
} from '@ionic/angular/standalone';
@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
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

  constructor(
    private auth: Auth,
    private router: Router,
    private alertController: AlertController,
    private ngZone: NgZone
  ) {
    addIcons({
      'logo-google': logoGoogle,
      'logo-facebook': logoFacebook,
      'mail-outline': mailOutline,
      'lock-closed-outline': lockClosedOutline,
      'eye-outline': eyeOutline,
      'eye-off-outline': eyeOffOutline,
      'shield-checkmark': shieldCheckmark
    });
  }

  ngOnInit() { }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  loginWithEmail(): void {
    this.router.navigateByUrl('/tabs/tabs/home');
  /*if (!this.email || !this.password) {
    this.showError(
      'Identifiant invalide',
      'Veuillez saisir votre email et votre mot de passe'
    );
    return;
  }

  this.auth.login(this.email, this.password).subscribe({
    next: () => {
      this.router.navigateByUrl('/tabs/tabs/home');
    },
    error: (err: Error) => {
      let message = 'Email ou mot de passe incorrect';

      switch (err.message) {
        case 'USER_NOT_FOUND':
          message = 'Utilisateur introuvable';
          break;
        case 'INVALID_PASSWORD':
          message = 'Mot de passe incorrect';
          break;
        case 'USER_BLOCKED':
          message = 'Compte bloqué';
          break;
      }

      this.showError('Échec de la connexion', message);
      this.password = '';
    },
  });*/
}


  // ✅ Méthode showError robuste pour Web + Android + iOS
  private async showError(header: string, message: string): Promise<void> {
  await Dialog.alert({
    title: header,
    message: message,
    buttonTitle: 'OK'
  });
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
