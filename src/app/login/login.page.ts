import { PreferenceService } from '../../services/preferences/preference-service';
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
import { FirebaseService } from 'src/services/API/firebase/firebase-service';
import { Auth } from 'src/services/AUTH/auth';
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
    if(this.auth.isAuthenticated()){
       this.router.navigateByUrl('/home');
    }
    addIcons({mailOutline,lockClosedOutline,arrowForward,logoGoogle,logoFacebook,trophyOutline,sparkles,personCircleOutline,keyOutline,helpCircleOutline,star,shieldCheckmark,'eyeOutline':eyeOutline,'eyeOffOutline':eyeOffOutline,createOutline,settingsOutline});
  }

  ngOnInit() { }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

async loginWithEmail(): Promise<void> {
    // Validation des entrées
    if (!this.email || !this.password) {
      this.showError('Erreur', 'Veuillez saisir un email et un mot de passe');
      return;
    }

    // Validation de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.showError('Erreur', 'Veuillez saisir un email valide');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Connexion en cours...',
      spinner: 'crescent',
      duration: 15000
    });
    
    await loading.present();

    try {
      // Utilisation propre du service Auth avec gestion d'erreurs
      const authUser = await this.auth.login(this.email, this.password).toPromise();
      
      if (!authUser) {
        throw new Error('Échec de l\'authentification');
      }

      // Initialiser les préférences utilisateur si nécessaire
      const existingSettings = this.preferenceService.getSettingsForUser(authUser.id.toString());
      if (!existingSettings) {
        this.preferenceService.initializeSettings(authUser.id.toString());
      }
      loading.dismiss();
      // Navigation vers la page d'accueil
      await this.router.navigateByUrl('/home');
      
    } catch (error: any) {
      console.error('Erreur de connexion:', error);
      
      // Traduction des messages d'erreur
      const errorMessage = this.translateErrorMessage(error);
      this.showError('Échec de la connexion', errorMessage);
      
      // Réinitialiser le mot de passe en cas d'erreur
      this.password = '';
      
    } finally {
      // Fermer le loader dans tous les cas
      await loading.dismiss();
    }
  }

  /**
   * Traduit les messages d'erreur du service Auth en messages utilisateur
   */
  private translateErrorMessage(error: any): string {
    const message = error?.error || error;
    // Messages d'erreur spécifiques du service Auth
    if (message.error === 'MISSING_CREDENTIALS') {
      return 'Veuillez saisir un email et un mot de passe';
    }
    if (message.error === 'INVALID_EMAIL') {
      return 'Veuillez saisir un email valide';
    }
    if (message.error === 'AUTH_FAILED') {
      return 'Email ou mot de passe incorrect';
    }
    if (message.error === 'ACCOUNT_INACTIVE') {
      return 'Votre compte n\'est pas actif. Veuillez contacter l\'administrateur';
    }
    if (message.error === 'NOT_VERIFIED') {
      return 'Votre compte n\'est pas activé. Veuillez vérifier votre email';
    }
    if (message === 'USER_BLOCKED') {
      return 'Votre compte a été bloqué. Veuillez contacter l\'administrateur';
    }
    if (message == 'TOO_MANY_ATTEMPTS') {
      const minutes = message.split(':')[1] || '15';
      return `Trop de tentatives. Veuillez réessayer dans ${minutes} minutes`;
    }
    
    // Message par défaut
    return 'Une erreur est survenue lors de la connexion';
  }

  // ✅ Méthode showError robuste pour Web + Android + iOS
  private async showError(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      header: header,
      message: message,
      buttons: ['OK'],
      animated: true
    });
    await alert.present();
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
