import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertController, LoadingController, ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { Plan } from '../../models/Plan';
// Remplacement du Browser de Capacitor par InAppBrowser
import { InAppBrowser } from '@awesome-cordova-plugins/in-app-browser/ngx';
import { 
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonButton,
  IonIcon, IonSpinner, IonImg } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  arrowBack,
  sparkles,
  flame,
  starOutline,
  trophyOutline,
  diamondOutline,
  checkmarkCircle,
  rocket,
  calendar,
  trophy,
  eyeOutline,
} from 'ionicons/icons';
import { SubscriptionService } from 'src/services/Service_subscription/subscription-service';
import { User, UserProfile } from 'src/models/User';
import { firstValueFrom } from 'rxjs';
import { Auth } from 'src/services/AUTH/auth';
import { NotificationManagerService } from 'src/services/Notification/notification-manager-service';
import { ModalPaymentComponent } from '../components/modal-payment/modal-payment.component';
import { PaymentService } from 'src/services/Service_payment/payment-service';
import { PaymentGatewayService } from 'src/services/Service_payment/payment-gateway-service';
import { WalletService } from 'src/services/Service_wallet/wallet-service';
import { ProfileService } from 'src/services/Service_profile/profile-service';

@Component({
  selector: 'app-subscription',
  templateUrl: './subscription.page.html',
  styleUrls: ['./subscription.page.scss'],
  standalone: true,
  providers: [ModalController, InAppBrowser], // Ajout d'InAppBrowser aux providers
  imports: [IonImg,  
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonButton,
    IonIcon,
    IonSpinner
  ]
})
export class SubscriptionPage implements OnInit {

  selectedPlan: string | null = null;
  plans: Plan[] = [];
  selectedPlanId: string | null = null;
  currentUser: User | null = null;
  isLoading = false;
  error: string | null = null
  registrationData: any | null = null;
  renewalData: any | null = null;

  private router = inject(Router);
  private alertController = inject(AlertController);
  private loadingController = inject(LoadingController);
  private modalController = inject(ModalController);
  private subscriptionService = inject(SubscriptionService);
  private profileService = inject(ProfileService);
  private auth = inject(Auth);
  private notificationManager = inject(NotificationManagerService);
  private paymentGateway = inject(PaymentGatewayService);
  private walletService = inject(WalletService);
  private iab = inject(InAppBrowser); // Injection d'InAppBrowser

  constructor() {
     addIcons({arrowBack,sparkles,flame,checkmarkCircle,rocket,'calendar':calendar,'trophy':trophy,'eyeOutline':eyeOutline,'diamondOutline':diamondOutline,'starOutline':starOutline,'trophyOutline':trophyOutline,});

  if(this.router.getCurrentNavigation()?.extras.state?.['registrationData']) {
    this.registrationData = this.router.getCurrentNavigation()?.extras.state?.['registrationData'] as UserProfile;
  }
  if(this.router.getCurrentNavigation()?.extras.state?.['renewalData']) {
    this.renewalData = this.router.getCurrentNavigation()?.extras.state?.['renewalData'] as any;
  }

   if (!this.registrationData) {
      console.error('Aucune donnée d\'inscription trouvée');
      this.router.navigate(['/register']);
      return;
    }
  }

  async ngOnInit() {
    this.loadPlans();
  }

  private async loadPlans() {
    const loading = await this.loadingController.create({
      message: "chargement...",
      spinner: 'dots',
      animated: true,
      duration: 10000
    });
    await loading.present();
    this.error = null;
    
    this.subscriptionService.getAvailablePlans().subscribe({
  next: (plans) => {
    // Si renewalData existe et que son plan est 'Exhibition'
    if (this.renewalData && this.renewalData.plan.trim() === 'Exhibition') {
      // On NE GARDE QUE les plans qui n'ont PAS l'id 'Exhibition'
      plans = plans.filter(plan => plan.name.trim() !== 'Exhibition');
    }
    if(this.registrationData && this.registrationData.type.trim() == 'creator'){
      plans = plans.filter(plan => plan.name.trim() !== 'Exhibition');
    }
    this.plans = plans;
    loading.dismiss();
  },
  error: (error) => {
    console.error('💥 Erreur lors du chargement des plans:', error);
    this.error = 'Impossible de charger les plans disponibles';
    loading.dismiss();
  }
});
  }

  selectPlan(planId: string) {
    this.selectedPlan = planId;
  }

  goBack() {
    this.router.navigate(['/register']);
  }

