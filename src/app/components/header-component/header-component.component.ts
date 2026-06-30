import { 
  Component, 
  EnvironmentInjector, 
  inject, 
  OnInit, 
  ViewChild, 
  ElementRef, 
  Input, 
  Output, 
  EventEmitter, 
  ChangeDetectorRef, 
  AfterViewInit
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { 
  IonHeader, 
  IonIcon, 
  IonLabel, 
  IonText, 
  IonImg, 
  IonButtons, 
  IonBackButton, 
  IonModal, 
  IonButton, 
  IonBadge, 
  IonAvatar 
} from "@ionic/angular/standalone";
import { forkJoin, Observable, of, shareReplay, Subject, takeUntil } from 'rxjs';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { addIcons } from 'ionicons';
import { checkmark, ticketOutline, sparklesOutline, addCircle, trophy, search, menu } from 'ionicons/icons';
import { catchError, filter, first, timeout } from 'rxjs/operators';

// Services
import { Auth } from 'src/services/AUTH/auth';
import { ProfileService } from 'src/services/Service_profile/profile-service';
import { RewardService } from 'src/services/Rewards/reward-service';
import { DailyRewards } from 'src/services/Rewards/daily-rewards';
import { AnimationService } from 'src/services/Animation/animation-service';
import { WalletService, UserBalance } from 'src/services/Service_wallet/wallet-service';

// Components
import { CouponModalComponent } from '../modal-coupon/coupon-modal.component';
import { BuyCoinModalComponent } from '../modal-buy-coin/buy-coin-modal.component';
import { MenuBurgerComponent } from "../menu-burger/menu-burger.component";

// Models & Interfaces
import { Transaction, Wallet } from 'src/models/Wallet';
import { CouponModalMode } from 'src/interfaces/coupon.interfaces';
import { Pack } from 'src/interfaces/income.interfaces';
import { Segment } from 'src/models/Segment';

// Pipes & Utils
import { LottieComponent } from 'ngx-lottie';
import { ShortNumberPipe } from 'src/app/utils/pipes/shortNumberPipe/short-number-pipe';
import { CurrencyPipe, AsyncPipe } from '@angular/common';
import { MediaUrlPipe } from 'src/app/utils/pipes/mediaUrlPipe/media-url-pipe';

// Ionic
import { ModalController, ToastController, AnimationController, Platform } from '@ionic/angular';
import { UserProfile } from 'src/models/User';
import { Initialize } from 'src/services/INIT/initialize';

@Component({
  selector: 'app-header-component',
  templateUrl: './header-component.component.html',
  styleUrls: ['./header-component.component.scss'],
  providers: [ModalController],
  imports: [
    AsyncPipe, 
    MediaUrlPipe, 
    IonAvatar, 
    IonBadge, 
    IonButton, 
    IonModal, 
    NgClass, 
    NgIf, 
    NgFor, 
    IonHeader, 
    IonIcon, 
    IonLabel, 
    IonText, 
    IonImg, 
    IonButtons, 
    IonBackButton, 
    LottieComponent, 
    ShortNumberPipe, 
    CurrencyPipe, 
    MenuBurgerComponent
  ]
})
export class HeaderComponentComponent implements OnInit, AfterViewInit {
  
  // ============================================================================
  // 1. INJECTIONS
  // ============================================================================
  public environmentInjector = inject(EnvironmentInjector);

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
    private authService: Auth,
    private rewardService: RewardService,
    private dailyRewards: DailyRewards,
    public animService: AnimationService,
    private animationCtrl: AnimationController,
    private modalController: ModalController,
    private toastController: ToastController,
    private walletService: WalletService,
    private initService: Initialize,
    private platform: Platform
  ) {
    this.detectPlatform();
  }
  ngAfterViewInit(): void {
    this.performCoinPurchase();
    this.initService.setupConnectionListeners();
    this.initAuthSubscription();
  }

  // ============================================================================
  // 2. LIFECYCLE HOOKS
  // ============================================================================
  ngOnInit() {
    this.initIcons();
    this.updateBalance();
    this.initializeDailyRewards();
  }

  // ============================================================================
  // 3. PROPRIÉTÉS ET ÉTATS
  // ============================================================================
  
  // --- Gestion de la destruction ---
  private destroy$ = new Subject<void>();

  // --- Navigation et menu ---
  activeTab = 'home';
  @Input() goBackTarget: Segment | undefined;
  @Output() goBack = new EventEmitter<{ target: Segment }>();
  
  @Input() UserIsVerified!: boolean;
  @Input() countUnreadMessages!: number;
  @Input() activeSegmentIndex: number = 0;
  @Input() UserCanPublish!: boolean;
  @Output() navigationChange = new EventEmitter<any>();

  // --- Menu burger ---
  isBurgerMenuOpen: boolean = true;
  isMenuCollapsed: boolean = false;

  // --- Wallet et balance ---
  balance$!: Observable<UserBalance>;
  @Output() balanceChange = new EventEmitter<UserBalance>();
  userBalance: UserBalance = { coins: 0, coupons: 0 };
  showCoinAnimation: boolean = false;

  // --- Utilisateur ---
  userId!: string;
  userXp!: number;
  userLvl!: number;
  userAvatar!: string;
  @Output() currentUserProfile = new EventEmitter<UserProfile>();
  // --- Abonnement ---
  subscriptionStatus: 'active' | 'expiring' | 'expired' | 'inactive' = 'inactive';
  @Output() currentSubscriptionStatus = new EventEmitter<string>();

  // --- Détection de plateforme ---
  isMobile: boolean = true;
  isMobileWeb: boolean = false;

  // --- Récompenses quotidiennes ---
  @ViewChild('rewardModal') rewardModal!: IonModal;
  recompensesQuotidiennes: Record<string, any> = {};
  tableauJours: string[] = [];
  indexJourActuel = 0;
  estWeekend = false;
  peutReclamerAujourdHui = false;

  // ============================================================================
  // 4. INITIALISATION
  // ============================================================================

  /**
   * Initialise les icônes Ionic
   */
  private initIcons(): void {
    addIcons({ checkmark, ticketOutline, sparklesOutline, addCircle, trophy, search, menu });
  }

  /**
   * Détecte la plateforme (mobile/desktop)
   */
  private detectPlatform(): void {
    this.platform.ready().then(() => {
      this.isMobile = this.platform.is('ios') || this.platform.is('android');
      this.isMobileWeb = this.platform.is('desktop') || this.platform.is('ipad') || this.platform.is('mobileweb');
    });
  }

  /**
   * Initialise l'abonnement aux changements d'authentification
   */
  private initAuthSubscription(): void {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        if (user) {
          this.handleAuthenticatedUser(user);
        } else {
          this.handleUnauthenticatedUser();
        }
      });
  }

  /**
   * Gère l'utilisateur authentifié
   */
  private handleAuthenticatedUser(user: any): void {
    this.checkSubscriptionStatus();
    this.performCoinPurchase();
    this.processPendingPlanTransactions(user.id);
  }

  /**
   * Gère l'utilisateur non authentifié
   */
  private handleUnauthenticatedUser(): void {
    this.subscriptionStatus = 'inactive';
    this.currentSubscriptionStatus.emit(this.subscriptionStatus);
  }

  /**
   * Traite les transactions de plan en attente
   */
  private processPendingPlanTransactions(userId: string): void {
    const pendingKey = `pending_plan_transactions_${userId}`;
    const pendingTransactionsJson = localStorage.getItem(pendingKey);

    if (!pendingTransactionsJson) return;

    try {
      const pendingTransactions: Transaction[] = JSON.parse(pendingTransactionsJson);
      if (pendingTransactions.length === 0) return;

      this.walletService.wallet$.pipe(
        filter(wallet => wallet !== null),
        first(),
        timeout(10000),
        catchError(() => {
          console.error('Timeout: Wallet non chargé après 10 secondes');
          return of(null);
        })
      ).subscribe({
        next: (user_wallet) => {
          if (user_wallet) {
            this.transferPendingTransactions(pendingTransactions, user_wallet as Wallet, userId);
          } else {
            console.warn('⚠️ Wallet introuvable, conservation des transactions en attente');
          }
        },
        error: (error) => {
          console.error('❌ Erreur lors de l\'abonnement au wallet:', error);
        }
      });
    } catch (error) {
      console.error('❌ Erreur lors du parsing des transactions en attente:', error);
    }
  }

  /**
   * Transfère les transactions en attente vers le wallet
   */
  private transferPendingTransactions(
    pendingTransactions: Transaction[], 
    wallet: Wallet, 
    userId: string
  ): void {
    const transferObservables = pendingTransactions.map(transaction => 
      this.walletService.addPlanTransactionToExistingWallet(wallet, transaction)
    );

    forkJoin(transferObservables).subscribe({
      next: () => {
        console.log(`✅ ${pendingTransactions.length} transaction(s) de plan transférée(s) avec succès`);
        localStorage.removeItem(`pending_plan_transactions_${userId}`);
      },
      error: (error) => {
        console.error('❌ Erreur lors du transfert des transactions:', error);
        const failedKey = `failed_plan_transactions_${userId}`;
        localStorage.setItem(failedKey, JSON.stringify({
          transactions: pendingTransactions,
          failedAt: new Date().toISOString(),
          error: error.message
        }));
      }
    });
  }

  // ============================================================================
  // 5. WALLET ET BALANCE
  // ============================================================================

  /**
   * Met à jour la balance du wallet
   */
  updateBalance(): void {
    this.balance$ = this.walletService.balance$;

    this.walletService.balance$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(balance => {
      const previousCoins = this.userBalance.coins || 0;
      this.userBalance = balance || { coins: 0, coupons: 0 };

      // Animation si les coins ont changé
      if (previousCoins !== this.userBalance.coins) {
        this.showCoinAnimation = true;
        setTimeout(() => this.showCoinAnimation = false, 800);
      }

      this.balanceChange.emit(this.userBalance);
      this.cdr.markForCheck();
    });
  }

  /**
   * Exécute l'achat de coins après un paiement
   */
  performCoinPurchase(): void {
    const raw = sessionStorage.getItem('payment_result');
    if (!raw) return;

    const { success, method, context } = JSON.parse(raw);
    

    if (success && context.reason === 'purchase_pack') {
      const pack = context.pack as Pack;
      this.walletService.purchasePackCoins(pack, pack.itemType as "coins", method).subscribe({
        next: (wallet) => {
          this.userBalance = wallet.balance;
          this.showToast('Paiement réussi !', 'success');
          sessionStorage.removeItem('payment_result');
        },
        error: (err) => {
          console.error('Erreur livraison pack:', err);
          this.showToast('Paiement reçu mais erreur de livraison.', 'error');
        }
      });
    }
  }

  /**
   * Ouvre le modal d'achat de coins
   */
  async buyCoins(): Promise<void> {
    const modal = await this.modalController.create({
      component: BuyCoinModalComponent,
      componentProps: {},
      cssClass: 'buy-coin-modal',
      initialBreakpoint: 0.66,
      breakpoints: [0, 0.66, 1],
      backdropDismiss: true
    });

    await modal.present();

    modal.onDidDismiss().then((data) => {
      if (data.data && data.data.success) {
        this.performCoinPurchase();
        this.walletService.reloadWallet();
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Ouvre le modal de gestion des coupons
   */
  async openCouponModal(): Promise<void> {
    const modal = await this.modalController.create({
      component: CouponModalComponent,
      cssClass: 'coupon-management-modal',
      breakpoints: [0, 0.8, 1],
      initialBreakpoint: 0.8,
      backdropDismiss: true,
      componentProps: {
        mode: CouponModalMode.MANAGEMENT,
        artistName: 'Best Academy',
        challengeName: 'Gestion des coupons'
      }
    });

    await modal.present();

    modal.onDidDismiss().then((data) => {
      if (data.data && data.data.success) {
        this.walletService.reloadWallet();
        this.cdr.markForCheck();
      }
    });
  }

  // ============================================================================
  // 6. ABONNEMENT
  // ============================================================================

  /**
   * Vérifie le statut de l'abonnement
   */
  async checkSubscriptionStatus(): Promise<void> {
    try {
     this.authService.currentProfile$.subscribe({
        next:(profile)=>{
          if(profile?.memberShip){
            this.updateUserInfo(profile);
            this.updateSubscriptionStatus(profile);
            this.currentUserProfile.emit(profile);
          }
        },
        error:()=> this.subscriptionStatus = 'inactive'
     })
      
      this.currentSubscriptionStatus.emit(this.subscriptionStatus);
    } catch (error) {
      console.error('Erreur lors de la vérification de l\'abonnement:', error);
      this.subscriptionStatus = 'inactive';
    }
  }

  

  /**
   * Met à jour les informations utilisateur
   */
  private updateUserInfo(user: any): void {
    this.userXp = user.xpPercent;
    this.userLvl = user.level;
    this.userAvatar = user.avatar;
    this.userId = user.id;
  }

  /**
   * Met à jour le statut d'abonnement
   */
  private updateSubscriptionStatus(user: any): void {
    const endDate = new Date(user.userInfo.memberShip.date);
    const today = new Date();

    if (endDate < today || user.userInfo.memberShip.plan == 'Exhibition') {
      this.subscriptionStatus = 'expired';
    } else if (this.isExpiringSoon(endDate)) {
      this.subscriptionStatus = 'expiring';
    } else {
      this.subscriptionStatus = 'active';
    }
  }

  /**
   * Vérifie si l'abonnement expire bientôt
   */
  private isExpiringSoon(endDate: Date): boolean {
    const today = new Date();
    const timeDiff = endDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return daysDiff <= 7;
  }

  /**
   * Retourne le statut d'abonnement
   */
  getSubscriptionStatus(): string {
    return this.subscriptionStatus;
  }

  // ============================================================================
  // 7. RÉCOMPENSES QUOTIDIENNES
  // ============================================================================

  /**
   * Initialise les récompenses quotidiennes
   */
  private initializeDailyRewards(): void {
    this.initialiserRecompenses();
  }

  /**
   * Initialise les récompenses quotidiennes avec les données de l'utilisateur
   */
  private async initialiserRecompenses(): Promise<void> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser?.id) {
        console.warn('Utilisateur non connecté pour les récompenses quotidiennes');
        return;
      }

      const etat = await this.dailyRewards.chargerStatutRecompenses(currentUser.id);

      this.recompensesQuotidiennes = etat.recompenses;
      this.tableauJours = this.dailyRewards.getTableauJours();
      this.indexJourActuel = etat.indexJourActuel;
      this.estWeekend = etat.estWeekend;
      this.peutReclamerAujourdHui = etat.peutReclamerAujourdHui;
    } catch (error) {
      console.error('Erreur lors de l\'initialisation des récompenses quotidiennes:', error);
    }
  }

  /**
   * Ouvre le modal des récompenses
   */
  async openRewardModal(): Promise<void> {
    await this.rewardModal.present();
  }

  /**
   * Réclame la récompense quotidienne
   */
  async reclamerRecompenseQuotidienne(modalElement: any): Promise<void> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser?.id) {
        await this.showToast('Utilisateur non connecté', 'error');
        return;
      }

      const resultat = await this.dailyRewards.reclamerRecompenseQuotidienne(
        currentUser.id,
        this.indexJourActuel
      );

      if (resultat.succes) {
        await this.rewardService.updateRewardsForLevel(
          currentUser.id.toString(),
          0,
          100
        ).toPromise();

        if (resultat.recompensesMisesAJour) {
          this.recompensesQuotidiennes = resultat.recompensesMisesAJour;
        }
        this.peutReclamerAujourdHui = false;

        await this.showToast(resultat.message, 'success');

        // Fermeture auto
        setTimeout(() => modalElement.dismiss(), 800);
      } else {
        await this.showToast(resultat.message, 'warning');
      }
    } catch (error) {
      console.error('Erreur lors de la réclamation de la récompense:', error);
      await this.showToast('Erreur lors de la réclamation', 'error');
    }
  }

  /**
   * Obtient le message des récompenses
   */
  getMessageRecompense(): string {
    return this.dailyRewards.getMessageRecompense(this.peutReclamerAujourdHui, this.estWeekend);
  }

  /**
   * Obtient le texte du bouton
   */
  getTexteBouton(): string {
    return this.dailyRewards.getTexteBouton(this.peutReclamerAujourdHui, this.estWeekend);
  }

  // ============================================================================
  // 8. MENU ET NAVIGATION
  // ============================================================================

  /**
   * Bascule l'état du menu burger
   */
  toggleBurgerMenu(): void {
    this.isBurgerMenuOpen = !this.isBurgerMenuOpen;
  }

  /**
   * Bascule l'état de collapse du menu
   */
  toggleMenuCollapse(): void {
    this.isMenuCollapsed = !this.isMenuCollapsed;
  }

  /**
   * Ferme le menu burger
   */
  closeBurgerMenu(): void {
    this.isBurgerMenuOpen = false;
  }

  /**
   * Gère la navigation depuis le menu
   */
  onMenuNavigationChange(item: any): void {
    this.closeBurgerMenu();
    this.navigationChange.emit(item);
  }

  /**
   * Navigue vers une destination
   */
  navigateTo(destination: string): void {
    this.router.navigate([destination]);
  }

  /**
   * Navigue vers le profil de l'utilisateur
   */
  goToProfile(): void {
    if (this.userId !== null && this.userId !== '') {
      this.router.navigate(['/profile', this.userId]);
    }
  }

  /**
   * Vérifie si un onglet est actif
   */
  isTabActive(path: string): boolean {
    if (!path || path.trim() === '') {
      return false;
    }
    const currentUrl = this.router.url;
    return currentUrl === path || currentUrl.endsWith(path) || currentUrl.includes(path);
  }

  /**
   * Vérifie si on est sur la page home
   */
  isHomePage(): boolean {
    return this.router.url.includes('/home');
  }

  /**
   * Gère le retour en arrière
   */
  handleGoBack(): void {
    this.goBack.emit({ target: this.goBackTarget as Segment });
  }

  // ============================================================================
  // 9. ANIMATIONS
  // ============================================================================

  /**
   * Animation d'entrée pour les modals
   */
  enterAnimation = (baseEl: HTMLElement) => {
    const root = baseEl.shadowRoot;

    const backdropAnimation = this.animationCtrl
      .create()
      .addElement(root!.querySelector('ion-backdrop')!)
      .fromTo('opacity', '0.01', 'var(--backdrop-opacity)');

    const wrapperAnimation = this.animationCtrl
      .create()
      .addElement(root!.querySelector('.modal-wrapper')!)
      .keyframes([
        { offset: 0, opacity: '0', transform: 'scale(0)' },
        { offset: 1, opacity: '0.99', transform: 'scale(1)' },
      ]);

    return this.animationCtrl
      .create()
      .addElement(baseEl)
      .easing('ease-out')
      .duration(500)
      .addAnimation([backdropAnimation, wrapperAnimation]);
  };

  /**
   * Animation de sortie pour les modals
   */
  leaveAnimation = (baseEl: HTMLElement) => {
    return this.enterAnimation(baseEl).direction('reverse');
  };

  /**
   * Callback pour l'animation Lottie
   */
  onCoinAnimationCreated(animationItem: any): void {
    // Animation Lottie créée
  }

  // ============================================================================
  // 10. UTILITAIRES
  // ============================================================================

  /**
   * Gère l'erreur de chargement de l'avatar
   */
  onImageAvatarError(event: any): void {
    const imgElement = event.target as HTMLImageElement;
    imgElement.onerror = null;
    imgElement.src = 'assets/avatar-default.png';
    imgElement.classList.add('is-default');
  }

  /**
   * Affiche un toast
   */
  private async showToast(message: string, type: 'success' | 'error' | 'warning' = 'success'): Promise<void> {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'bottom',
      color: type === 'success' ? 'success' : type === 'error' ? 'danger' : 'warning',
      cssClass: `custom-toast ${type}-toast`
    });
    await toast.present();
  }

  // ============================================================================
  // 11. DESTRUCTION
  // ============================================================================

  /**
   * Nettoie les ressources
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}