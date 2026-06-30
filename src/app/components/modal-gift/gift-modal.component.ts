import { Component, Input, OnInit, OnDestroy, signal, computed, effect, inject } from '@angular/core';
import { NgFor, NgIf, CommonModule } from '@angular/common';
import { ModalController, ToastController } from '@ionic/angular';
import { AnimationService } from '../../../services/Animation/animation-service';
import { LottieComponent } from 'ngx-lottie';
import { IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { 
  globeOutline, 
  alertCircleOutline, 
  searchOutline, 
  checkmarkCircleOutline, 
  closeCircleOutline, 
  refreshOutline, 
  giftOutline, 
  lockClosedOutline,
  diamondOutline,
  starOutline
} from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { Content } from 'src/models/Content';
import { Gift } from 'src/models/Gift';
import { IncomeService } from 'src/services/service_income/income-service';
import { Observable, Subscription, finalize, switchMap, take, throwError, BehaviorSubject, of, catchError, timeout, retry, shareReplay, combineLatest } from 'rxjs';
import { Wallet, Transaction } from 'src/models/Wallet';
import { WalletService } from 'src/services/Service_wallet/wallet-service';
import { Auth, AuthUser } from 'src/services/AUTH/auth';
import { MessageService } from 'src/services/Service_message/message-service';
import { UserProfile } from 'src/models/User';

// Interface pour le state du composant
interface GiftModalState {
  isLoading: boolean;
  isSending: boolean;
  isSuccess: boolean;
  errorMessage: string | null;
  selectedCategory: string;
  selectedGift: Gift | null;
  gifts: Gift[];
  userBalance: number;
  wallet: Wallet | null;
}

@Component({
  selector: 'app-gift-modal',
  standalone: true,
  imports: [CommonModule, LottieComponent, IonIcon, IonSpinner],
  templateUrl: './gift-modal.component.html',
  styleUrls: ['./gift-modal.component.scss']
})
export class GiftModalComponent implements OnInit, OnDestroy {
  private toastController = inject(ToastController);

  @Input() post!: Content;
  @Input() currentUser!: UserProfile;

  // Utilisation de signals pour une meilleure détection des changements
  private state = signal<GiftModalState>({
    isLoading: false,
    isSending: false,
    isSuccess: false,
    errorMessage: null,
    selectedCategory: 'Tous',
    selectedGift: null,
    gifts: [],
    userBalance: 0,
    wallet: null
  });

  // Computed signals pour les vues
  readonly isLoading = computed(() => this.state().isLoading);
  readonly isSending = computed(() => this.state().isSending);
  readonly isSuccess = computed(() => this.state().isSuccess);
  readonly errorMessage = computed(() => this.state().errorMessage);
  readonly selectedGift = computed(() => this.state().selectedGift);
  readonly currentCategory = computed(() => this.state().selectedCategory);
  readonly gifts = computed(() => this.state().gifts);
  readonly balance = computed(() => this.state().userBalance);
  readonly wallet = computed(() => this.state().wallet);

  // Gifts filtrés avec cache
  private filteredGiftsCache = new Map<string, Gift[]>();
  readonly filteredGifts = computed(() => {
    const gifts = this.gifts();
    const category = this.currentCategory();
    
    if (!gifts || gifts.length === 0) return [];
    
    const cacheKey = category;
    if (this.filteredGiftsCache.has(cacheKey)) {
      return this.filteredGiftsCache.get(cacheKey)!;
    }

    let result: Gift[];
    if (category === 'Tous') {
      result = [...gifts];
    } else {
      result = gifts.filter(g => g.category === category);
    }
    
    // Trier par prix pour une meilleure UX
    result.sort((a, b) => (a.price || 0) - (b.price || 0));
    
    this.filteredGiftsCache.set(cacheKey, result);
    return result;
  });

  readonly hasGifts = computed(() => this.gifts().length > 0);
  readonly hasFilteredGifts = computed(() => this.filteredGifts().length > 0);
  readonly canSend = computed(() => {
    const selected = this.selectedGift();
    const balance = this.balance();
    return selected && balance >= selected.price && !this.isSending() && !this.isLoading();
  });

  private subscriptions = new Subscription();
  private refreshTrigger = new BehaviorSubject<void>(undefined);
  private giftsCache$: Observable<Gift[]> | null = null;
  private balanceSubscription: Subscription | null = null;

  constructor(
    private modalCtrl: ModalController,
    private animService: AnimationService,
    private walletService: WalletService,
    private incomeService: IncomeService,
    private messageService: MessageService
  ) {
    addIcons({
      refreshOutline,
      alertCircleOutline,
      searchOutline,
      giftOutline,
      globeOutline,
      lockClosedOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      diamondOutline,
      starOutline
    });
  }

  ngOnInit() {
    // ✅ Récupérer le solde depuis le walletService
    this.loadUserBalance();
    
    // Charger les cadeaux
    this.loadGifts();
    
    // Configurer l'auto-refresh
    this.setupAutoRefresh();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    this.filteredGiftsCache.clear();
    this.refreshTrigger.complete();
    
    if (this.balanceSubscription) {
      this.balanceSubscription.unsubscribe();
    }
    
    // Nettoyer les ressources Lottie
    if (this.animService) {
      // this.animService.cleanup();
    }
  }

  /**
   * ✅ Récupère le solde depuis le walletService
   */
  private loadUserBalance() {
    this.balanceSubscription = this.walletService.wallet$.pipe(
      take(1)
    ).subscribe({
      next: (wallet) => {
        if (wallet) {
          const balance = wallet.balance?.coins || 0;
          this.state.update(s => ({ 
            ...s, 
            userBalance: balance,
            wallet: wallet
          }));
        } else {
          // Si pas de wallet, essayer d'en créer un
          this.createWallet();
        }
      },
      error: (error) => {
        console.error('Erreur lors du chargement du solde:', error);
        this.state.update(s => ({ 
          ...s, 
          errorMessage: 'Impossible de charger votre solde. Veuillez réessayer.'
        }));
      }
    });
  }

  /**
   * ✅ Crée un wallet si l'utilisateur n'en a pas
   */
  private createWallet() {
    if (!this.currentUser?.id) return;

    this.walletService.createWallet(this.currentUser.id).subscribe({
      next: (wallet) => {
        if (wallet) {
          this.state.update(s => ({ 
            ...s, 
            userBalance: wallet.balance?.coins || 0,
            wallet: wallet
          }));
        }
      },
      error: (error) => {
        console.error('Erreur lors de la création du wallet:', error);
        this.state.update(s => ({ 
          ...s, 
          errorMessage: 'Impossible de créer votre portefeuille. Veuillez réessayer.'
        }));
      }
    });
  }

  /**
   * ✅ Rafraîchit le solde manuellement
   */
  refreshBalance() {
    this.state.update(s => ({ ...s, isLoading: true }));
    
    this.walletService.wallet$.pipe(
      take(1)
    ).subscribe({
      next: (wallet) => {
        if (wallet) {
          const balance = wallet.balance?.coins || 0;
          this.state.update(s => ({ 
            ...s, 
            userBalance: balance,
            wallet: wallet,
            isLoading: false
          }));
        } else {
          this.state.update(s => ({ ...s, isLoading: false }));
        }
      },
      error: (error) => {
        console.error('Erreur lors du refresh du solde:', error);
        this.state.update(s => ({ ...s, isLoading: false }));
        this.showToast('Impossible de rafraîchir le solde', 'danger');
      }
    });
  }

  private setupAutoRefresh() {
    // ✅ Rafraîchir le solde périodiquement (toutes les 30 secondes)
    const refreshSub = this.refreshTrigger.pipe(
      switchMap(() => this.walletService.wallet$.pipe(
        take(1),
        catchError(() => of(null))
      ))
    ).subscribe(wallet => {
      if (wallet) {
        const balance = wallet.balance?.coins || 0;
        this.state.update(s => ({ 
          ...s, 
          userBalance: balance,
          wallet: wallet
        }));
      }
    });

    this.subscriptions.add(refreshSub);

    // Rafraîchissement automatique toutes les 30s
    const intervalSub = setInterval(() => {
      this.refreshTrigger.next();
    }, 30000);

    // Nettoyer l'intervalle
    this.subscriptions.add({
      unsubscribe: () => clearInterval(intervalSub)
    });
  }

  loadGifts(forceRefresh: boolean = false) {
    // Si on a déjà chargé les cadeaux et qu'on ne force pas le refresh, on skip
    if (!forceRefresh && this.gifts().length > 0) {
      return;
    }

    // Utiliser le cache si disponible
    if (!forceRefresh && this.giftsCache$) {
      this.subscriptions.add(
        this.giftsCache$.subscribe({
          next: (gifts) => this.handleGiftsLoaded(gifts),
          error: (error) => this.handleGiftsError(error)
        })
      );
      return;
    }

    this.state.update(s => ({ ...s, isLoading: true, errorMessage: null }));

    // Créer un observable mis en cache
    this.giftsCache$ = this.incomeService.getGifts().pipe(
      timeout(10000), // Timeout de 10 secondes
      retry(2), // Réessayer 2 fois en cas d'échec
      shareReplay(1), // Mise en cache pour les abonnés suivants
      catchError((error) => {
        this.handleGiftsError(error);
        return throwError(() => error);
      }),
      finalize(() => {
        this.state.update(s => ({ ...s, isLoading: false }));
      })
    );

    const subscription = this.giftsCache$.subscribe({
      next: (gifts) => this.handleGiftsLoaded(gifts),
      error: (error) => this.handleGiftsError(error)
    });

    this.subscriptions.add(subscription);
  }

  private handleGiftsLoaded(gifts: Gift[]) {
    const validGifts = (gifts || [])
      .filter(g => g && g.id && g.name) // Filtrer les cadeaux invalides
      .map(g => ({
        ...g,
        price: g.price || 0,
        category: g.category || 'Classiques'
      }));

    this.state.update(s => ({ 
      ...s, 
      gifts: validGifts,
      errorMessage: null
    }));

    // Vérifier si le cadeau sélectionné est toujours disponible
    const currentSelected = this.selectedGift();
    if (currentSelected && !validGifts.find(g => g.id === currentSelected.id)) {
      this.state.update(s => ({ ...s, selectedGift: null }));
    }

    // Vider le cache des filtres car les données ont changé
    this.filteredGiftsCache.clear();
  }

  private handleGiftsError(error: any) {
    console.error('Erreur lors du chargement des cadeaux:', error);
    let errorMessage = 'Impossible de charger les cadeaux. Veuillez vérifier votre connexion.';
    
    if (error.status === 0) {
      errorMessage = 'Erreur de connexion au serveur. Vérifiez votre réseau.';
    } else if (error.status === 404) {
      errorMessage = 'Les cadeaux ne sont pas disponibles pour le moment.';
    } else if (error.status === 500) {
      errorMessage = 'Erreur serveur. Veuillez réessayer plus tard.';
    } else if (error.name === 'TimeoutError') {
      errorMessage = 'La requête a expiré. Vérifiez votre connexion.';
    }

    this.state.update(s => ({ 
      ...s, 
      errorMessage,
      isLoading: false,
      gifts: []
    }));
  }

  setCategory(category: string) {
    this.state.update(s => ({ ...s, selectedCategory: category }));
    // Réinitialiser la sélection lors du changement de catégorie
    this.state.update(s => ({ ...s, selectedGift: null }));
  }

  selectGift(gift: Gift) {
    if (this.isSending() || this.isLoading()) return;
    
    // Si le même cadeau est sélectionné, le désélectionner
    const currentSelected = this.selectedGift();
    if (currentSelected?.id === gift.id) {
      this.state.update(s => ({ ...s, selectedGift: null }));
      return;
    }

    this.state.update(s => ({ ...s, selectedGift: gift }));
  }

  async sendGift() {
    const selected = this.selectedGift();
    const currentBalance = this.balance();
    const currentWallet = this.wallet();
    
    if (!selected) {
      await this.showToast('Veuillez sélectionner un cadeau.', 'warning');
      return;
    }

    if (currentBalance < selected.price) {
      await this.showToast('Solde insuffisant pour offrir ce cadeau.', 'danger');
      this.state.update(s => ({ ...s, selectedGift: null }));
      return;
    }

    if (this.isSending()) return;

    this.state.update(s => ({ ...s, isSending: true, errorMessage: null }));

    try {
      if (!this.currentUser) {
        throw new Error('Utilisateur non authentifié');
      }

      if (!currentWallet) {
        throw new Error('Portefeuille introuvable');
      }

      // Créer la transaction et envoyer le cadeau
      await this.processGiftTransaction(selected, this.currentUser, currentWallet);

      // ✅ Mettre à jour le solde localement après l'envoi
      const updatedBalance = currentBalance - selected.price;
      this.state.update(s => ({ 
        ...s, 
        userBalance: updatedBalance
      }));

      // Fermer la modale et jouer l'animation
      await this.modalCtrl.dismiss({ 
        success: true, 
        gift: {
          id: selected.id,
          name: selected.name,
          price: selected.price,
          category: selected.category
        }
      });
      
      this.animService.playAnimation(selected.animation);

    } catch (error) {
      console.error('Erreur lors de l\'envoi du cadeau:', error);
      await this.showToast(
        error instanceof Error ? error.message : 'Erreur lors de l\'envoi du cadeau.',
        'danger'
      );
      this.state.update(s => ({ ...s, errorMessage: 'Échec de l\'envoi du cadeau. Réessayez.' }));
      
      // ✅ Rafraîchir le solde en cas d'erreur
      this.refreshBalance();
    } finally {
      this.state.update(s => ({ ...s, isSending: false }));
    }
  }

  private async processGiftTransaction(
    gift: Gift, 
    currentUser: UserProfile, 
    wallet: Wallet
  ): Promise<void> {
    const transaction = this.buildTransaction(gift, currentUser);
    
    return new Promise((resolve, reject) => {
      const sub = this.walletService.addPlanTransactionToExistingWallet(wallet, transaction).pipe(
        switchMap((updatedWallet) => {
          // Notifier l'admin
          const payload = {
            conversation_id: updatedWallet.id,
            sender_id: currentUser.id || 'unknown',
            content: `Cadeau "${gift.name}" (${gift.category}) envoyé par ${currentUser.displayName || currentUser.id} pour le contenu ${this.post.id}`,
            type: 'system'
          };
          return this.messageService.createMessage(payload);
        }),
        timeout(15000), // Timeout de 15 secondes
        catchError((error) => {
          return throwError(() => new Error(this.formatErrorMessage(error)));
        })
      ).subscribe({
        next: () => {
          // ✅ Rafraîchir le wallet après la transaction
          this.walletService.wallet$.pipe(take(1)).subscribe(w => {
            if (w) {
              this.state.update(s => ({ 
                ...s, 
                wallet: w,
                userBalance: w.balance?.coins || 0
              }));
            }
          });
          resolve();
        },
        error: (error) => reject(error)
      });

      this.subscriptions.add(sub);
    });
  }

  private buildTransaction(gift: Gift, currentUser: UserProfile): Transaction {
    const wallet = this.wallet();
    return {
      id: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      walletId: wallet?.id || '',
      type: 'usage',
      amount: 1,
      itemType: 'gift',
      description: `Envoi du cadeau "${gift.name}" à l'utilisateur ${this.post.userId}`,
      date: new Date().toISOString(),
      price: gift.price || 0,
      paymentMethod: 'coins',
      metadata: {
        nature: gift.name,
        value: gift.price,
        sender: currentUser.id,
        senderName: currentUser.displayName || currentUser.id,
        receiverId: this.post.userId,
        postId: this.post.id,
        category: gift.category,
        status: 'completed',
        timestamp: Date.now()
      }
    };
  }

  private formatErrorMessage(error: any): string {
    if (error.status === 0) return 'Erreur réseau. Vérifiez votre connexion.';
    if (error.status === 401) return 'Session expirée. Veuillez vous reconnecter.';
    if (error.status === 403) return 'Vous n\'avez pas l\'autorisation d\'envoyer ce cadeau.';
    if (error.status === 404) return 'Ressource non trouvée.';
    if (error.status === 429) return 'Trop de requêtes. Veuillez patienter.';
    if (error.name === 'TimeoutError') return 'La requête a expiré. Vérifiez votre connexion.';
    return error.message || 'Une erreur est survenue lors de l\'envoi du cadeau.';
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'bottom',
      buttons: [
        {
          icon: color === 'success' ? 'checkmark-circle' : 'close-circle',
          role: 'cancel'
        }
      ],
      cssClass: 'gift-toast'
    });
    await toast.present();
  }

  retryLoad() {
    this.loadGifts(true);
  }

  trackByGiftId(index: number, gift: Gift): string {
    return gift.id;
  }

  getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      'Classiques': 'gift-outline',
      'Luxe': 'diamond-outline',
      'Épiques': 'star-outline'
    };
    return icons[category] || 'gift-outline';
  }
}