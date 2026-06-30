import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponentComponent } from '../components/header-component/header-component.component';
import {
  IonContent,
  IonIcon,
  ToastController,
  ModalController, AlertController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  searchOutline,
  eyeOutline,
  timeOutline,
  lockClosedOutline,
  play,
  starOutline,
  videocamOutline,
  imagesOutline,
} from 'ionicons/icons';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, takeUntil, switchMap, take } from 'rxjs/operators';
import { ExclusiveContentService } from '../../services/Service_exclusive_content/exclusive-service';
import { ExclusiveContent, ExclusiveContentStatus, ExclusiveContentType, Series } from '../../models/Content';
import { Router } from '@angular/router';
import { MediaUrlPipe } from '../utils/pipes/mediaUrlPipe/media-url-pipe';
import { AsyncPipe } from '@angular/common';
import { Auth } from '../../services/AUTH/auth';
import { CouponModalComponent } from '../components/modal-coupon/coupon-modal.component';
import { CouponModalMode } from '../../interfaces/coupon.interfaces';
import { WalletService, UserBalance } from '../../services/Service_wallet/wallet-service';
import { Transaction, Wallet } from '../../models/Wallet';
import { PremiumService } from '../../services/Premium/premium-service';
import { CoinConfirmationComponent } from './CoinConfirmationComponent';

// ─── Models ───────────────────────────────────────────────────────────────────

export interface Author {
  name: string;
  initials: string;
  color: string; // CSS gradient string
}

export interface FilterTab {
  id: string;
  label: string;
  icon?: string;
  prefix?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-exclusive',
  templateUrl: 'exclusive.page.html',
  styleUrls: ['exclusive.page.scss'],
  standalone: true,
  providers: [ModalController],
  imports: [ MediaUrlPipe, AsyncPipe, CommonModule, FormsModule, IonContent, IonIcon, HeaderComponentComponent],
})
export class ExclusivePage implements OnInit {

  searchQuery = '';
  activeFilter = 'all';

  filterTabs: FilterTab[] = [
    { id: 'all',        label: 'Tout',      prefix: '✦' },
    { id: 'video',      label: 'Vidéos',    icon: 'videocam-outline' },
    { id: 'behind',     label: 'Coulisses', icon: 'images-outline' },
    { id: 'masterclass',label: 'Masterclass',icon: 'star-outline' },
    { id: 'series',     label: 'Séries',    icon: 'play' },
  ];

  // Données observables
  featuredItems$!: Observable<ExclusiveContent[]>;
  liveContents$!: Observable<ExclusiveContent[]>; 
  masterClass$!: Observable<ExclusiveContent[]>;
  allContents$!: Observable<ExclusiveContent[]>;
  series$!: Observable<Series[]>;
  public subscriptionStatus: string = '';
  public userBalance: UserBalance = { coins: 0, coupons: 0 };
  
  constructor(
    private toastCtrl: ToastController,
    private alertController: AlertController,
    private modalController: ModalController,
    private walletService: WalletService,
    private premiumService: PremiumService,
    private exclusiveService: ExclusiveContentService,
    private router: Router,
    private auth: Auth
  ) {
    addIcons({
      searchOutline,
      eyeOutline,
      timeOutline,
      lockClosedOutline,
      play,
      starOutline,
      videocamOutline,
      imagesOutline,
    });
  }

  ngOnInit() {
    this.loadData();
  }

  getSubscriptionStatus(status: string) {
    this.subscriptionStatus = status; // On stocke la valeur
  }

  onBalanceChange(balance: UserBalance) {
    this.userBalance = balance;
  }

