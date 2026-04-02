import { Component, Input, ViewChild, ElementRef, AfterViewInit, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediaUrlPipe } from '../../utils/pipes/mediaUrlPipe/media-url-pipe';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, AlertController, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { Coupon } from '../../../models/Coupon';
import { Auth } from '../../../services/AUTH/auth';
import { WalletService } from '../../../services/Service_wallet/wallet-service';
import { switchMap, map, catchError, filter, takeUntil } from 'rxjs/operators';
import { forkJoin, take, of, tap, Observable, Subject } from 'rxjs';
import { VoteService } from 'src/services/Service_vote/vote-service';
import { VoteRule } from 'src/models/Challenge';

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
  ellipsisHorizontal,
  qrCodeOutline
} from 'ionicons/icons';
import { Vote, VoteStatusResponse } from 'src/models/Vote';
import { ChallengeService } from 'src/services/Service_challenge/challenge-service';
import { BuyCouponModalComponent } from '../modal-buy-coupon/buy-coupon-modal.component';
import { ModalQRscannerComponent } from '../modal-qrscanner/modal-qrscanner.component';
import { CouponModalMode } from 'src/interfaces/coupon.interfaces';
import { IncomeService } from 'src/services/service_income/income-service';
import { isNullOrUndefined } from 'html5-qrcode/esm/core';

@Component({
  selector: 'app-coupon-modal',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, MediaUrlPipe],
  templateUrl: './coupon-modal.component.html',
  styleUrls: ['./coupon-modal.component.scss']
})
export class CouponModalComponent implements OnInit, OnDestroy {
  @Input() artistName: string = 'Artiste';
  @Input() artistAvatar: string = 'assets/avatar-default.png';
  @Input() challengeName: string = 'Challenge';
  @Input() postId: string = '';
  @Input() userId: string = '';
  @Input() challengeId: string = '';
  @Input() usageRule: VoteRule = VoteRule.UNLIMITED_VOTES;
  @Input() mode: CouponModalMode = CouponModalMode.VOTE;
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
      id: 'scan',
      label: 'Charger un coupon',
      icon: 'qr-code-outline',
      color: 'secondary'
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

  private destroy$ = new Subject<void>();

  constructor(private modalController: ModalController,
    private walletService: WalletService,
    private voteService: VoteService,
    private incomeService: IncomeService,
    private challengeService: ChallengeService,
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
      walletOutline,
      qrCodeOutline
    });
  }
 async ngOnInit() {
    // Forcer la réinitialisation des états
    this.burnCoupon = false;
    this.selectedCoupon = null;
    this.isBurnable = false;
    
    if (this.mode === CouponModalMode.VOTE) {
      // Mode VOTE : vérifier si le challenge nécessite un coupon
      const theChallenge = await this.challengeService.getChallengeById(this.challengeId).toPromise();
      if(!theChallenge?.coupon_required){
        this.selectedCoupon = {
          id: 'default'+Date.now().toString(),
          name: 'Aucun requis',
          usageValue: 1,
          description: 'Coupon non requis pour ce challenge',
          type: 'standard',
          expiresAt: new Date(Date.now())
        }
      }else{
        this.loadAvailableCoupons();
      }
    } else {
      // Mode MANAGEMENT : charger tous les coupons disponibles
      this.loadAvailableCoupons();
    }
  }

  // Getters pour le template
  get isVoteMode(): boolean {
    return this.mode === CouponModalMode.VOTE;
  }

  get isManagementMode(): boolean {
    return this.mode === CouponModalMode.MANAGEMENT;
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
      takeUntil(this.destroy$), // Nettoyer à la destruction
      switchMap(wallet => {  
        return this.walletService.getUserCoupons();
      }),
      takeUntil(this.destroy$) // Nettoyer à la destruction
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

   // console.log('Coupons disponibles après chargement:', this.availableCoupons.length);
   // console.log(`Chargé ${nextBatch.length} coupons, reste: ${this.allCoupons.length - totalUsed}`);
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
    //console.log("usageValue: "+usageValue);
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
  takeUntil(this.destroy$), // Nettoyer à la destruction
  tap(() => {
    // Mettre à jour la liste des coupons après l'utilisation
    this.loadAvailableCoupons();
  }),
  switchMap(() => 
    // Créer la transaction pour le wallet admin
    this.walletService.createCouponUsageTransaction(
      this.selectedCoupon?.id || '',
      usageValue,
      this.userId,
      this.postId,
      this.challengeId
    )
  ),
  switchMap(() =>
    // Si la transaction admin est créée, on ajoute le vote
    this.voteService.addVoteToContent(
      voteData,
      this.usageRule
    ).pipe(
      takeUntil(this.destroy$), // Nettoyer à la destruction
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
    if (this.isManagementMode) {
      // En mode MANAGEMENT, on ne sélectionne pas de coupon pour le vote
      return;
    }
    
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

  async handleCouponOption(optionId: string) {
    if (optionId === 'buy') {
        // En mode VOTE, on ferme la modale avant d'ouvrir l'achat
        this.modalController.dismiss().then(()=>{
          this.modalController.create({
            component: BuyCouponModalComponent,
            initialBreakpoint: 0.75,
            breakpoints: [0, 0.75, 1],
            handle: true
          }).then((modal)=> modal.present())
        });
      
      return;
    } else if(optionId =="scan"){
        // En mode MANAGEMENT, on ouvre directement le scanner sans fermer
       const modalScan = await this.modalController.create({
          component: ModalQRscannerComponent,
          handle: true
        });

        await modalScan.present();
         const { data } = await modalScan.onDidDismiss();
    
    if (data && data?.result) {
      const coupon = await this.incomeService.getCouponByCode(data.result).toPromise();
      if(!coupon){
        const toast = await this.toastController.create({
        message: 'Coupon invalide ou expiré',
        duration: 2000,
        position: 'top',
        color: 'danger'
      });
      await toast.present();
        return;
      }
      
      // Ajouter le coupon au wallet
      this.walletService.addCoupons(coupon).subscribe(()=>{
          this.walletService.reloadWallet();
      });
      

      this.cdr.detectChanges();
      
      const toast = await this.toastController.create({
        message: 'nouveau coupon ajouté avec succès',
        duration: 2000,
        position: 'bottom',
        color: 'success'
      });
      await toast.present();
    }

      
      return;
    }
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



  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}