import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { AnimationService } from '../services/ANIMATION_SERVICE/animation-service';
import { NgIf, AsyncPipe } from '@angular/common';
import { LottieComponent } from 'ngx-lottie';
import { MediaCacheService } from 'src/services/Cache/media-cache-service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet, NgIf, AsyncPipe, LottieComponent],
})
export class AppComponent {
  constructor(public animService: AnimationService, private mediaCache: MediaCacheService) {
  mediaCache.configure({
    maxBytes:     500 * 1024 * 1024,  // 500 MB total
    maxFileBytes:  20 * 1024 * 1024,  // fichiers > 20 MB : session uniquement
  });
}

  onAnimationCreated(animationItem: any) {
    console.log('Lottie animation created:', animationItem);
  }
}