  /**
   * Crée un objet Transaction pour un achat de contenu exclusif
   */
 private createTransaction(
  item: ExclusiveContent,
  currencyType: 'coin' | 'coupon' | 'money',
  amount: number,
  paymentMethod?: string
): Observable<Wallet> {
  const currentUser = this.auth.getCurrentUser();
  
  const transaction: Omit<Transaction, 'walletId'> = {
    id: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'purchase',
    amount: amount,
    itemType: currencyType === 'money' ? 'subscription' : currencyType === 'coin' ? 'coins' : 'coupons',
    description: `Achat du contenu "${item.title}" (${item.type})`,
    date: new Date().toISOString(),
    price: item.currency?.value || 0,
    paymentMethod: paymentMethod || (currencyType === 'coin' ? 'wallet' : currencyType === 'coupon' ? 'coupon' : 'payment_gateway'),
    metadata: {
      contentId: item.id,
      contentType: item.type,
      contentTitle: item.title,
      authorId: item.author?.id,
      authorName: item.author?.name,
      currencyType: currencyType,
      currencyValue: item.currency?.value,
      status: 'completed'
    }
  };

  // ✅ Récupérer le wallet et enregistrer la transaction
  return this.walletService.wallet$.pipe(
    take(1),
    switchMap(wallet => {
      if (!wallet) {
        return throwError(() => new Error('Wallet non trouvé'));
      }
      return this.walletService.addPlanTransactionToExistingWallet(wallet, transaction as Transaction);
    })
  );
}

/**
 * Affiche un dialog de confirmation pour l'achat avec des coins
 */
/**
 * Affiche un dialog de confirmation pour l'achat avec des coins
 */
private async presentCoinConfirmation(item: ExclusiveContent): Promise<boolean> {
  const modal = await this.modalController.create({
    component: CoinConfirmationComponent,
    cssClass: 'dialog-modal',
    componentProps: {
      contentTitle: item.title,
      coinCost: item.currency?.value || 0,
      currentBalance: this.userBalance.coins
    },
    backdropDismiss: true
  });

  await modal.present();
  const { data } = await modal.onWillDismiss();
  return data?.confirmed || false;
}
  // ── Data Loading ─────────────────────────────────────────────────────────────

  loadData(): void {
    // 1. Récupérer tous les contenus et filtrer pour featured
    this.featuredItems$ = this.exclusiveService.getAll().pipe(
      map(contents => contents.filter(c => 
        c.status === ExclusiveContentStatus.FEATURED && 
        (c.type === ExclusiveContentType.VIDEO || c.type === ExclusiveContentType.BEHIND)
      )),
      catchError(error => {
        console.error('Erreur lors du chargement des contenus vedettes', error);
        return of([]);
      })
    );

    // 2. Récupérer tous les contenus et filtrer pour published
    this.allContents$ = this.exclusiveService.getAll().pipe(
      map(contents => contents.filter(c => c.status === ExclusiveContentStatus.PUBLISHED)),
      catchError(error => {
        console.error('Erreur lors du chargement de tous les contenus', error);
        return of([]);
      })
    );

    // 3. Récupérer toutes les séries (Le service gère en interne la ressource 'series')
    this.series$ = this.exclusiveService.getAllSeries().pipe(
      catchError(error => {
        console.error('Erreur lors du chargement des séries', error);
        return of([]);
      })
    );

    // 4. Récupérer tous les contenus et filtrer pour live
    this.liveContents$ = this.exclusiveService.getAll().pipe(
      map(contents => contents.filter(c => c.isLive === true)),
      catchError(error => {
        console.error('Erreur lors du chargement des contenus live', error);
        return of([]);
      })
    );

    // 5. Récupérer tous les contenus et filtrer pour masterclass
    this.masterClass$ = this.exclusiveService.getAll().pipe(
      map(contents => contents.filter(c => 
        c.type === ExclusiveContentType.MASTERCLASS && 
        c.status === ExclusiveContentStatus.PUBLISHED
      )),
      catchError(error => {
        console.error('Erreur lors du chargement des contenus masterclass', error);
        return of([]);
      })
    );
  }

  // ── Filter ──────────────────────────────────────────────────────────────────

  setFilter(filterId: string): void {
    this.activeFilter = filterId;
    this.applyFilterAndSearch();
  }

