import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { NgIf } from '@angular/common';
import {
  IonIcon, 
  IonContent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  search, 
  notificationsOutline
} from 'ionicons/icons';
import { UserProfile } from 'src/models/User.js';
import { Auth } from 'src/services/AUTH/auth.js';
import { ProfileService } from 'src/services/PROFILE_SERVICE/profile-service.js';
import { Router } from '@angular/router';
import { DiscoveryViewComponent } from "../components/view-discovery/discovery-view.component.js";
import { FollowedViewComponent } from "../components/view-followed/followed-view.component.js";
import { GestureController } from '@ionic/angular';
import { switchMap, filter, takeUntil, Subject } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIf, 
    IonIcon, 
    IonContent,
    DiscoveryViewComponent,
    FollowedViewComponent
  ]
})

export class HomePage implements OnInit {
  selectedSegment: 'discovery' | 'followed' = 'discovery';
  currentUserProfile: UserProfile = {} as UserProfile;
  hasNotifications: boolean = true;
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router, 
    private authService: Auth,
    private profileService: ProfileService,
    private cdr: ChangeDetectorRef,
    private gestureCtrl: GestureController
  ) {
    this.currentUserProfile.stats = {} as {
      posts: 0;
      fans: 0;
      votes: 0;
      stars: 0;
    };
    this.currentUserProfile.myFollows = [];
    addIcons({search, notificationsOutline});
  }

  ngOnInit() {
    this.setupAuthSubscription();
    this.setupSwipeGesture();
  }

  private setupAuthSubscription(): void {
    this.authService.currentUser$.pipe(
      takeUntil(this.destroy$),
      filter(user => !!user),
      switchMap(user => 
        this.profileService.getProfileById(user.id.toString())
      )
    ).subscribe(profile => {
      this.currentUserProfile = profile;
      this.selectedSegment = this.currentUserProfile.myFollows.length > 5 ? 'followed' : 'discovery';
      this.cdr.markForCheck();
    });
  }

  private setupSwipeGesture(): void {
    // Utilisation de l'API Gesture d'Ionic - plus performant et natif
    const content = document.querySelector('ion-content');
    if (!content) return;

    const gesture = this.gestureCtrl.create({
      el: content,
      gestureName: 'swipe-tabs',
      threshold: 15,
      onStart: () => {
        // Optionnel: feedback visuel au début du swipe
      },
      onMove: (detail) => {
        // L'API Ionic gère automatiquement la détection de direction
        // Pas besoin de calculs manuels
      },
      onEnd: (detail) => {
        const threshold = 50;
        
        // Swipe vers la gauche (deltaX négatif) = aller vers Suivis
        if (detail.deltaX < -threshold && this.selectedSegment === 'discovery') {
          this.switchTab('followed');
        }
        // Swipe vers la droite (deltaX positif) = aller vers Découverte  
        else if (detail.deltaX > threshold && this.selectedSegment === 'followed') {
          this.switchTab('discovery');
        }
      }
    }, true);

    gesture.enable();
  }

  switchTab(tab: 'discovery' | 'followed') {
    if (this.selectedSegment === tab) return;
    
    this.selectedSegment = tab;
    this.cdr.markForCheck();
    
    // Pas de calculs - juste un changement de classe CSS
    // Les transitions CSS font tout le travail
  }

  openSearch() {
   this.router.navigate(['/search']);
  }

  openNotifications() {
     this.router.navigate(['/notification']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}