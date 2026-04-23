import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef, OnDestroy } from '@angular/core';
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
import { switchMap, filter, takeUntil, Subject, interval } from 'rxjs';
import { Auth } from 'src/services/AUTH/auth';
import { HeaderComponentComponent } from '../components/header-component/header-component.component';
import { BottomNavigationComponent } from '../components/bottom-navigation/bottom-navigation.component';
import { PublicationComponent } from './containers/publication/publication.component';
import { ChallengeComponent } from './containers/challenge/challenge.component';
import { BannerAdsComponent } from './containers/banner-ads/banner-ads.component';
import { isNullOrUndefined } from 'html5-qrcode/esm/core';
import { MessageService } from 'src/services/Service_message/message-service';
import { Segment } from 'src/models/Segment';
import { MediaUrlPipe } from "../utils/pipes/mediaUrlPipe/media-url-pipe";
import { NotificationManagerService } from 'src/services/Notification/notification-manager-service';
import { Platform } from '@ionic/angular';
import { CreationService } from 'src/services/Service_content/creation-service';
import { Content } from 'src/models/Content';

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
    BannerAdsComponent,
    BottomNavigationComponent, NgSwitch,
    MediaUrlPipe
  ]
})

export class HomePage implements OnInit, OnDestroy {
  selectedSegment!:Segment;
  activeNavItem: any = null;
  countUnreadMessages!: number;
  isOnline = navigator.onLine; // État de la connexion
  hasCachedData = true; // Indique si des données cached sont disponibles
  
  // Propriétés pour passer au composant 
  args: any[] = [];
  navigationExtra!: any;
  goBackTarget!: Segment | undefined;
  
