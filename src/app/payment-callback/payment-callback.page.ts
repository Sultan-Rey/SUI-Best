import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonButton, IonTitle, IonIcon, IonToolbar } from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { PaymentGatewayService } from 'src/services/Service_payment/payment-gateway-service';
import { NotificationManagerService } from 'src/services/Notification/notification-manager-service';
import { AlertController, LoadingController, ModalController} from '@ionic/angular';
import { homeOutline} from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { firstValueFrom } from 'rxjs';
import { Auth } from 'src/services/AUTH/auth';
import { WalletService } from 'src/services/Service_wallet/wallet-service';
@Component({
  selector: 'app-payment-callback',
  templateUrl: './payment-callback.page.html',
  styleUrls: ['./payment-callback.page.scss'],
  standalone: true,
  imports: [IonIcon, IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonIcon, CommonModule, FormsModule]
})
export class PaymentCallbackPage implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('homeButton') homeButton!: ElementRef;

  showHomeButton = false;
  private timerInterval: any;
  private statusMessages = [
    'Initialisation du paiement...',
    'Vérification des informations...',
    'Traitement en cours...',
    'Finalisation de la transaction...',
  ];
  private statusIndex = 0;
  private elapsedSeconds = 0;
  
  constructor(private router:Router, private route:ActivatedRoute, private notificationManager: NotificationManagerService,
              private paymentGateway:PaymentGatewayService, private loadingController: LoadingController, private modalController: ModalController,
              private alertController: AlertController, private auth: Auth, private walletService: WalletService) {
                addIcons({homeOutline});
               }
  ngAfterViewInit(): void {
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds++;
      if (this.elapsedSeconds >= 30 && !this.showHomeButton) {
        this.showHomeButton = true;
        this.updateStatusText("Le traitement prend plus de temps que prévu.");
      }
    }, 1000);
  }

  async ngOnInit() {
     this.startStatusRotation();
  // Nouveau : l'identifiant (token PayPal ou transactionId MonCash) arrive
  // maintenant dans le path (/payment-callback/:identifier), via le script
  // PHP relais, pour contourner la perte de sessionStorage lors du retour
  // depuis un domaine externe (PayPal).
  const pathIdentifier = this.route.snapshot.paramMap.get('identifier');

  // On garde la compatibilité avec l'ancien comportement (query params),
  // au cas où une route sans :identifier serait encore utilisée quelque part.
  const queryTransactionId = this.route.snapshot.queryParams['transactionId'];
  const queryToken = this.route.snapshot.queryParams['token'];
  const queryPayerId = this.route.snapshot.queryParams['PayerID'];

  const orderId = sessionStorage.getItem('pending_order_id');
  const method = sessionStorage.getItem('pending_payment_method') as 'moncash' | 'paypal';
  
  let context: any = {};
  try {
    context = JSON.parse(sessionStorage.getItem('pending_payment_context') || '{}');
  } catch (e) {
    console.error("Erreur lors du parsing du pending_payment_context", e);
  }

  // L'identifiant final à utiliser pour verifyPayment : priorité au path param
  // (nouveau flux fiable), sinon fallback sur les anciens query params.
  const transactionId = pathIdentifier || queryTransactionId;
  const token = pathIdentifier || queryToken;

  // Nettoie immédiatement les variables de transition
  sessionStorage.removeItem('pending_order_id');
  sessionStorage.removeItem('pending_payment_method');
  sessionStorage.removeItem('pending_payment_context');

  if (!orderId && !token) {
    console.log("orderId or token not defined");
    this.router.navigate(['/default/payment-failed'],{replaceUrl: true});
    return;
  }

  const urlObj = new URL(window.location.href);
  const result = await this.paymentGateway.verifyPayment(method,  method === 'moncash' ? orderId : token);

  // Sauvegarde globale du résultat dans le sessionStorage
  sessionStorage.setItem('payment_result', JSON.stringify({ ...result, context }));

  // Détermination de la route cible de redirection standard
  const targetRoute = result.success
    ? (context.redirectOnSuccess || '/home')
    : (context.redirectOnFailure || '/default/payment-failed');

  // --- TRAITEMENT SELON LE RAISON DU PAIEMENT ---

  // Cas 1 : Création de compte / Achat de plan d'abonnement
  if (context.reason === 'account_creation') {
    this.walletService.purchasePlan(
      context.data.myPlan,
      context.data.id,
      method,
      orderId || token
    ).subscribe({
      next: () => {
        this.tryCreateAccount(context.data);
        // La méthode tryCreateAccount gère probablement sa propre redirection finale après création
      },
      error: (err) => {
        console.error("Erreur lors de l'enregistrement du plan dans le wallet:", err);
        this.router.navigate([targetRoute], {replaceUrl: true});
      }
    });
    return; // On stoppe l'exécution ici car le flux asynchrone prend le relais
  } 
  
  // Cas 2 : Achat d'un pack de jetons / crédits
  else if (context.reason === 'purchase_pack') {
    if (this.modalController) {
      this.modalController.dismiss({ success: result.success });
    }

    // Navigation vers /home en transmettant le résultat dans le router state
   this.router.navigate(['/home'], {
  replaceUrl: true,
  state: { payment_result: { ...result, context } }
});
    return; // On stoppe
  }

  // Cas par défaut (si aucune raison spécifique n'est matchée)
  this.router.navigate([targetRoute], {replaceUrl: true});
}


private async tryCreateAccount(registrationData: any) {
    
    try {
      const loading = await this.loadingController.create({
        message: "Création de compte...",
        spinner: "bubbles",
        duration: 6000
      });
      await loading.present();

      
      const signupResponse = await firstValueFrom(this.auth.signup(registrationData));
      
      if (!signupResponse.success) {
        throw new Error(signupResponse.error || signupResponse.message || 'Échec de l\'inscription');
      } else {
        await loading.dismiss();

        
        if (signupResponse.user_id) {
          await this.notificationManager.notifyWelcome(signupResponse.user_id);
        }
        
        await this.router.navigate(['/default/account-success'], {
          state: {
            name: registrationData.name,
            email: registrationData.email
          }
        });
        
        // Réinitialisation des données
        registrationData = null;
      }

    } catch (error: any) {
      console.error('Erreur d\'inscription:', error);
      const errorMessage = error?.message || 'Une erreur est survenue lors de l\'inscription';
      
      const failureAlert = await this.alertController.create({
  header: 'Échec de la création',
  message: errorMessage,
  buttons: [
    {
      text: 'Recommencer',
      handler: () => {
        this.tryCreateAccount(registrationData);
      }
    },
    {
      text: 'Login',
      cssClass: 'alert-button-confirm', // Optionnel : pour styliser différemment
      handler: () => {
        this.router.navigate(['/login']); // Modifiez la route selon votre configuration
      }
    }
  ]
});

await failureAlert.present();
      
    } finally {
      sessionStorage.removeItem('payment_result');
    }
  }


  private startStatusRotation() {
    setInterval(() => {
      const statusEl = document.querySelector('.status-text');
      if (statusEl && !this.showHomeButton) {
        this.statusIndex = (this.statusIndex + 1) % this.statusMessages.length;
        statusEl.textContent = this.statusMessages[this.statusIndex];
      }
    }, 2500);
  }

   private updateStatusText(message: string) {
    const statusEl = document.querySelector('.status-text');
    if (statusEl) {
      statusEl.textContent = message;
    }
  }

   private clearTimers() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  goHome() {
    this.clearTimers();
    this.router.navigate(['/home']);
  }

   ngOnDestroy() {
    this.clearTimers();
  }
}