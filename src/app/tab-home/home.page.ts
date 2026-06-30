import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef, OnDestroy, AfterViewInit } from '@angular/core';
import { NgIf, NgSwitch, NgSwitchCase, AsyncPipe } from '@angular/common';
import {IonButton, IonIcon, IonContent, ToastController, IonFooter } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  search, cloudOffline,
  notificationsOutline, sparklesOutline, logoBitcoin, addCircle, peopleOutline, trophy, star, person, refresh, close } from 'ionicons/icons';
import { UserProfile } from 'src/models/User';
import { ProfileService } from 'src/services/Service_profile/profile-service';
import { Router } from '@angular/router';
import { DiscoveryViewComponent } from "./containers/discovery-panel/discovery-view.component";
import { FollowedViewComponent } from "./containers/followed-panel/followed-view.component";
import { MessagesComponent } from './containers/messages/messages.component';
import { GestureController } from '@ionic/angular';
import { switchMap, filter, takeUntil, Subject, interval, map, Observable, of } from 'rxjs';
import { Auth } from 'src/services/AUTH/auth';
import { HeaderComponentComponent } from '../components/header-component/header-component.component';
import { BottomNavigationComponent } from '../components/bottom-navigation/bottom-navigation.component';
import { PublicationComponent } from './containers/publication/publication.component';
import { ChallengeComponent } from './containers/challenge/challenge.component';
import { isNullOrUndefined } from 'html5-qrcode/esm/core';
import { MessageService } from 'src/services/Service_message/message-service';
import { Segment } from 'src/models/Segment';
import { MediaUrlPipe } from "../utils/pipes/mediaUrlPipe/media-url-pipe";
import { NotificationManagerService } from 'src/services/Notification/notification-manager-service';
import { Platform } from '@ionic/angular';
import { CreationService } from 'src/services/Service_content/creation-service';
import { Content } from 'src/models/Content';
import { ChallengeService } from 'src/services/Service_challenge/challenge-service';
import { AdBannerComponent } from "../components/ad-banner/ad-banner.component";

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonFooter,
    NgIf,
    NgSwitchCase,
    AsyncPipe,
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
    BottomNavigationComponent, NgSwitch,
    MediaUrlPipe, AdBannerComponent]
})

export class HomePage implements OnInit, OnDestroy, AfterViewInit {
  selectedSegment!:Segment;
  activeNavItem: any = null;
  countUnreadMessages!: number;
  isOnline = navigator.onLine; // État de la connexion
  hasCachedData = true; // Indique si des données cached sont disponibles
  
  // Propriétés pour passer au composant 
  args: any[] = [];
  navigationExtra!: any;
  goBackTarget!: Segment | undefined;
  
 
  
  // Propriété pour l'intervalle de vérification des bannières
  private bannerInterval: any;
  
  // Propriété pour détecter si on est sur mobile
  isMobile: boolean = true;
  isMobileWeb: boolean = true;
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

  onProfileLoaded(profile:UserProfile){
    this.currentUserProfile  = profile;
    this.selectedSegment = this.currentUserProfile.myFollows.length > 5 ? 'followed' : 'discovery';
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
    private messageService: MessageService,
    private challengeService: ChallengeService,
    private cdr: ChangeDetectorRef,
    private gestureCtrl: GestureController,
    private toastController: ToastController,
    private notificationManager: NotificationManagerService,
    private platform: Platform,
    private creationService: CreationService
  ) {
    
    addIcons({close,cloudOffline,refresh,sparklesOutline,logoBitcoin,addCircle,trophy,star,person,notificationsOutline,peopleOutline,search});
  }

  ngOnInit() {

  this.selectedSegment = 'discovery';
 
}

ngAfterViewInit() {
    // On initialise le geste une fois que la vue et ses éléments natifs sont prêts
    setTimeout(() => {
      this.unreadMessagesCount();
      this.setupSwipeGesture();
    }, 500);
  }
  /**
   * Détecte si l'application est sur mobile ou desktop
   */
  detectPlatform() {
    this.isMobile = this.platform.is('ios') || this.platform.is('android');
    this.isMobileWeb = this.platform.is('desktop') || this.platform.is('ipad') || this.platform.is('mobileweb')
  }

  /**
   * Retourne l'index du segment actif pour le menu burger
   */
  getActiveSegmentIndex(): number {
    // Mapping des segments vers les indices du menu burger
    const segmentMapping: { [key: string]: number } = {
      'challenge': 0,
      'discovery': 1, 
      'followed': 2,
      'message': 3,
      'upload': 4
    };
    return segmentMapping[this.selectedSegment] || 0;
  }

  private unreadMessagesCount(): void{
    if (!this.currentUserProfile?.id) return;
    
    this.messageService.getTotalUnread(this.currentUserProfile.id).subscribe({
      next: (response: { user_id: string; unread_total: number }) => {
        // Notifier si de nouveaux messages sont arrivés
        if (response.unread_total > this.countUnreadMessages && response.unread_total > 0) {
          this.notificationManager.notifyNewMessage(
            'Système',
            `Vous avez ${response.unread_total} message(s) non lu(s)`,
            'system',
            this.currentUserProfile.id
          );
        }
        
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

  participationRequestCount(): Observable<boolean> {
  if (!this.currentUserProfile?.id) {
    return of(false);
  }
  if (!this.currentUserProfile?.type || this.currentUserProfile?.type !== 'creator' ) {
    return of(false);
  }

  return this.challengeService.pendingRequestsCount$.pipe(
    map(count => (count ?? 0) > 0)
  );
}



  // Gérer le swipe entre les segments
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
    
    
  }

  goToProfile() {
    if (this.currentUserProfile?.id) {
      this.router.navigate(['/profile', this.currentUserProfile.id]);
    }else{
      this.router.navigate(['/login']);
    }
  }

  onAvatarError(event: any) {
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = 'assets/avatar-default.png';
  }

  onAvatarLoad(event: Event): void {
    (event.target as HTMLImageElement).classList.add('loaded');
  }

  /**
   * Vérifie si des données cached sont disponibles pour permettre l'usage hors ligne
   */
  private checkCachedDataAvailability(): void {
    // Vérifier si le profil utilisateur est en cache
    const hasUserProfile = !!this.currentUserProfile?.id;
    
    // Vérifier s'il y a des follows en cache (pour le tab followed)
    const hasFollows = this.currentUserProfile?.myFollows && this.currentUserProfile.myFollows.length > 0;
    
    
    
     }

     async retryConnection(event?: Event) {
  if (event) {
    event.preventDefault();
  }
  
  // Vérifier l'état actuel de la connexion
  if (navigator.onLine) {
    this.isOnline = true;
    
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
    
    // Nettoyer l'intervalle de vérification des bannières
    if (this.bannerInterval) {
      this.bannerInterval.unsubscribe();
    }
  }
}