import { PreferenceService } from '../../services/preferences/preference-service';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoadingController, AlertController, IonIcon, IonContent, IonLoading, IonInput, IonButton } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { firstValueFrom, lastValueFrom } from 'rxjs'; // Ajouté pour remplacer .toPromise() obsolète
import { SplashScreen } from '@capacitor/splash-screen';

interface AlbumCover {
  url: string;
  label?: string;
}

import { 
  logoGoogle, 
  logoFacebook, 
  mailOutline,
  lockClosedOutline,
  createOutline,
  settingsOutline,
  eyeOutline,
  eyeOffOutline,
  shieldCheckmark, trophyOutline, sparkles, personCircleOutline, keyOutline, helpCircleOutline, star, arrowForward 
} from 'ionicons/icons';

import { Auth } from 'src/services/AUTH/auth';
import { SubscriptionService } from 'src/services/Service_subscription/subscription-service';
import { FCMService } from 'src/services/FCM/fcmservice';


@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonContent,
    IonInput,
    CommonModule,
    FormsModule, IonIcon]
})
export class LoginPage implements OnInit {
  email: string = '';
  password: string = '';
  showPassword: boolean = false;
  isLoading: boolean = false;
  showLoginForm: boolean = false; // Flag pour contrôler l'affichage du formulaire
  topRowCovers: string[] = [];
  albumCovers: AlbumCover[] = [];
private readonly DEFAULT_AVATARS = [
    'assets/covers/top-01.png',
    'assets/covers/top-02.jpg',
    'assets/covers/top-03.png'
  ];

  private readonly FALLBACK_ALBUMS = [
     'https://images.unsplash.com/photo-1621981386829-9b458a2cddde?auto=format&fit=crop&w=400&q=80' ,
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80', 
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=400&q=80' ,
    'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=400&q=80' ,
     'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=400&q=80' ,
    'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=400&q=80' ,
   
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80' ,
    'https://images.unsplash.com/photo-1621981386829-9b458a2cddde?auto=format&fit=crop&w=400&q=80' ,
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80', 
   'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=400&q=80' ,
   'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=400&q=80' 

  ];

  constructor(
    private auth: Auth,
    private router: Router,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private preferenceService: PreferenceService, 
    private subscriptionService: SubscriptionService,
    private fcmService: FCMService
  ) {
    addIcons({
      mailOutline, lockClosedOutline, arrowForward, logoGoogle, logoFacebook, 
      trophyOutline, sparkles, personCircleOutline, keyOutline, helpCircleOutline, 
      star, shieldCheckmark, eyeOutline, eyeOffOutline, createOutline, settingsOutline
    });
    
    if (this.auth.isAuthenticated()) {
      this.auth.logout();
    }
  }

