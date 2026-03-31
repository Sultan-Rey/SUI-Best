import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { AnimationService } from '../services/Animation/animation-service';
import { NgIf, AsyncPipe } from '@angular/common';
import { LottieComponent } from 'ngx-lottie';
import { MediaCacheService } from 'src/services/Cache/media-cache-service';
import { FCMService } from '../services/FCM/fcmservice';
import { Platform } from '@ionic/angular';

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
    private platform: Platform
  ) {
    mediaCache.configure({
      maxBytes:     500 * 1024 * 1024,  // 500 MB total
      maxFileBytes:  20 * 1024 * 1024,  // fichiers > 20 MB : session uniquement
    });
  }

  async ngOnInit() {
    // Initialiser FCM quand la plateforme est prête
    await this.platform.ready();
    
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

  onAnimationCreated(animationItem: any) {
    console.log('Lottie animation created:', animationItem);
  }
}
