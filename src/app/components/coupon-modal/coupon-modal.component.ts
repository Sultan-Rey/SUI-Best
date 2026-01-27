import { Component, Input, ViewChild, ElementRef, AfterViewInit, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController, AlertController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { getMediaUrl} from 'src/app/utils/media.utils.js';
import { Coupon } from '../../../models/coupon';
import { Auth } from '../../../services/AUTH/auth';
import { ProfileService } from '../../../services/PROFILE_SERVICE/profile-service';
import { CouponService } from '../../../services/COUPON_SERVICE/coupon-service';
import { switchMap, map } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';

import { 
  ticketOutline, 
  star, 
  trophy, 
  sparkles, 
  flash, 
  flame,
  timeOutline, 
  checkmarkCircle,
  chevronForward,
  arrowForward,
  close,
  helpCircleOutline,
  walletOutline,
  informationCircleOutline,
  ellipsisHorizontal
} from 'ionicons/icons';
import { VoteService } from 'src/services/VOTE_SERVICE/vote-service';
import { VoteRule } from 'src/models/Challenge';
// Interface pour les coupons

@Component({
  selector: 'app-coupon-modal',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './coupon-modal.component.html',
  styleUrls: ['./coupon-modal.component.scss']
})
export class CouponModalComponent implements OnInit  {
  @Input() artistName: string = 'Artiste';
  @Input() artistAvatar: string = 'assets/avatar-default.png';
  @Input() challengeName: string = 'Challenge';
  @Input() postId: string = '';
  @Input() usageRule: VoteRule = VoteRule.UNLIMITED_VOTES;
  @ViewChild('slideButton') slideButton!: ElementRef;
  @ViewChild('slideTrack') slideTrack!: ElementRef;

  
  availableCoupons: Coupon[] = []
  selectedCoupon: Coupon | null = null;
  slidePosition: number = 0;
  isSliding: boolean = false;
  voteConfirmed: boolean = false;
showOptions = false;
couponOptions = [
  {
    id: 'buy',
    label: 'Acheter un coupon',
    icon: 'wallet-outline',
    color: 'primary'
  },
  {
    id: 'raffle',
    label: 'Tombola & Tirage au sort',
    icon: 'ticket-outline',
    color: 'tertiary'
  },
  {
    id: 'quiz',
    label: 'Quick Quiz',
    icon: 'help-circle-outline',
    color: 'secondary'
  }
];

  private startX: number = 0;
  private maxSlideDistance: number = 0;
  private slideThreshold: number = 0.85;

  voteStatus = {
  isVoted: false,
  isBlocked: false
};

  constructor(private modalController: ModalController, 
    private auth: Auth,
    private profileService: ProfileService,
    private couponService: CouponService,
     private voteService: VoteService
) {
    addIcons({ 
      ticketOutline, 
      star, 
      trophy, 
      sparkles, 
      flash,
      flame, 
      timeOutline, 
      checkmarkCircle,
      chevronForward,
      arrowForward,
      close,
      informationCircleOutline,
      ellipsisHorizontal,
      helpCircleOutline,
      walletOutline
    });
  }
  ngOnInit(): void {
    this.loadAvailableCoupons()
  }

   private loadAvailableCoupons() {
    const currentUser = this.auth.getCurrentUser();
    if (!currentUser?.id) {
      console.error('Aucun utilisateur connecté');
      return;
    }

     if (currentUser && this.postId) {
    this.voteService.checkUserVoteStatus(currentUser?.id as string, this.postId).subscribe({
      next: (status) => {
        this.voteStatus = status;
      },
      error: (error) => {
        console.error('Erreur lors de la vérification du vote:', error);
      }
    });
  }

    this.profileService.getProfileById(currentUser.id as string).pipe(
      switchMap(profile => {
        if (!profile?.myCoupons?.length) {
          return of([]);
        }
        
        // Récupère tous les coupons de l'utilisateur
        const couponObservables = profile.myCoupons.map(couponId => 
          this.couponService.getCouponById(couponId)
        );
        
        return forkJoin(couponObservables).pipe(
          map(coupons => 
            // Filtre les coupons valides (non expirés et usageValue > 0)
            coupons.filter(coupon => 
              coupon && 
              (!coupon.expiresAt || new Date(coupon.expiresAt) > new Date()) &&
              coupon.usageValue > 0
            )
          )
        );
      })
    ).subscribe({
      next: (validCoupons) => {
        this.availableCoupons = validCoupons;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des coupons', error);
      }
    });
  }

  



selectCoupon(coupon: Coupon): void {
  this.selectedCoupon = coupon;
  this.voteConfirmed = false;
  this.slidePosition = 0;
  
  // Recalculer la distance après la sélection
  setTimeout(() => {
    if (this.slideTrack?.nativeElement) {
      const trackWidth = this.slideTrack.nativeElement.offsetWidth;
      const buttonWidth = 46;
      const margins = 8;
      this.maxSlideDistance = trackWidth - buttonWidth - margins;
    }
  }, 50);
}
 

  getCouponIcon(type: string): string {
    const icons: { [key: string]: string } = {
      standard: 'ticket-outline',
      premium: 'star',
      legendary: 'trophy',
      special: 'sparkles'
    };
    return icons[type] || 'ticket-outline';
  }

  getExpiryText(date: Date): string {
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return "aujourd'hui";
    } else if (diffDays === 1) {
      return 'dans 1 jour';
    } else if (diffDays < 7) {
      return `dans ${diffDays} jours`;
    } else {
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    }
  }

  // Gestion du slide pour mobile (touch)
  onTouchStart(event: TouchEvent): void {
    if (!this.selectedCoupon || this.voteConfirmed) return;
    
    this.isSliding = true;
    this.startX = event.touches[0].clientX;
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.selectedCoupon || this.voteConfirmed || !this.isSliding) return;
    
    event.preventDefault();
    const currentX = event.touches[0].clientX;
    const diff = currentX - this.startX;

    // Limiter le mouvement entre 0 et maxSlideDistance
    this.slidePosition = Math.max(0, Math.min(diff, this.maxSlideDistance));
  }

  onTouchEnd(): void {
    if (!this.selectedCoupon || this.voteConfirmed) return;
    this.checkSlideCompletion();
  }

  // Gestion du slide pour desktop (mouse)
  onMouseDown(event: MouseEvent): void {
    if (!this.selectedCoupon || this.voteConfirmed) return;
    
    this.isSliding = true;
    this.startX = event.clientX;

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isSliding) return;
      const diff = e.clientX - this.startX;
      this.slidePosition = Math.max(0, Math.min(diff, this.maxSlideDistance));
    };

    const onMouseUp = () => {
      this.checkSlideCompletion();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp, { once: true });
  }

  private checkSlideCompletion(): void {
    this.isSliding = false;

    // Vérifier si le slide a atteint le seuil
    if (this.slidePosition >= this.maxSlideDistance * this.slideThreshold) {
      // Compléter le slide
      this.slidePosition = this.maxSlideDistance;
      this.confirmVote();
    } else {
      // Revenir à la position initiale avec animation
      this.slidePosition = 0;
    }
  }

