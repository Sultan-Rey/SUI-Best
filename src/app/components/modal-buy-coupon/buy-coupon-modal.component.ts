import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonImg, IonIcon } from '@ionic/angular/standalone';
import { ModalController, ToastController, LoadingController, ActionSheetController } from '@ionic/angular';
import { UserBalance, WalletService } from '../../../services/WALLET_SERVICE/wallet-service';
import { IncomeService } from '../../../services/INCOME_SERVICE/income-service';
import { Pack } from '../../../interfaces/income.interfaces';
import { cardOutline, logoPaypal, ticket, cashOutline, close, schoolOutline, businessOutline, flash, timeOutline, checkmarkCircle, ticketOutline, layersOutline, walletOutline, logoBitcoin, alertCircleOutline, refreshOutline, lockClosed } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { ProfileService } from 'src/services/PROFILE_SERVICE/profile-service';
import { switchMap, map, forkJoin, of, catchError } from 'rxjs';
import { IonSpinner } from '@ionic/angular/standalone';
import { Auth, AuthUser } from 'src/services/AUTH/auth';

// Interface pour les packs avec informations du propriétaire
interface CouponPackWithOwner extends Pack {
  ownerName: string;
}



@Component({
  selector: 'app-buy-coupon-modal',
  templateUrl: './buy-coupon-modal.component.html',
  styleUrls: ['./buy-coupon-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonImg,
    IonIcon,
    IonSpinner
  ]
})
export class BuyCouponModalComponent implements OnInit {
  couponPacks: CouponPackWithOwner[] = [];
  bestAcademyPacks: CouponPackWithOwner[] = [];
  otherCreatorsPacks: { creatorName: string; creatorId: string; packs: CouponPackWithOwner[] }[] = [];
  isProcessingPayment = false;
  balance!: UserBalance;
  isLoading = true;
  loadingError: string | null = null;
  currentUser!: AuthUser;
  