  async subscribe() {
    if (!this.selectedPlan) {
      const alert = await this.alertController.create({
        header: 'Information',
        message: 'Veuillez sélectionner un plan pour continuer',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    if (this.registrationData) {
      const selectedPlan = this.plans.find(plan => plan.id === this.selectedPlan);
      if (!selectedPlan) {
        const alert = await this.alertController.create({
          header: 'Erreur',
          message: 'Le plan sélectionné est invalide',
          buttons: ['OK']
        });
        await alert.present();
        return;
      }

      const startDate = new Date();
      const endDate = new Date();

      if (selectedPlan.price === 0) {
        endDate.setDate(startDate.getDate() + 30);
      } else {
        endDate.setMonth(startDate.getMonth() + selectedPlan.duration);
      }

      this.registrationData.myPlan = {
        id: selectedPlan.id,
        name: selectedPlan.name,
        price: selectedPlan.price,
        period: selectedPlan.period,      
        duration: selectedPlan.duration === 0 ? 30 : selectedPlan.duration,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        status: 'active',
        features: selectedPlan.features
      };
      if(selectedPlan.price > 0){
      const modal = await this.modalController.create({
        component: ModalPaymentComponent,
        componentProps: {
         OrderAmount: Number(selectedPlan.price)
        },
        cssClass: 'auto-height',
        initialBreakpoint: 0.80,
        breakpoints: [0, 0.80, 1],
        handle: true
      });
      
      await modal.present();
    
      const { data } = await modal.onDidDismiss();
     
       if (data?.paymentUrl) {
         const URL = data.paymentUrl as string;
         const ORDERID = data.extra as string;
         const result = await this.paymentGateway.processPayment(URL, data.method, ORDERID);
         if (result.success) {
          this.walletService.purchasePlan(
  this.registrationData.myPlan,
  this.registrationData.id,
  data.method,
  ORDERID
).subscribe({
  next: () => {
    if (this.registrationData.id && this.renewalData?.date) {

      const payload: Partial<UserProfile> = {
        userInfo: {
          memberShip: {
            plan: selectedPlan.name,
            date: endDate
          }
        } as any
      };

      this.profileService.updateProfile(
        this.registrationData.id,
        payload
      ).subscribe({
        next: async () => {
          this.profileService['api'].clearCache();

          const alert = await this.alertController.create({
            header: '🎉 Bienvenue parmi les VIP !',
            message: `
              Félicitations ! Votre adhésion <strong>${this.renewalData.plan}</strong> est maintenant active.
              <br><br>
              Vous faites désormais partie de nos membres VIP et bénéficiez des avantages exclusifs dans la communauté.
            `,
            backdropDismiss: false,
            buttons: [
              {
                text: 'Continuer le vibe',
                handler: () => {
                  this.router.navigate(['/home']);
                }
              }
            ]
          });

          await alert.present();
        },
        error: (error) => {
          console.error('❌ Erreur lors de la mise à jour du profil :', error);
          this.tryCreateAccount();
        }
      });

    } else {
      this.tryCreateAccount();
    }
  },

  error: (err) => {
    console.error('❌ purchasePlan a échoué:', err);

    // Le wallet est sauvegardé localement,
    // on poursuit le processus de création de compte.
    this.tryCreateAccount();
  }
});
          
        } else {
          // Afficher une alerte ou un toast avec result.error
        console.error("Échec du paiement :", result.error);
        }
       }
      }else{
        this.tryCreateAccount();
      }
    }
  }

  



  private async tryCreateAccount() {
    this.isLoading = true;
    try {
      const loading = await this.loadingController.create({
        message: "Création de compte...",
        spinner: "bubbles",
        duration: 6000
      });
      await loading.present();

      
      const signupResponse = await firstValueFrom(this.auth.signup(this.registrationData));
      
      if (!signupResponse.success) {
        throw new Error(signupResponse.error || signupResponse.message || 'Échec de l\'inscription');
      } else {
        await loading.dismiss();

        
        if (signupResponse.user_id) {
          await this.notificationManager.notifyWelcome(signupResponse.user_id);
        }
        
        await this.router.navigate(['/default/account-success'], {
          state: {
            name: this.registrationData.name,
            email: this.registrationData.email
          }
        });
        
        // Réinitialisation des données
        this.registrationData = null;
      }

    } catch (error: any) {
      console.error('Erreur d\'inscription:', error);
      const errorMessage = error?.message || 'Une erreur est survenue lors de l\'inscription';
      
      const failureAlert = await this.alertController.create({
        header: 'Échec de la création',
        message: errorMessage,
        buttons: ['Recommencer']
      });
      await failureAlert.present();
      
    } finally {
      this.isLoading = false;
    }
  }

  getIconByName(icon: string): string {
    const name = icon.trim();
    if (name === "Exhibition") return 'assets/icon/exhibition.png';
    if (name === "Standard") return 'assets/icon/standard.png';
    if (name === "Premium") return 'assets/icon/premium.png';
    if (name === "Gold") return 'assets/icon/gold.png';
    return 'assets/icon/value.png';
  }
}