  /**
   * Applique le filtre actuel et la recherche si searchQuery n'est pas vide
   */
  private applyFilterAndSearch(): void {
    const searchTerm = this.searchQuery.toLowerCase().trim();
    const hasSearch = searchTerm.length > 0;
    
    // Filtrer tous les contenus selon le filtre sélectionné
    const baseContents$ = this.exclusiveService.getAll().pipe(
      catchError(() => of([]))
    );
    
    const searchFilter = (item: ExclusiveContent | Series) => {
      if (!hasSearch) return true;
      const title = item.title?.toLowerCase() || '';
      const description = item.description?.toLowerCase() || '';
      const authorName = item.author?.name?.toLowerCase() || '';
      return title.includes(searchTerm) || 
             description.includes(searchTerm) || 
             authorName.includes(searchTerm);
    };
    
    switch (this.activeFilter) {
      case 'series':
        // Afficher uniquement les séries
        this.featuredItems$ = this.exclusiveService.getAllSeries().pipe(
          map(series => series
            .map(s => this.convertSeriesToContent(s))
            .filter(searchFilter)
          ),
          catchError(() => of([]))
        );
        this.allContents$ = this.featuredItems$;
        break;
        
      case 'all':
        // Retour aux données initiales (featured + published)
        this.featuredItems$ = baseContents$.pipe(
          map(contents => contents.filter(c => 
            c.status === ExclusiveContentStatus.FEATURED &&
            (c.type === ExclusiveContentType.VIDEO || c.type === ExclusiveContentType.BEHIND) &&
            searchFilter(c)
          ))
        );
        this.allContents$ = baseContents$.pipe(
          map(contents => contents.filter(c => 
            c.status === ExclusiveContentStatus.PUBLISHED &&
            searchFilter(c)
          ))
        );
        break;
        
      case 'video':
        this.featuredItems$ = baseContents$.pipe(
          map(contents => contents.filter(c => 
            c.type === ExclusiveContentType.VIDEO && 
            c.status === ExclusiveContentStatus.FEATURED &&
            searchFilter(c)
          ))
        );
        this.allContents$ = baseContents$.pipe(
          map(contents => contents.filter(c => 
            c.type === ExclusiveContentType.VIDEO && 
            c.status === ExclusiveContentStatus.PUBLISHED &&
            searchFilter(c)
          ))
        );
        break;
        
      case 'behind':
        this.featuredItems$ = baseContents$.pipe(
          map(contents => contents.filter(c => 
            c.type === ExclusiveContentType.BEHIND && 
            c.status === ExclusiveContentStatus.FEATURED &&
            searchFilter(c)
          ))
        );
        this.allContents$ = baseContents$.pipe(
          map(contents => contents.filter(c => 
            c.type === ExclusiveContentType.BEHIND && 
            c.status === ExclusiveContentStatus.PUBLISHED &&
            searchFilter(c)
          ))
        );
        break;
        
      case 'masterclass':
        this.featuredItems$ = baseContents$.pipe(
          map(contents => contents.filter(c => 
            c.type === ExclusiveContentType.MASTERCLASS && 
            c.status === ExclusiveContentStatus.FEATURED &&
            searchFilter(c)
          ))
        );
        this.allContents$ = baseContents$.pipe(
          map(contents => contents.filter(c => 
            c.type === ExclusiveContentType.MASTERCLASS && 
            c.status === ExclusiveContentStatus.PUBLISHED &&
            searchFilter(c)
          ))
        );
        break;
        
      default:
        // Fallback : afficher tous les contenus publiés
        this.featuredItems$ = baseContents$.pipe(
          map(contents => contents.filter(c => 
            c.status === ExclusiveContentStatus.FEATURED &&
            searchFilter(c)
          ))
        );
        this.allContents$ = baseContents$.pipe(
          map(contents => contents.filter(c => 
            c.status === ExclusiveContentStatus.PUBLISHED &&
            searchFilter(c)
          ))
        );
    }
  }

