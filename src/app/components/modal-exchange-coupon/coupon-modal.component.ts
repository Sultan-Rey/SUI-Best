import { Component, Input, ViewChild, ElementRef, AfterViewInit, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediaUrlPipe } from '../../utils/pipes/mediaUrlPipe/media-url-pipe';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, AlertController, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { Coupon } from '../../../models/Coupon';
import { Auth } from '../../../services/AUTH/auth';
import { ProfileService } from '../../../services/PROFILE_SERVICE/profile-service';
import { WalletService } from '../../../services/WALLET_SERVICE/wallet-service';
import { switchMap, map, catchError, filter } from 'rxjs/operators';
import { forkJoin, take, of, tap, Observable } from 'rxjs';
import { VoteService } from 'src/services/VOTE_SERVICE/vote-service';
import { VoteRule } from 'src/models/Challenge';
import { stringify } from 'uuid';
import { UserProfile } from 'src/models/User';
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
  addCircleOutline,
  layersOutline,
  walletOutline,
  informationCircleOutline,
  ellipsisHorizontal
} from 'ionicons/icons';
import { Vote, VoteStatusResponse } from 'src/models/Vote';
import { CreationService } from 'src/services/CREATION_SERVICE/creation-service';

// Interface pour les coupons

@Component({
  selector: 'app-coupon-modal',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, MediaUrlPipe],
  templateUrl: './coupon-modal.component.html',
  styleUrls: ['./coupon-modal.component.scss']
})
export class CouponModalComponent implements OnInit {
  @Input() artistName: string = 'Artiste';
  @Input() artistAvatar: string = 'assets/avatar-default.png';
  @Input() challengeName: string = 'Challenge';
  @Input() postId: string = '';
  @Input() userId: string = '';
  @Input() challengeId: string = '';
  @Input() usageRule: VoteRule = VoteRule.UNLIMITED_VOTES;
  @ViewChild('slideButton') slideButton!: ElementRef;
  @ViewChild('slideTrack') slideTrack!: ElementRef;


  availableCoupons: Coupon[] = []
  allCoupons: Coupon[] = []; // Stocker tous les coupons pour le chargement progressif
  selectedCoupon: Coupon | null = null;
  slidePosition: number = 0;
  isSliding: boolean = false;
  voteConfirmed: boolean = false;
  showOptions = false;
  burnCoupon: boolean = false;
  isBurnable: boolean = false;
  isLoading: boolean = true;
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

  // Propriétés pour le chargement progressif
  private batchSize = 6;
  private currentIndex = 0;
  private _isLoadingMore = false;
  private _hasMoreCoupons = true;

