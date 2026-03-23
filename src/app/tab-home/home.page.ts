import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { NgIf, NgSwitch, NgSwitchCase } from '@angular/common';
import {IonContent, IonFooter, IonButton, IonIcon, ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  search, cloudOffline,
  notificationsOutline, sparklesOutline, logoBitcoin, addCircle, peopleOutline, trophy, star, person, refresh } from 'ionicons/icons';
import { UserProfile } from 'src/models/User';
import { ProfileService } from 'src/services/PROFILE_SERVICE/profile-service';
import { Router } from '@angular/router';
import { DiscoveryViewComponent } from "./containers/discovery-panel/discovery-view.component";
import { FollowedViewComponent } from "./containers/followed-panel/followed-view.component";
import { MessagesComponent } from './containers/messages/messages.component';
import { GestureController } from '@ionic/angular';
import { switchMap, filter, takeUntil, Subject } from 'rxjs';
import { Auth } from 'src/services/AUTH/auth';
import { HeaderComponentComponent } from '../components/header-component/header-component.component';
import { BottomNavigationComponent } from '../components/bottom-navigation/bottom-navigation.component';
import { PublicationComponent } from './containers/publication/publication.component';
import { ChallengeComponent } from './containers/challenge/challenge.component';
import { isNullOrUndefined } from 'html5-qrcode/esm/core';
import { MessageService } from 'src/services/MESSAGE_SERVICE/message-service';
import { Segment } from 'src/models/Segment';
@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIf,
    NgSwitchCase,
    IonFooter,
    IonButton,
    IonIcon,
    IonContent,
    DiscoveryViewComponent,
    FollowedViewComponent,
    MessagesComponent,
    PublicationComponent,
    HeaderComponentComponent,
    ChallengeComponent,
    BottomNavigationComponent, NgSwitch
  ]
})

export class HomePage implements OnInit {
  selectedSegment!:Segment;
  activeNavItem: any = null;
  countUnreadMessages!: number;
  isOnline = navigator.onLine; // État de la connexion
  hasCachedData = true; // Indique si des données cached sont disponibles
  
  // Propriétés pour passer au composant 
  args: any[] = [];
  navigationExtra!: any;
  goBackTarget!: Segment | undefined;
  
  @ViewChild('contentRef', { read: ElementRef }) contentRef!: ElementRef;

  onNavigationChange(item: any) {
    
    // Mapper les items de navigation vers les segments
    switch(item.page) {
      case 'challenges':
        this.selectedSegment = 'challenge';
        this.resetFollowedPosts();
        break;
      case 'explorez':
        this.selectedSegment = 'discovery';
        break;
      case 'suivis':
        this.selectedSegment = 'followed';
        // Si on arrive sur followed depuis bottom nav, réinitialiser
        this.resetFollowedPosts();
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

  // Gérer la navigation vers upload/followed depuis discovery/challenge
  onNavigate(event: { 
    args?: any[]; 
    extras?: any;
    targetSegment: Segment;
    targetReturn: Segment ;
  }) {
    this.goBackTarget = event.targetReturn;
    this.navigationExtra = event.extras || '';
    this.args = event.args || [];
    this.selectedSegment = event.targetSegment;  
    this.cdr.markForCheck();
  }

  // Gérer le retour vers la cible spécifiée
  onGoBack(event: { target: string }): void {
    this.args = [];
    this.goBackTarget = undefined; // Réinitialiser goBackTarget
    
    // Mapper la cible vers le segment approprié
    switch(event.target) {
      case 'discovery':
        this.selectedSegment = 'discovery';
        break;
      case 'followed':
        this.selectedSegment = 'followed';
        break;
      case 'message':
        this.selectedSegment = 'message';
        break;
      case 'upload':
        this.selectedSegment = 'upload';
        break;
      case 'challenge':
        this.selectedSegment = 'challenge';
        break;
      default:
        this.selectedSegment = 'discovery';
    }
    
    this.cdr.markForCheck();
  }

  // Méthode pour réinitialiser les posts de followed
  private resetFollowedPosts(): void {
    this.args = [];
    this.navigationExtra = false;
    this.goBackTarget = undefined; // Réinitialiser goBackTarget pour cacher le bouton
    this.cdr.markForCheck();
  }

  currentUserProfile: UserProfile  = {} as UserProfile;
  hasNotifications: boolean = true;
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router, 
    private authService: Auth,
    private profileService: ProfileService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef,
    private gestureCtrl: GestureController,
    private toastController: ToastController
  ) {
    this.currentUserProfile.stats = {} as {
      posts: 0;
      fans: 0;
      votes: 0;
      stars: 0;
    };
    this.currentUserProfile.myFollows = [];
    addIcons({sparklesOutline,logoBitcoin, cloudOffline,addCircle,trophy,star,person,notificationsOutline,peopleOutline,search, refresh});
  }

  ngOnInit() {
    if(this.authService.isAuthenticated() && this.authService['api'].getToken()!=='' ){
   this.setupConnectionListeners();
    this.setupAuthSubscription();
    this.setupSwipeGesture();
    this.unreadMessagesCount();
    
   
    }else{
      this.authService.logout();
    }
  }

  private unreadMessagesCount(): void{
    if (!this.currentUserProfile?.id) return;
    
    this.messageService.getTotalUnread(this.currentUserProfile.id).subscribe({
      next: (response: { user_id: string; unread_total: number }) => {
        this.countUnreadMessages = response.unread_total;
        this.cdr.markForCheck();
      },
      error: (error: any) => {
        console.error('Error getting unread messages count:', error);
        this.countUnreadMessages = 0;
        this.cdr.markForCheck();
      }
    });
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
        // unreadMessagesCount() déjà appelé dans ngOnInit - pas besoin de dupliquer
        this.cdr.markForCheck();
      }
    });
  }