  /**
   * Appelé quand la recherche change
   */
  onSearchChange(): void {
    this.applyFilterAndSearch();
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  /**
   * Vérifie si l'utilisateur actuel a accès à un contenu (son ID est dans watchers)
   */
  hasAccess(item: ExclusiveContent | Series): boolean {
    const currentUser = this.auth.getCurrentUser();
    if (!currentUser || !currentUser.id) return false;
    
    if ('watchers' in item && item.watchers) {
      return item.watchers.includes(currentUser.id);
    }
    return false;
  }

  /**
   * Vérifie si le contenu est verrouillé pour l'utilisateur actuel
   * (locked=true et utilisateur n'a pas accès via watchers)
   */
  isLockedForUser(item: ExclusiveContent | Series): boolean {
    if ('locked' in item && item.locked) {
      return !this.hasAccess(item);
    }
    return false;
  }

  onSubscribe(): void {
    this.router.navigate(['/subscription']);
  }

  onContentTap(item: ExclusiveContent | Series): void {
    if (this.isLockedForUser(item)) {
      // Contenu verrouillé pour l'utilisateur : ouvrir le modal de paiement
      // onBuy n'accepte que ExclusiveContent, pas Series
      if ('locked' in item) {
      
        this.onBuy(item, new Event('click'));
      }
    } else if ('episodeNumber' in item && item.episodeNumber) {
      // C'est un épisode de série : naviguer vers le lecteur
      this.router.navigate(['/content-player', item.id]);
    } else if ('totalEpisodes' in item && item.totalEpisodes) {
      // C'est une série : naviguer vers le détail de la série
      this.router.navigate(['/series-detail', item.id]);
    } else {
      // Contenu simple : naviguer vers le lecteur
      this.router.navigate(['/content-player', item.id]);
    }
  }

  async onBuy(item: ExclusiveContent, event: Event) {
  event.stopPropagation();
  
  // Initialiser watchers si nécessaire
  item.watchers = item.watchers || [];
  const userId = this.auth.getCurrentUser()?.id;
  if (userId && !item.watchers.includes(userId)) {
    item.watchers.push(userId);
  }

  // ─── CAS COUPON ─────────────────────────────────────────────
  if (item.currency?.type === 'coupon') {
    const modal = await this.modalController.create({
      component: CouponModalComponent,
      cssClass: 'vote-modal',
      breakpoints: [0, 0.7, 0.85],
      initialBreakpoint: 0.85,
      backdropDismiss: true,
      componentProps: {
        artistName: item.author?.name || 'Utilisateur',
        artistAvatar: 'assets/avatar-default.png',
        postId: item.id,
        mode: CouponModalMode.ACCESS,
      }
    });

    await modal.present();
    const { data } = await modal.onWillDismiss();
    
    if (data && data.success) {
      // Mettre à jour le contenu
      const updatedItem = await this.exclusiveService.update(item.id!, { watchers: item.watchers }).toPromise();
      
      // ✅ Créer et enregistrer la transaction (tout est géré dans createTransaction)
      this.createTransaction(item, 'coupon', item.currency.value || 0, 'coupon').subscribe({
        next: (updatedWallet) => {
          console.log('✅ Transaction enregistrée avec succès', updatedWallet);
          this.showToast('Félicitation, contenu débloqué!');
        },
        error: (err) => {
          console.error('❌ Erreur lors de l\'enregistrement de la transaction:', err);
          this.showToast('Erreur lors de l\'enregistrement de la transaction');
        }
      });
    }

 // ─── CAS COINS ──────────────────────────────────────────────
} else if (item.currency?.type === 'coin') {
  // Vérifier le solde
 if (this.userBalance.coins < item.currency.value) {
  const alert = await this.alertController.create({
    header: 'Solde insuffisant',
    message: `Vous n'avez pas assez de coins.\n\nSolde actuel : ${this.userBalance.coins} coins\nCoût : ${item.currency.value} coins\nManque : ${item.currency.value - this.userBalance.coins} coins`,
    cssClass: 'custom-alert',
    buttons: [
      {
        text: 'Fermer',
        role: 'cancel'
      }
    ]
  });
  await alert.present();
  return;
}

  // ✅ Afficher le dialog de confirmation
  const confirmed = await this.presentCoinConfirmation(item);
  
  if (!confirmed) {
    return; // L'utilisateur a annulé
  }

  // Procéder à l'achat
  this.walletService.deductCoins(item.currency.value).subscribe({
    next: async () => {
      // Mettre à jour le contenu
      const updatedItem = await this.exclusiveService.update(item.id!, { watchers: item.watchers }).toPromise();
      
      // Créer et enregistrer la transaction
      this.createTransaction(item, 'coin', item?.currency?.value || 0, 'wallet').subscribe({
        next: (updatedWallet) => {
          console.log('✅ Transaction enregistrée avec succès', updatedWallet);
          this.showToast('🎉 Félicitation, contenu débloqué avec succès !');
        },
        error: (err) => {
          console.error('❌ Erreur lors de l\'enregistrement de la transaction:', err);
          this.showToast('⚠️ Erreur lors de l\'enregistrement de la transaction');
        }
      });
    },
    error: (err) => {
      console.error('Erreur lors de la déduction des coins:', err);
      this.showToast('❌ Erreur lors de l\'achat');
    }
  });

  // ─── CAS MONEY ──────────────────────────────────────────────
  } else if (item.currency?.type === 'money') {
    const hasAccess = await this.premiumService.checkAccessOrLock(
      this.auth.getCurrentUser(), 
    );
    
    if (hasAccess) {
      // Mettre à jour le contenu
      const updatedItem = await this.exclusiveService.update(item.id!, { watchers: item.watchers }).toPromise();
      
      // ✅ Créer et enregistrer la transaction
      this.createTransaction(item, 'money', item.currency.value || 0, 'payment_gateway').subscribe({
        next: (updatedWallet) => {
          console.log('✅ Transaction enregistrée avec succès', updatedWallet);
          this.showToast('Félicitation, contenu débloqué!');
        },
        error: (err) => {
          console.error('❌ Erreur lors de l\'enregistrement de la transaction:', err);
          this.showToast('Erreur lors de l\'enregistrement de la transaction');
        }
      });
    }
  }
}

  onWatch(item: ExclusiveContent | Series, event: Event): void {
    event.stopPropagation();
    if (this.isLockedForUser(item)) {
      // Contenu verrouillé pour l'utilisateur : ouvrir le modal de paiement
      if ('locked' in item) {
        this.onBuy(item, event);
      }
    } else {
      this.router.navigate(['/content-player', item.id]);
    }
  }

  onSeriesTap(series: Series): void {
    this.router.navigate(['/series-detail', series.id]);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Convertit une Series en ExclusiveContent pour l'affichage unifié
   */
  private convertSeriesToContent(series: Series): ExclusiveContent {
    return {
      id: series.id,
      viewCount: series.viewCount || 0,
      title: series.title,
      description: series.description || '',
      author: series.author,
      type: series.type as ExclusiveContentType,
      status: 'published' as any,
      
      // Média
      media: {
        videoFile: undefined,
        thumbnail: series.thumbnail,
        mimeType: 'video/mp4',
        fileSize: 0,
        duration: 0
      },
      
      // Monétisation
      locked: false, // Les séries sont généralement déverrouillées
      currency: {type:'coin', value: series.price || 0},
      isLive: false,
      
      // Série (pour l'affichage)
      series: {
        isSeries: true,
        seriesId: series.id,
        seriesTitle: series.title,
        episodeNumber: undefined,
        totalEpisodes: series.totalEpisodes,
        season: undefined
      },
      
      created_at: series.created_at,
      updated_at: series.updated_at
    };
  }

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'bottom',
      cssClass: 'ex-toast',
    });
    await toast.present();
  }
}