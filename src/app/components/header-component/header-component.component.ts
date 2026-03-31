import { Component, EnvironmentInjector, inject, OnInit, ViewChild, ElementRef, Input, Output, EventEmitter } from '@angular/core';
import {  Router, ActivatedRoute } from '@angular/router';
import { IonHeader, IonChip, IonIcon, IonLabel, IonText, IonImg, IonButtons, IonBackButton, IonModal, IonButton } from "@ionic/angular/standalone";
import { Observable, shareReplay, Subject, takeUntil } from 'rxjs';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { addIcons } from 'ionicons';
import { checkmark } from 'ionicons/icons';
import { Auth } from 'src/services/AUTH/auth';
import { ProfileService } from 'src/services/Service_profile/profile-service';
import { RewardService } from 'src/services/Rewards/reward-service';
import { DailyRewards } from 'src/services/Rewards/daily-rewards';
import { AnimationService } from 'src/services/Animation/animation-service';
import { BuyCoinModalComponent } from '../modal-buy-coin/buy-coin-modal.component';
import { ModalController, ToastController, AnimationController} from '@ionic/angular';
import { UserBalance, WalletService } from 'src/services/Service_wallet/wallet-service';
import { LottieComponent } from 'ngx-lottie';
import { ShortNumberPipe } from 'src/app/utils/pipes/shortNumberPipe/short-number-pipe';
import { CurrencyPipe } from '@angular/common';
import { Segment } from 'src/models/Segment';
@Component({
  selector: 'app-header-component',
  templateUrl: './header-component.component.html',
  styleUrls: ['./header-component.component.scss'],
  providers: [ModalController],
  imports: [IonButton, IonModal, NgClass,NgIf, NgFor, IonHeader, IonChip, IonIcon, IonLabel, IonText, IonImg, IonButtons, IonBackButton, LottieComponent, ShortNumberPipe, CurrencyPipe]
})
export class HeaderComponentComponent  implements OnInit {
  public environmentInjector = inject(EnvironmentInjector);
   activeTab = 'home';
   private destroy$ = new Subject<void>();
    balance$!: Observable<UserBalance>;
    userBalance: UserBalance = { coins: 0, coupons: 0 };
    userXp!: number;
    userLvl!:number;
   subscriptionStatus: 'active' | 'expiring' | 'expired' | 'inactive' = 'inactive';
   // Animation Lottie pour les coins
   showCoinAnimation: boolean = false;
   
   // Propriétés pour gérer le retour
   @Input() goBackTarget: Segment | undefined;
   @Output() goBack = new EventEmitter<{ target: Segment }>();

   // ViewChild pour le modal de récompenses
   @ViewChild('rewardModal') rewardModal!: IonModal;

   // Propriétés pour les récompenses quotidiennes
   recompensesQuotidiennes: Record<string, any> = {};
   tableauJours: string[] = [];
   indexJourActuel = 0;
   estWeekend = false;
   peutReclamerAujourdHui = false;
  constructor(private router: Router,
      private route: ActivatedRoute, 
     private profileService: ProfileService, 
      private authService: Auth,
      private rewardService: RewardService,
      private dailyRewards: DailyRewards,
      public animService: AnimationService,
      private animationCtrl: AnimationController,
     private modalController: ModalController, 
      private toastController: ToastController,
     private walletService: WalletService
  ) {
     // 1. S'abonner aux changements d'authentification
      this.authService.currentUser$
        .pipe(takeUntil(this.destroy$))
        .subscribe(user => {
          if (user) {
            this.checkSubscriptionStatus();
          } else {
            this.subscriptionStatus = 'inactive';
          }
        });
   }

  ngOnInit() {
    addIcons({checkmark});
     this.balance$ = this.walletService.balance$;
      this.balance$.subscribe(balance => {
        const previousCoins = this.userBalance.coins || 0;
        
        this.userBalance = balance || { coins: 0, coupons: 0 };
        
        // Trigger animation if values changed
        if (previousCoins !== this.userBalance.coins) {
          this.showCoinAnimation = true
          setTimeout(() => this.showCoinAnimation = false, 800);
        }
      });
      
      // Initialiser les récompenses quotidiennes
      this.initialiserRecompenses();
    }

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
    
