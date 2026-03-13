import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { NgIf, NgSwitch, NgSwitchCase } from '@angular/common';
import {IonContent, IonFooter } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  search,
  notificationsOutline, sparklesOutline, logoBitcoin, addCircle, peopleOutline, trophy, star, person } from 'ionicons/icons';
import { UserProfile } from 'src/models/User';
import { ProfileService } from 'src/services/PROFILE_SERVICE/profile-service';
import { Router } from '@angular/router';
import { DiscoveryViewComponent } from "./containers/discovery-panel/discovery-view.component";
import { FollowedViewComponent } from "./containers/followed-panel/followed-view.component";
import { MessagesComponent } from './containers/messages/messages.component';
import { GestureController } from '@ionic/angular';
import { switchMap, filter, takeUntil, Subject } from 'rxjs';
import { FireAuth } from 'src/services/AUTH/fireAuth/fire-auth';
import { HeaderComponentComponent } from '../components/header-component/header-component.component';
import { BottomNavigationComponent } from '../components/bottom-navigation/bottom-navigation.component';
import { PublicationComponent } from './containers/publication/publication.component';
import { isNullOrUndefined } from 'html5-qrcode/esm/core';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgSwitchCase,
    IonFooter,
    IonContent,
    DiscoveryViewComponent,
    FollowedViewComponent,
    MessagesComponent,
    PublicationComponent,
    HeaderComponentComponent,
    BottomNavigationComponent, NgSwitch
]
})

export class HomePage implements OnInit {
  selectedSegment: 'discovery' | 'followed' | 'message' | 'upload' = 'discovery';
  activeNavItem: any = null;

  onNavigationChange(item: any) {
    console.log(' Navigation changed to:', item.label);
    
    // Mapper les items de navigation vers les segments
    switch(item.page) {
      case 'challenges':
      case 'explorez':
        this.selectedSegment = 'discovery';
        break;
      case 'suivis':
        this.selectedSegment = 'followed';
        break;
      case 'messages':
        this.selectedSegment = 'message';
        break;
      case 'publier':
        this.selectedSegment = 'upload';
        break;
      default:
        this.selectedSegment = 'discovery';
    }
    
    this.activeNavItem = item;
  }

  currentUserProfile: UserProfile  = {} as UserProfile;
  hasNotifications: boolean = true;
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router, 
    private authService: FireAuth,
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
    addIcons({sparklesOutline,logoBitcoin,addCircle,trophy,star,person,notificationsOutline,peopleOutline,search});
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
      this.currentUserProfile = profile as UserProfile;
      if(!isNullOrUndefined(this.currentUserProfile)){
      this.selectedSegment = this.currentUserProfile.myFollows.length > 5 ? 'followed' : 'discovery';
      this.cdr.markForCheck();
      }
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
          this.setupAuthSubscription();
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