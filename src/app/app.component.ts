import { Component, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { AnimationService } from '../services/Animation/animation-service';
import { NgIf, AsyncPipe } from '@angular/common';
import { LottieComponent } from 'ngx-lottie';
import { MediaCacheService } from 'src/services/Cache/media-cache-service';
import { FCMService } from '../services/FCM/fcmservice';
import { Platform } from '@ionic/angular';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { SplashScreen } from '@capacitor/splash-screen';

interface AppUrlOpenEvent {
  url: string;
}

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet, NgIf, AsyncPipe, LottieComponent],
})
export class AppComponent implements OnInit {
  constructor(
    public animService: AnimationService, 
    private mediaCache: MediaCacheService,
    private fcmService: FCMService,
    private platform: Platform,
    private router: Router
  ) {
    mediaCache.configure({
      maxBytes:     500 * 1024 * 1024,  // 500 MB total
      maxFileBytes:  20 * 1024 * 1024,  // fichiers > 20 MB : session uniquement
    });
  }

async ngOnInit() {
  await this.platform.ready();

  // Cache le splash immédiatement après que la plateforme est prête
  try {
    await SplashScreen.hide({ fadeOutDuration: 400 });
  } catch (e) {
    console.warn('SplashScreen non dispo sur le Web:', e);
  }

  try {
    await ScreenOrientation.lock({ orientation: 'portrait' });
  } catch (err) {
    console.warn('ScreenOrientation non supporté:', err);
  }

  this.setupDeepLinks();
  this.startBackgroundNotificationSetup();
}

   // 2. Utiliser le cycle de vie d'Ionic pour masquer l'écran natif au moment parfait
  async ionViewDidEnter() {
    try {
      await SplashScreen.hide({
        fadeOutDuration: 400 
      });
    } catch (e) {
      console.warn('Le plugin SplashScreen n\'est pas dispo sur le Web', e);
    }
  }
  /**
   * Configure et synchronise les notifications en arrière-plan 
   * sans bloquer le thread principal d'affichage d'Angular.
   */
  private async startBackgroundNotificationSetup() {
    try {
      // S'exécute de manière asynchrone en tâche de fond
      const fcmInitialized = await this.fcmService.initializeFCM();
      
      if (fcmInitialized) {
        // Si l'API met 11 secondes, l'écran de login sera déjà affiché !
        await this.fcmService.initializeTokenSync();
      } else {
        console.log('FCM non disponible sur cette plateforme');
      }
    } catch (error) {
      // On intercepte l'erreur pour éviter qu'un crash réseau ne casse le cycle de l'app
      console.error('Erreur silencieuse lors de la config Push en tâche de fond:', error);
    }
  }

  setupDeepLinks() {
    App.addListener('appUrlOpen', (event: AppUrlOpenEvent) => {
      console.log('Deep link reçu:', event.url);
      
      if (event.url) {
        let path = event.url;
        
        if (path.startsWith('starinuniform://')) {
          path = path.replace('starinuniform://', '/');
        }
        
        console.log('Path extrait:', path);
        
        this.router.navigateByUrl(path).catch(err => {
          console.error('Erreur de navigation deep link:', err);
          this.router.navigate(['/home']);
        });
      }
    });
  }

  onAnimationCreated(animationItem: any) {
    console.log('Lottie animation created:', animationItem);
  }
}