  constructor(
    private modalController: ModalController,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private actionSheetController: ActionSheetController,
    private walletService: WalletService,
    private incomeService: IncomeService,
    private profileService: ProfileService,
    private authService: Auth
  ) {
    this.balance = {} as UserBalance;
    this.balance = this.walletService.getBalance();
    addIcons({lockClosed, close,alertCircleOutline,refreshOutline,schoolOutline,layersOutline,businessOutline,ticketOutline,ticket,logoBitcoin,checkmarkCircle,flash,timeOutline,cardOutline,logoPaypal,cashOutline,walletOutline});
  }

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser() as AuthUser;
    this.loadCouponPacksFromAPI();
  }

  loadCouponPacksFromAPI() {
    this.isLoading = true;
    this.loadingError = null;
    
    this.incomeService.getCouponsPacks().pipe(
      switchMap(packs => {
        if (packs.length === 0) {
          // Si aucun pack, retourner directement
          return of([] as CouponPackWithOwner[]);
        }
        
        const nonBestAcademyPacks = packs.filter(pack => !pack.isBestAcademy);
        
        if (nonBestAcademyPacks.length === 0) {
          // Si seulement des packs BEST Academy, retourner directement
          return of(packs.map(pack => ({
            ...pack,
            ownerName: 'BEST Academy'
          })) as CouponPackWithOwner[]);
        }
        
        const profileRequests = nonBestAcademyPacks.map(pack => 
          this.profileService.getProfileById(pack.ownerId).pipe(
            map(profile => ({
              packId: pack.id,
              ownerName: profile?.displayName || profile?.username || `Creator ${pack.ownerId}`
            })),
            // Gérer les erreurs individuellement sans casser tout le flux
            catchError(() => of({
              packId: pack.id,
              ownerName: `Creator ${pack.ownerId}`
            }))
          )
        );
        
        return forkJoin(profileRequests).pipe(
          map(profileNames => {
            return packs.map(pack => {
              const profileInfo = profileNames.find((p: any) => p.packId === pack.id);
              return {
                ...pack,
                ownerName: pack.isBestAcademy ? 'BEST Academy' : 
                         (profileInfo?.ownerName || `Creator ${pack.ownerId}`)
              };
            }) as CouponPackWithOwner[];
          })
        );
      }),
      catchError((error: any) => {
        console.error('Erreur lors du chargement des packs:', error);
        this.loadingError = 'Impossible de charger les packs. Veuillez réessayer.';
        return of([] as CouponPackWithOwner[]);
      })
    ).subscribe({
      next: (packsWithNames: CouponPackWithOwner[]) => {
        this.couponPacks = packsWithNames;
        this.organizePacksByCreator();
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Erreur dans le flux principal:', error);
        this.loadingError = 'Une erreur est survenue. Veuillez réessayer.';
        this.isLoading = false;
      }
    });
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

   // Méthode de débogage pour vérifier l'état
   debugState() {
    console.log('isLoading:', this.isLoading);
    console.log('loadingError:', this.loadingError);
    console.log('bestAcademyPacks:', this.bestAcademyPacks);
    console.log('otherCreatorsPacks:', this.otherCreatorsPacks);
    console.log('couponPacks:', this.couponPacks);
   }

  retryLoading() {
    this.loadCouponPacksFromAPI();
  }

  organizePacksByCreator() {
    // Séparer les packs BEST Academy
    this.bestAcademyPacks = this.couponPacks.filter(pack => pack.isBestAcademy);
    
    // Grouper les autres créateurs
    const otherPacks = this.couponPacks.filter(pack => !pack.isBestAcademy);
    const creatorsMap = new Map<string, CouponPackWithOwner[]>();
    
    otherPacks.forEach(pack => {
      if (!creatorsMap.has(pack.ownerId)) {
        creatorsMap.set(pack.ownerId, []);
      }
      creatorsMap.get(pack.ownerId)!.push(pack);
    });
    
    // Convertir en tableau pour le template
    this.otherCreatorsPacks = Array.from(creatorsMap.entries()).map(([creatorId, packs]) => ({
      creatorId,
      creatorName: packs[0].ownerName,
      packs
    }));
  }

  async purchasePack(pack: CouponPackWithOwner) {
    if (this.isProcessingPayment || this.currentUser.id == pack.ownerId) return;

    try {
      this.isProcessingPayment = true;
      
      // Vérifier si l'utilisateur a assez de coins
      const currentBalance = this.walletService.getBalance();
      if (currentBalance.coins < pack.price) {
        this.showToast('Solde de coins insuffisant', 'warning');
        return;
      }
      
      // D'abord déduire les coins
      this.walletService.deductCoins(pack.price).subscribe({
        next: (updatedWallet) => {
         // console.log('✅ Coins déduits:', pack.price);
          
          // Créer un pack compatible avec performPurchase
          const packForPurchase: Pack = {
            id: pack.id,
            amount: pack.amount,
            name: pack.name,
            price: pack.price,
            couponType: pack.couponType,
            itemType: 'coupons',
            ownerId: pack.ownerId,
            icon: pack.icon,
            isBestAcademy: pack.isBestAcademy
          };
          
          // Ensuite utiliser performPurchase pour créer les coupons et la transaction
          this.walletService.purchasePack(packForPurchase, 'coupons', 'gpay').subscribe({
            next: (finalWallet) => {
              //console.log('✅ Achat effectué avec succès:', finalWallet);
              this.showToast(`Achat de ${pack.amount} coupons effectué!`, 'success');
              
              // Fermer le modal après l'achat réussi
              this.modalController.dismiss({ success: true, pack });
            },
            error: (error) => {
              console.error('❌ Erreur lors de la création des coupons:', error);
              this.showToast('Erreur lors de l\'ajout des coupons', 'error');
              
              // Rembourser les coins en cas d'erreur
              this.walletService.addCoins(pack.price).subscribe();
            },
            complete: () => {
              this.isProcessingPayment = false;
            }
          });
        },
        error: (error) => {
          console.error('❌ Erreur lors de la déduction des coins:', error);
          this.showToast('Erreur lors du paiement', 'error');
          this.isProcessingPayment = false;
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur inattendue lors de l\'achat:', error);
      this.showToast('Erreur lors de l\'achat', 'error');
      this.isProcessingPayment = false;
    }
  }

  async showPaymentMethods(pack: CouponPackWithOwner) {
    const actionSheet = await this.actionSheetController.create({
      header: 'Méthode de Paiement',
      buttons: [
        {
          text: 'Gpay',
          icon: 'card-outline',
          handler: () => this.processPayment(pack, 'gpay')
        },
        {
          text: 'PayPal',
          icon: 'logo-paypal',
          handler: () => this.processPayment(pack, 'paypal')
        },
        {
          text: 'MonCash',
          icon: 'cash-outline',
          handler: () => this.processPayment(pack, 'moncash')
        },
        {
          text: 'Annuler',
          icon: 'close-outline',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  async processPayment(pack: CouponPackWithOwner, paymentMethod: string) {
    if (this.isProcessingPayment) return;

    // Vérifier si l'utilisateur a assez de coins
    const currentBalance = this.walletService.getBalance();
    const requiredCoins = pack.price;
    
    if (!currentBalance || currentBalance.coins < requiredCoins) {
      const currentCoins = currentBalance?.coins || 0;
      this.showToast(`Solde insuffisant: ${currentCoins} / ${requiredCoins} coins requis`, 'error');
      return;
    }

    this.isProcessingPayment = true;
    const loading = await this.loadingController.create({
      message: 'Traitement du paiement...',
      spinner: 'circles',
      backdropDismiss: false
    });
    await loading.present();

    try {
      // Mise à jour du message de chargement pour plus de feedback
      loading.message = 'Communication avec le serveur...';
      
      // Appel réel au walletService pour traiter l'achat
      this.walletService.purchasePack(pack, pack.itemType, paymentMethod).subscribe({
        next: (updatedWallet) => {
          // Succès de l'achat
          loading.message = 'Achat réussi! Mise à jour du solde...';
          
          // Mettre à jour la balance locale
          this.balance = this.walletService.getBalance();
          
          setTimeout(() => {
            loading.dismiss();
            this.showToast(`Achat de ${pack.amount} coupons réussi!`, 'success');
            
            // Fermer le modal avec succès
            this.modalController.dismiss({ 
              success: true, 
              pack: pack,
              newBalance: this.balance
            });
          }, 1000);
        },
        error: (error) => {
          console.error('Erreur lors de l\'achat:', error);
          loading.dismiss();
          
          // Messages d'erreur spécifiques
          let errorMessage = 'Erreur lors du paiement. Veuillez réessayer.';
          if (error.message?.includes('insufficient')) {
            errorMessage = 'Solde insuffisant pour cet achat.';
          } else if (error.message?.includes('network')) {
            errorMessage = 'Erreur réseau. Vérifiez votre connexion.';
          } else if (error.message?.includes('server')) {
            errorMessage = 'Erreur serveur. Veuillez réessayer plus tard.';
          }
          
          this.showToast(errorMessage, 'error');
        },
        complete: () => {
          this.isProcessingPayment = false;
        }
      });
      
    } catch (error) {
      console.error('Erreur inattendue:', error);
      loading.dismiss();
      this.showToast('Une erreur inattendue est survenue. Veuillez réessayer.', 'error');
      this.isProcessingPayment = false;
    }
  }

  async showToast(message: string, type: 'success' | 'error' | 'warning' = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color: type === 'success' ? 'success' : type === 'error' ? 'danger' : 'warning',
      cssClass: `custom-toast ${type}-toast`
    });
    await toast.present();
  }

  dismiss() {
    this.modalController.dismiss();
  }
}