  constructor(private modalController: ModalController,
    private auth: Auth,
    private walletService: WalletService,
    private creationService: CreationService,
    private toastController: ToastController,
    private cdr: ChangeDetectorRef,
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
      addCircleOutline,
      layersOutline,
      informationCircleOutline,
      ellipsisHorizontal,
      helpCircleOutline,
      walletOutline
    });
  }
  ngOnInit(): void {
    // Forcer la réinitialisation des états
    this.burnCoupon = false;
    this.selectedCoupon = null;
    this.isBurnable = false;

    this.loadAvailableCoupons();
  }

  // Getters pour le template
  get isLoadingMore(): boolean {
    return this._isLoadingMore;
  }

  get hasMoreCoupons(): boolean {
    return this._hasMoreCoupons;
  }

  //#region LOADERS
  private loadAvailableCoupons(): void {
    this.isLoading = true;
    this.currentIndex = 0;
    this._hasMoreCoupons = true;
    this.availableCoupons = []; // Initialiser le tableau vide

    // Attendre que le wallet soit chargé avant de récupérer les coupons
    this.walletService.wallet$.pipe(
      filter(wallet => wallet !== null), // Attendre que le wallet soit non null
      take(1), // Prendre seulement le premier wallet non null
      switchMap(wallet => {
        return this.walletService.getUserCoupons();
      })
    ).subscribe({
      next: (allCoupons: Coupon[]) => {
        this.allCoupons = allCoupons; // Stocker tous les coupons
        this.loadNextBatch();
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des coupons:', error);
        this.isLoading = false;
      }
    });
  }

  private loadNextBatch(): void {

    if (!this._hasMoreCoupons || this._isLoadingMore) return;

    this._isLoadingMore = true;

    // Organiser les coupons par type pour garantir la diversité
    const couponsByType = this.groupCouponsByType(this.allCoupons);
    const types = ['standard', 'premium', 'legendary', 'special'];

    // Créer un lot avec 1 coupon de chaque type disponible (max 6)
    const nextBatch: Coupon[] = [];
    let batchCount = 0;

    for (const type of types) {
      if (batchCount >= this.batchSize) break;

      const typeCoupons = couponsByType[type] || [];
      const unusedCoupons = typeCoupons.filter(coupon =>
        !this.availableCoupons.some(available => available.id === coupon.id)
      );

      if (unusedCoupons.length > 0) {
        nextBatch.push(unusedCoupons[0]); // Prendre le premier disponible de ce type
        batchCount++;
      }
    }

    // Si on a moins de 6 coupons, compléter avec les coupons restants
    if (nextBatch.length < this.batchSize) {
      const remainingCoupons = this.allCoupons.filter(coupon =>
        !this.availableCoupons.some(available => available.id === coupon.id) &&
        !nextBatch.some(batch => batch.id === coupon.id)
      );

      const remainingNeeded = this.batchSize - nextBatch.length;
      nextBatch.push(...remainingCoupons.slice(0, remainingNeeded));
    }

    console.log('Chargement lot par types:', {
      batchSize: nextBatch.length,
      typesInBatch: nextBatch.map(c => c.type),
      batchDetails: nextBatch.map(c => ({ id: c.id, name: c.name, type: c.type }))
    });

    // Ajouter le nouveau lot aux coupons disponibles
    this.availableCoupons = [...this.availableCoupons, ...nextBatch];
    this.currentIndex += nextBatch.length;

    // Vérifier s'il reste des coupons
    const totalUsed = this.availableCoupons.length;
    this._hasMoreCoupons = totalUsed < this.allCoupons.length;

    this._isLoadingMore = false;

    console.log('Coupons disponibles après chargement:', this.availableCoupons.length);
    console.log(`Chargé ${nextBatch.length} coupons, reste: ${this.allCoupons.length - totalUsed}`);
  }

  //#endregion

  private groupCouponsByType(coupons: Coupon[]): Record<string, Coupon[]> {
    return coupons.reduce((groups, coupon) => {
      if (!groups[coupon.type]) {
        groups[coupon.type] = [];
      }
      groups[coupon.type].push(coupon);
      return groups;
    }, {} as Record<string, Coupon[]>);
  }

  private checkIsBurnable(){
    if(this.usageRule === VoteRule.UNLIMITED_VOTES){
      return false; // En mode illimité, on n'utilise qu'1 vote à la fois
    }
    return true; // En mode ONE_VOTE_PER_USER, on brûle le coupon entier
  }
  //#region DOM Interactions
  // Méthode appelée lorsque l'utilisateur atteint la fin du slider
  onSliderReachEnd(): void {
    if (this._hasMoreCoupons && !this._isLoadingMore) {
      this.loadNextBatch();
    }
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


  private confirmVote() {
    if (!this.selectedCoupon) return;

   

    // Utilisation de la valeur de burnCoupon pour déterminer la quantité à décrémenter
    const usageValue = this.burnCoupon == true ? this.selectedCoupon.usageValue : 1;
    console.log("usageValue: "+usageValue);
     //preparation du vote
    const voteData:Vote = {
      userId: this.userId,
      contentId: this.postId,
      challengeId: this.challengeId,
      nbVotes: usageValue,
      createdAt: Date.now().toString()
    };

    // Chaîner les opérations pour assurer l'atomicité
    this.walletService.decrementUserCouponUsage(this.selectedCoupon.id, usageValue).pipe(
      tap(() => {
        // Mettre à jour la liste des coupons après l'utilisation
        this.loadAvailableCoupons();
      }),
      switchMap(() =>
        // Si le décrément a réussi, on ajoute le vote
        this.creationService.addVoteToContent(
          voteData,
          this.usageRule
        ).pipe(
          tap(() => this.selectedCoupon = null)
        )
      )
    ).subscribe({
      next: () => {
        // Afficher un message de succès
        this.toastController.create({
          message: 'Vote confirmé',
          duration: 2000,
          color: 'success',
          position: 'bottom'
        }).then(toast => toast.present());
        this.closeModal(true, 'Vote confirmé');
      },
      error: (error: any) => {
        console.error('Erreur lors de la confirmation du vote:', error);
        this.closeModal(false, 'Erreur lors du vote');
      }
    });
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


  //#endregion

  //#region  GET ND SET Coupons
  selectCoupon(coupon: Coupon): void {
    this.selectedCoupon = coupon;
    this.voteConfirmed = false;
    this.slidePosition = 0;
    this.burnCoupon = this.checkIsBurnable();
    
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

  //#endregion

  //#region OPTIONS
  toggleOptions() {
    this.showOptions = !this.showOptions;
  }

  selectOption(optionId: string) {
    this.toggleOptions();
    this.handleCouponOption(optionId);
  }

  handleCouponOption(optionId: string) {
    if (optionId === 'buy') {
      // Rediriger vers le wallet pour acheter des coupons
      window.location.href = '/wallet';
      return;
    }

    // Autres options à implémenter plus tard
    console.log('Option sélectionnée:', optionId);
  }
  //#endregion
  //#region UTILS
  private closeModal(success: boolean, message: string = '', VoteValue: number = 1) {
    this.modalController.dismiss({
      success,
      message,
      couponId: this.selectedCoupon?.id,
      voteValue: VoteValue,
      postId: this.postId
    });
  }

  dismiss(): void {
    this.modalController.dismiss({
      success: false,
      message: 'Vote annulé'
    });
  }

  //#endregion    



}