private confirmVote(): void {
  if (!this.selectedCoupon) return;
  
  this.voteService.setVoteRule(this.usageRule);
  

  // Chaîner les opérations pour assurer l'atomicité
  this.couponService.decrementCouponUsage(this.selectedCoupon.id).pipe(
    switchMap(updatedCoupon => {
      // Mettre à jour le coupon dans la liste
      const index = this.availableCoupons.findIndex(c => c.id === updatedCoupon.id);
      if (index !== -1) {
        this.availableCoupons[index] = updatedCoupon;
      }
      
      // Si le décrément a réussi, on ajoute le vote
      return this.voteService.addVote(
        this.auth.getCurrentUser()?.id as string, 
        this.postId
      );
    })
  ).subscribe({
    next: () => {
      this.voteConfirmed = true;
      this.closeModal(true)},
    error: (error) => {
      console.error('Erreur lors du vote', error);
      this.closeModal(false, 'Erreur lors du vote');
      // Ici, vous pourriez vouloir annuler le décrément du coupon
      // en cas d'échec du vote (si votre API le permet)
    }
  });
}

private closeModal(success: boolean, message: string = '') {
  this.modalController.dismiss({
    success,
    message,
    couponId: this.selectedCoupon?.id,
    voteValue: this.selectedCoupon?.usageValue,
    postId: this.postId
  });
}

  dismiss(): void {
    this.modalController.dismiss({
      success: false,
      message: 'Vote annulé'
    });
  }

  getMediaUrl(relativePath: string): string {
  return getMediaUrl(relativePath);
}

toggleOptions() {
  this.showOptions = !this.showOptions;
}

selectOption(optionId: string) {
  this.toggleOptions();
  this.handleCouponOption(optionId);
}

handleCouponOption(optionId: string){

}


}