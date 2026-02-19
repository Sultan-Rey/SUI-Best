import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { AnimationService } from '../services/ANIMATION_SERVICE/animation-service';
import { NgIf, AsyncPipe } from '@angular/common';
import { LottieComponent } from 'ngx-lottie';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet, NgIf, AsyncPipe, LottieComponent],
})
export class AppComponent {
  constructor(public animService: AnimationService) {}

  onAnimationCreated(animationItem: any) {
    console.log('Lottie animation created:', animationItem);
  }
}