  // Propriétés pour les bannières publicitaires
  showBannerAd = false;
  hasContent = false;
  private bannerDisplayProbability = 0.3; // 30% de chance d'afficher la bannière
  private adsLoadProbability = 0.5; // 50% de chance de charger les bannières vs les posts
  bannerAds: Content[] = [];
  isLoadingBannerAds = true;
  hasBannerAdsError = false;
  
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
    private toastController: ToastController,
    private notificationManager: NotificationManagerService,
    private platform: Platform,
    private creationService: CreationService
  ) {
    this.currentUserProfile.stats = {} as {
      posts: 0;
      fans: 0;
      votes: 0;
      stars: 0;
    };
    this.currentUserProfile.myFollows = [];
    addIcons({close,cloudOffline,refresh,sparklesOutline,logoBitcoin,addCircle,trophy,star,person,notificationsOutline,peopleOutline,search});
  }

  ngOnInit() {
    // Détecter la plateforme
    this.detectPlatform();
    
    this.setupConnectionListeners();
    this.setupAuthSubscription();
    this.setupSwipeGesture();
    this.unreadMessagesCount();
    
    // Charger les publicités avec probabilité : soit bannières soit posts
    const shouldLoadBannerAds = Math.random() < this.adsLoadProbability;
    if (shouldLoadBannerAds) {
      this.loadBannerAds();
      //console.log('[HomePage] Loading banner ads');
    } else {
      this.loadPostAds();
     // console.log('[HomePage] Loading post ads');
    }
    
    // Initialiser la vérification de bannière après le chargement du profil
    setTimeout(() => {
      this.checkBannerDisplay();
      // Démarrer la vérification toutes les 5 minutes (300000 ms)
      this.bannerInterval = interval(300000).pipe(
        takeUntil(this.destroy$)
      ).subscribe(() => {
        this.checkBannerDisplay();
      });
    }, 1000);
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
      }else{
        this.isOnline = false;
      }
    });
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
    
    // Pas de calculs - juste un changement de classe CSS
    // Les transitions CSS font tout le travail
    
    // Vérifier si on doit afficher une bannière aléatoirement
    this.checkBannerDisplay();
  }

  // Méthode pour vérifier si on doit afficher la bannière
  private checkBannerDisplay(): void {
    // Seulement pour discovery et followed
    if (this.selectedSegment !== 'discovery' && this.selectedSegment !== 'followed') {
      this.showBannerAd = false;
      return;
    }
    
    // Vérifier s'il y a du contenu (posts, follows, etc.)
    this.hasContent = this.checkForContent();
    
    // Vérifier s'il y a des publicités disponibles
    const hasAvailableAds = this.bannerAds && this.bannerAds.length > 0 && !this.isLoadingBannerAds && !this.hasBannerAdsError;
    
    if (this.hasContent && hasAvailableAds) {
      // Affichage aléatoire basé sur la probabilité
      const random = Math.random();
      this.showBannerAd = random < this.bannerDisplayProbability;
    } else {
      this.showBannerAd = false;
    }
    
    this.cdr.markForCheck();
  }

  // Méthode pour vérifier s'il y a du contenu à afficher
  private checkForContent(): boolean {
    if (!this.currentUserProfile) return false;
    
    switch (this.selectedSegment) {
      case 'discovery':
        // Toujours du contenu pour discovery (posts publics)
        return true;
      case 'followed':
        // Vérifier s'il y a des follows ou des posts
        return this.currentUserProfile.myFollows && this.currentUserProfile.myFollows.length > 0;
      default:
        return false;
    }
  }

  // Méthode pour charger les bannières publicitaires
  loadBannerAds(): void {
    this.isLoadingBannerAds = true;
    this.hasBannerAdsError = false;

    this.creationService.getBannerAdsContents(1, 10).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (ads) => {
        this.bannerAds = ads;
        this.isLoadingBannerAds = false;
        this.checkBannerDisplay(); // Vérifier si on doit afficher la bannière après chargement
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Erreur lors du chargement des bannières:', error);
        this.hasBannerAdsError = true;
        this.isLoadingBannerAds = false;
        this.bannerAds = [];
        this.checkBannerDisplay(); // Mettre à jour l'affichage
        this.cdr.markForCheck();
      }
    });
  }

  loadPostAds(): void {
    this.isLoadingBannerAds = true;
    this.hasBannerAdsError = false;

    this.creationService.getPostAdsContents(1, 10).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (ads) => {
        this.bannerAds = ads;
        this.isLoadingBannerAds = false;
        this.checkBannerDisplay(); // Vérifier si on doit afficher la bannière après chargement
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Erreur lors du chargement des bannières:', error);
        this.hasBannerAdsError = true;
        this.isLoadingBannerAds = false;
        this.bannerAds = [];
        this.checkBannerDisplay(); // Mettre à jour l'affichage
        this.cdr.markForCheck();
      }
    });
  }
  // Méthode pour fermer la bannière manuellement
  closeBannerAd(): void {
    this.showBannerAd = false;
    this.cdr.markForCheck();
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

  /**
   * Vérifie si des données cached sont disponibles pour permettre l'usage hors ligne
   */
  private checkCachedDataAvailability(): void {
    // Vérifier si le profil utilisateur est en cache
    const hasUserProfile = !!this.currentUserProfile?.id;
    
    // Vérifier s'il y a des follows en cache (pour le tab followed)
    const hasFollows = this.currentUserProfile?.myFollows && this.currentUserProfile.myFollows.length > 0;
    
    // Vérifier s'il y a des bannières publicitaires en cache
    const hasCachedAds = this.bannerAds && this.bannerAds.length > 0;
    
    // Déterminer si on a suffisamment de données pour fonctionner hors ligne
    this.hasCachedData = hasUserProfile && (hasFollows || hasCachedAds);
    
    console.log('Cache check - Profile:', hasUserProfile, 'Follows:', hasFollows, 'Ads:', hasCachedAds, 'Result:', this.hasCachedData);
  }

  private setupConnectionListeners() {
    // Initialiser l'état de connexion
    this.isOnline = navigator.onLine;

    // Écouter les événements de connexion du navigateur
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.cdr.markForCheck();
      console.log('Connexion rétablie - Rechargement automatique des données...');
      this.refreshAllDataOnReconnect();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.checkCachedDataAvailability();
      this.cdr.markForCheck();
      console.log('Hors ligne - Vérification des données cached...');
    });

    // Écouter les événements de connexion du service métier
    this.profileService.connectionError.subscribe((isConnected: boolean) => {
       this.isOnline = isConnected;
       this.cdr.markForCheck();
      
      // Si la connexion est rétablie via le service, recharger les données
      if (isConnected) {
        console.log('Service connexion rétablie - Rechargement automatique des données...');
        this.refreshAllDataOnReconnect();
      }
    });
    
  }

  /**
   * Recharge automatiquement toutes les données quand la connexion est rétablie
   */
  private async refreshAllDataOnReconnect() {
    try {
      // Afficher un toast pour informer l'utilisateur
      const toast = await this.toastController.create({
        message: 'Connexion rétablie - Rechargement des données...',
        duration: 2000,
        color: 'success',
        position: 'top'
      });
      await toast.present();

      // Recharger le profil utilisateur
      if (this.currentUserProfile?.id) {
        this.profileService.getProfileById(this.currentUserProfile.id).subscribe({
          next: (profile) => {
            this.currentUserProfile = profile as UserProfile;
            this.cdr.markForCheck();
          },
          error: (error) => {
            console.error('Erreur lors du rechargement du profil:', error);
          }
        });
      }

      // Recharger les messages non lus
      this.unreadMessagesCount();

      // Recharger les bannières publicitaires
      this.loadBannerAds();

      // Recharger les bannières publicitaires
      this.loadPostAds();

      // Notifier les composants enfants de se recharger
      this.cdr.markForCheck();

      console.log('Toutes les données ont été rechargées avec succès');
    } catch (error) {
      console.error('Erreur lors du rechargement automatique:', error);
    }
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
    
    // Nettoyer l'intervalle de vérification des bannières
    if (this.bannerInterval) {
      this.bannerInterval.unsubscribe();
    }
  }
}