  ngOnInit() { this.loadBackgroundData(); }

 
 
  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  async loginWithEmail(): Promise<void> {
    if (!this.email || !this.password) {
      this.showError('Erreur', 'Veuillez saisir un email et un mot de passe');
      return;
    }

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
      // .toPromise() remplacé par firstValueFrom() pour la compatibilité RxJS récente
      const authUser = await firstValueFrom(this.auth.login(this.email, this.password));
      
      if (!authUser) {
        throw new Error('Échec de l\'authentification');
      }

      const existingSettings = this.preferenceService.getSettingsForUser(authUser.id.toString());
      if (!existingSettings) {
        this.preferenceService.initializeSettings(authUser.id.toString());
      }
      this.fcmService.initializeFCM();
      await loading.dismiss();
      await this.router.navigateByUrl('/home', {replaceUrl:true});
      
    } catch (error: any) {
      console.error('Erreur de connexion:', error);
      const errorMessage = this.translateErrorMessage(error);
      this.showError('Échec de la connexion', errorMessage);
      this.password = '';
    } finally {
      await loading.dismiss();
    }
  }

  private translateErrorMessage(error: any): string {
    const message = error?.error || error;
    if (message.error === 'MISSING_CREDENTIALS') return 'Veuillez saisir un email et un mot de passe';
    if (message.error === 'INVALID_EMAIL') return 'Veuillez saisir un email valide';
    if (message.error === 'AUTH_FAILED') return 'Email ou mot de passe incorrect';
    if (message.error === 'ACCOUNT_INACTIVE') return 'Votre compte n\'est pas actif. Veuillez contacter l\'administrateur';
    if (message.error === 'NOT_VERIFIED') return 'Votre compte n\'est pas activé. Veuillez vérifier votre email';
    if (message === 'USER_BLOCKED') return 'Votre compte a été bloqué. Veuillez contacter l\'administrateur';
    
    if (message == 'TOO_MANY_ATTEMPTS') {
      const minutes = message.split(':')[1] || '15';
      return `Trop de tentatives. Veuillez réessayer dans ${minutes} minutes`;
    }
    
    return 'Une erreur est survenue lors de la connexion';
  }

  private async showError(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      header: header,
      message: message,
      buttons: ['OK'],
      animated: true
    });
    await alert.present();
  }

  onLogin(): void {
    // Au lieu de boucler la navigation, on bascule l'état local pour ouvrir le formulaire
    this.showLoginForm = true;
  }

  onSignup(): void {
     this.router.navigate(['/registration']);
  }

  navigateToForgotPassword() {
    this.router.navigate(['/default/password-reset']);
  }

  /**
   * Gère le préchargement des images critiques calculées pour éviter les sauts d'affichage
   */
  // private async hideSplashScreen() {
  //   const imagesToPreload = [
  //     'assets/logo/logo-transparent.png',
  //     ...this.topRowCovers,
  //     ...this.albumCovers.map(c => c.url)
  //   ];

  //   // Attente du chargement asynchrone des images par le navigateur
  //   await Promise.all(imagesToPreload.map(url => {
  //     return new Promise<void>((resolve) => {
  //       const img = new Image();
  //       img.src = url;
  //       img.onload = () => resolve();
  //       img.onerror = () => resolve();
  //     });
  //   }));

  //   // Tout est chargé et en place : on retire le Splash Screen
  //   try {
  //     await SplashScreen.hide({ fadeOutDuration: 400 });
  //   } catch (e) {
  //     console.log('Web context, no native splash screen.');
  //   }
  // }

  private async loadBackgroundData() {
  try {
    // 1. Récupération des 20 créateurs les plus récents depuis l'endpoint public
    const recentCreators = await lastValueFrom(this.subscriptionService.getPublicLandingAssets());

    // ── STRATÉGIE DU PODIUM (topRowCovers) ──
    // On crée une copie superficielle pour ne pas altérer l'ordre chronologique d'origine
    const sortedByPopularity = [...recentCreators]
      .sort((a, b) => b.fans - a.fans) // Tri décroissant sur le volume de fans
      .slice(0, 3); // On isole les 3 premiers

    for (let i = 0; i < 3; i++) {
      if (sortedByPopularity[i]) {
        this.topRowCovers.push(sortedByPopularity[i].avatar);
      } else {
        // Fallback premium local si la table est vide
        this.topRowCovers.push(this.DEFAULT_AVATARS[i % this.DEFAULT_AVATARS.length]);
      }
    }

    // ── STRATÉGIE DE LA GRILLE DÉFILANTE (albumCovers) ──
    // On conserve précieusement l'ordre chronologique (du plus récent au plus ancien)
    let extractedAvatars = recentCreators.map(c => ({ url: c.avatar }));

    // Boucle de résilience : si l'app a moins de 12 comptes créés, 
    // on comble pour maintenir la fluidité infinie de l'animation CSS
    let fallbackIndex = 0;
    while (extractedAvatars.length < 12) {
      const fallbackUrl = this.FALLBACK_ALBUMS[fallbackIndex % this.FALLBACK_ALBUMS.length];
      extractedAvatars.push({ url: fallbackUrl });
      fallbackIndex++;
    }

    this.albumCovers = extractedAvatars;

  } catch (error) {
    console.error('Échec réseau ou API, application des fallbacks locaux complets', error);
    this.topRowCovers = [...this.DEFAULT_AVATARS];
    this.albumCovers = this.FALLBACK_ALBUMS.map(url => ({ url }));
  } finally {
    // Précharge les images calculées et lève le rideau de la Splash Screen
    //this.hideSplashScreen();
  }
}

}