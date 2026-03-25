import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AnimationService {
  // Diffuse le chemin du fichier Lottie à jouer
  private animationSource = new BehaviorSubject<string | null>(null);
  animationState$ = this.animationSource.asObservable();

  playAnimation(path: string) {
    this.animationSource.next(path);
    
    // Auto-reset après 3.9 secondes (durée moyenne d'une animation)
    setTimeout(() => {
      this.animationSource.next(null);
    }, 3900);
  }
}