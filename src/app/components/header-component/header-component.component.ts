import { Component, EnvironmentInjector, inject, OnInit, ViewChild, ElementRef } from '@angular/core';
import {  Router, ActivatedRoute } from '@angular/router';
import { IonHeader, IonChip, IonIcon, IonLabel, IonText, IonImg, IonButtons, IonBackButton } from "@ionic/angular/standalone";
import { Observable, shareReplay, Subject, takeUntil } from 'rxjs';
import { NgClass, NgIf } from '@angular/common';
import { FireAuth } from 'src/services/AUTH/fireAuth/fire-auth';
import { ProfileService } from 'src/services/PROFILE_SERVICE/profile-service';
import { AnimationService } from 'src/services/ANIMATION_SERVICE/animation-service';
import { BuyCoinModalComponent } from '../modal-buy-coin/buy-coin-modal.component';
import { ModalController, ToastController} from '@ionic/angular';
import { UserBalance, WalletService } from 'src/services/WALLET_SERVICE/wallet-service';
import { LottieComponent } from 'ngx-lottie';
import { ShortNumberPipe } from 'src/app/utils/pipes/shortNumberPipe/short-number-pipe';
@Component({
  selector: 'app-header-component',
  templateUrl: './header-component.component.html',
  styleUrls: ['./header-component.component.scss'],
  providers: [ModalController],
  imports: [NgClass,NgIf, IonHeader, IonChip, IonIcon, IonLabel, IonText, IonImg, IonButtons, IonBackButton, LottieComponent, ShortNumberPipe]
})
export class HeaderComponentComponent  implements OnInit {
  public environmentInjector = inject(EnvironmentInjector);
   activeTab = 'home';
   private destroy$ = new Subject<void>();
    balance$!: Observable<UserBalance>;
    userBalance: UserBalance = { coins: 0, coupons: 0 };
   subscriptionStatus: 'active' | 'expiring' | 'expired' | 'inactive' = 'inactive';
   // Animation Lottie pour les coins
   showCoinAnimation: boolean = false;
  constructor(private router: Router,
      private route: ActivatedRoute, 
     private profileService: ProfileService, 
      private authService: FireAuth,
      public animService: AnimationService,
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
    }


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

   openSearch() {
   this.router.navigate(['/search']);
  }


  navigateTo(destination: string) {
  this.router.navigate([destination]);
}
 
// Méthode pour vérifier si un onglet est actif
isTabActive(path: string): boolean {
  return this.router.url.includes(path);
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

}
