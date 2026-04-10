import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { AnimationService } from '../services/Animation/animation-service';
import { NgIf, AsyncPipe } from '@angular/common';
import { LottieComponent } from 'ngx-lottie';
import { MediaCacheService } from 'src/services/Cache/media-cache-service';
import { FCMService } from '../services/FCM/fcmservice';
import { Platform } from '@ionic/angular';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';

// Interface pour l'événement de deep link
interface AppUrlOpenEvent {
  url: string;
}

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet, NgIf, AsyncPipe, LottieComponent],
})
export class AppComponent {
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
    // Initialiser FCM quand la plateforme est prête
    await this.platform.ready();
    
    // Configurer l'écoute des deep links
    this.setupDeepLinks();
    
    // Initialiser les Push Notifications
    const fcmInitialized = await this.fcmService.initializeFCM();
    
    if (fcmInitialized) {
      //console.log('FCM initialisé avec succès');
      
      // Synchroniser le token au démarrage
      await this.fcmService.initializeTokenSync();
    } else {
      console.log('FCM non disponible sur cette plateforme');
    }
  }

  setupDeepLinks() {
    // Écouter les deep links quand l'application est ouverte
    App.addListener('appUrlOpen', (event: AppUrlOpenEvent) => {
      console.log('Deep link reçu:', event.url);
      
      // Extraire l'URL et naviguer vers la page correspondante
      if (event.url) {
        // Gérer les schémas custom comme bestacademy://
        let path = event.url;
        
        // Remplacer le schéma custom par un chemin relatif
        if (path.startsWith('bestacademy://')) {
          path = path.replace('bestacademy://', '/');
        }
        
        console.log('Path extrait:', path);
        
        // Naviguer vers la route correspondante
        this.router.navigateByUrl(path).catch(err => {
          console.error('Erreur de navigation deep link:', err);
          // En cas d'erreur, rediriger vers la page d'accueil
          this.router.navigate(['/home']);
        });
      }
    });
  }

  onAnimationCreated(animationItem: any) {
    console.log('Lottie animation created:', animationItem);
  }
}