      leaveAnimation = (baseEl: HTMLElement) => {
        return this.enterAnimation(baseEl).direction('reverse');
      };

  // Callback pour l'animation Lottie
  onCoinAnimationCreated(animationItem: any) {
    console.log('Coin Lottie animation created:', animationItem);
  }

   private async showToast(message: string, type: 'success' | 'error' | 'warning' = 'success') {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'bottom',
      color: type === 'success' ? 'success' : type === 'error' ? 'danger' : 'warning',
      cssClass: `custom-toast ${type}-toast`
    });
    await toast.present();
  }

  // Acheter des coins
  async buyCoins() {
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
        // Forcer le rechargement du wallet pour mettre à jour la balance
        this.walletService.reloadWallet();
      }
    });
  }

   // Méthode pour ouvrir le modal des récompenses
  async openRewardModal() {
    await this.rewardModal.present();
  }

  // Méthode pour gérer le retour
  handleGoBack(): void {
    this.goBack.emit({ target: this.goBackTarget as Segment });
    
  }

  openSearch() {
   this.router.navigate(['/search']);
  }


  navigateTo(destination: string) {
  this.router.navigate([destination]);
}
 
// Méthode pour vérifier si un onglet est actif
isTabActive(path: string): boolean {
  if (!path || path.trim() === '') {
    return false;
  }
  const currentUrl = this.router.url;
 
  const isroute =  currentUrl === path || currentUrl.endsWith(path) || currentUrl.includes(path);

  // Vérification exacte ou包含
  return isroute;
}

// Vérifier si on est sur la page home
isHomePage(): boolean {
  return this.router.url.includes('/home');
}

     async checkSubscriptionStatus() {
  try {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.id) {
      this.subscriptionStatus = 'inactive';
      return;
    }

    const user = await this.profileService.getProfileById(currentUser.id.toString()).toPromise();
  
    if (user?.userInfo.memberShip) {
      this.userXp = user.xpPercent;
      this.userLvl = user.level;
      const endDate = new Date(user.userInfo.memberShip.date);
      const today = new Date();
      
      if (endDate < today || user.userInfo.memberShip.plan == 'Exhibition') {
        this.subscriptionStatus = 'expired';
      } else if (this.isExpiringSoon(endDate)) {
        this.subscriptionStatus = 'expiring';
      } else {
        this.subscriptionStatus = 'active';
      }
    } else {
      this.subscriptionStatus = 'inactive';
    }
  } catch (error) {
    console.error('Erreur lors de la vérification de l\'abonnement:', error);
    this.subscriptionStatus = 'inactive';
  }
}

private isExpiringSoon(endDate: Date): boolean {
  const today = new Date();
  const timeDiff = endDate.getTime() - today.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  return daysDiff <= 7; // Moins de 7 jours restants
}

getSubscriptionStatus() {
   
    return this.subscriptionStatus;
  }

  // Méthodes pour les récompenses quotidiennes
  
  /**
   * Initialise les récompenses quotidiennes
   */
  private async initialiserRecompenses() {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser?.id) {
        console.warn('Utilisateur non connecté pour les récompenses quotidiennes');
        return;
      }

      // Utiliser le service DailyRewards
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
   * Réclame la récompense quotidienne
   */
  async reclamerRecompenseQuotidienne(modalElement: any) {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser?.id) {
        await this.showToast('Utilisateur non connecté', 'error');
        return;
      }

      // Utiliser le service DailyRewards
      const resultat = await this.dailyRewards.reclamerRecompenseQuotidienne(
        currentUser.id, 
        this.indexJourActuel
      );
      
      if (resultat.succes) {
        // Ajouter 100 XP via RewardService
        await this.rewardService.updateRewardsForLevel(
          currentUser.id.toString(),
          0, 
          100 
        ).toPromise();
        
        // Mettre à jour l'état local
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

}