private setupSwipeGesture(): void {
  if (!this.contentRef) return;

  const gesture = this.gestureCtrl.create({
    el: this.contentRef.nativeElement,
    gestureName: 'swipe-tabs',
    threshold: 15,
    onEnd: (detail) => {
      const deltaX = Math.abs(detail.deltaX);
      const deltaY = Math.abs(detail.deltaY);
      
      if (deltaX > deltaY && deltaX > 50) {
        if (detail.deltaX > 0) {
          // Swipe right
          if (this.selectedSegment === 'discovery') {
            this.switchTab('followed');
          }
        } else {
          // Swipe left
          if (this.selectedSegment === 'followed') {
            this.switchTab('discovery');
          }
        }
      }
    }
  });

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

  goToProfile() {
    if (this.currentUserProfile?.id) {
      this.router.navigate(['/profile', this.currentUserProfile.id]);
    }
  }

  onAvatarError(event: any) {
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = 'assets/avatar-default.png';
  }
onAvatarLoad(event: Event): void {
  (event.target as HTMLImageElement).classList.add('loaded');
}

private setupConnectionListeners() {

  // Initialiser l'état de connexion
  this.isOnline = navigator.onLine;

  
  // Écouter les événements de connexion du navigateur
  window.addEventListener('online', () => {
    this.isOnline = true;
    this.cdr.markForCheck();
    //console.log('🌐 Connexion rétablie');
  });
  
  window.addEventListener('offline', () => {
    this.isOnline = false;
    this.cdr.markForCheck();
   // console.log('📴 Hors ligne - utilisation du cache');
  });

  // Écouter les événements de connexion du service métier
  this.profileService.connectionError.subscribe((isConnected: boolean) => {
     this.isOnline = isConnected;
    this.cdr.markForCheck();
  });
  
}

async retryConnection(event?: Event) {
  if (event) {
    event.preventDefault();
  }
  
  // Vérifier l'état actuel de la connexion
  if (navigator.onLine) {
    this.isOnline = true;
    
    // Rafraîchir la page ou recharger les données
    window.location.reload();
  } else {
    // Montrer un message si toujours hors ligne
    const toast = await this.toastController.create({
      message: 'Toujours hors ligne. Veuillez vérifier votre connexion.',
      duration: 3000,
      color: 'warning'
    });
    await toast.present();
  }
  
  this.cdr.markForCheck();
}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}