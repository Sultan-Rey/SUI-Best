import { Component, Inject, OnInit, inject } from '@angular/core';

import { CommonModule } from '@angular/common';

import { FormsModule } from '@angular/forms';

import { AlertController, LoadingController } from '@ionic/angular';

import { Router } from '@angular/router';

import { UserProfile } from 'src/models/User';

import { Plan } from '../../models/Plan';

import { ProfileService } from 'src/services/Service_profile/profile-service';

import { 

  IonContent,

  IonHeader,

  IonTitle,

  IonToolbar,

  IonButtons,

  IonButton,

  IonIcon, IonSpinner, IonLoading } from '@ionic/angular/standalone';

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

import { User } from 'src/models/User';

import { UserService } from 'src/services/Service_user/user-service';

import { firstValueFrom, map, tap } from 'rxjs';

import { Auth } from 'src/services/AUTH/auth';

import { environment } from 'src/environments/environment.prod';

import { FirebaseService } from 'src/services/API/firebase/firebase-service';

import { NotificationManagerService } from 'src/services/Notification/notification-manager-service';



@Component({

  selector: 'app-subscription',

  templateUrl: './subscription.page.html',

  styleUrls: ['./subscription.page.scss'],

  standalone: true,

  imports: [IonLoading, 

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

  

  // Utiliser inject() pour les services dans une page standalone

  private router = inject(Router);

  private alertController = inject(AlertController);

  private loadingController = inject(LoadingController);

  private subscriptionService = inject(SubscriptionService);

  private auth = inject(Auth);

  private firebaseService = inject(FirebaseService);

  private notificationManager = inject(NotificationManagerService);



  constructor() {

     addIcons({

    'arrow-back': arrowBack,

    'sparkles': sparkles,

    'flame': flame,

    'checkmark-circle': checkmarkCircle,

    'rocket': rocket,

    'calendar': calendar,  // Ajouté

    'trophy': trophy,       // Ajouté

    'eye-outline': eyeOutline,

    'diamond-outline': diamondOutline,

    'star-outline': starOutline,

    'trophy-outline': trophyOutline,

  });

  if(this.router.getCurrentNavigation()?.extras.state?.['registrationData']) {

    this.registrationData = this.router.getCurrentNavigation()?.extras.state?.['registrationData'] as User;

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

      animated:true,

      duration: 8000

    });

    await loading.present();



    this.error = null;

    

    this.subscriptionService.getAvailablePlans().subscribe({

      next: (plans) => {

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

  // 1️⃣ Vérifier si un plan est sélectionné

  if (!this.selectedPlan) {

    const alert = await this.alertController.create({

      header: 'Information',

      message: 'Veuillez sélectionner un plan pour continuer',

      buttons: ['OK']

    });

    await alert.present();

    return;

  }

  // 2️⃣ Mettre à jour les données avec le plan sélectionné

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

   // Calculer les dates de début et de fin

const startDate = new Date();

const endDate = new Date();

// Vérifier si le plan est gratuit

if (selectedPlan.price === 0) {

  // Pour le plan gratuit, définir une durée par défaut de 30 jours

  endDate.setDate(startDate.getDate() + 30);

} else {

  // Pour les plans payants, utiliser la durée spécifiée (1 mois par défaut)

  endDate.setMonth(startDate.getMonth() + 1);

}

// Mettre à jour myPlan avec la nouvelle structure

this.registrationData.myPlan = {

  id: selectedPlan.id,

  name: selectedPlan.name,

  price: selectedPlan.price,

  period: selectedPlan.period,      

  duration: selectedPlan.price === 0 ? 30 : 30, // 30 jours pour tous les plans

  startDate: startDate.toISOString(),

  endDate: endDate.toISOString(),

  status:  'active',

  features: selectedPlan.features

};

    

    try {

      this.isLoading = true;

      // Utilisation propre du service Auth avec gestion d'erreurs

      const signupResponse = await firstValueFrom(this.auth.signup(this.registrationData));
      
      if (!signupResponse.success) {

        throw new Error(signupResponse.error || signupResponse.message || 'Échec de l\'inscription');

      } else {

         // Afficher le message de succès

      const successAlert = await this.alertController.create({

        header: 'Succès',

        message: signupResponse.message || 'Votre compte a été créé avec succès ! Veuillez vérifier votre email pour activer votre compte.',

        buttons: [{

          text: 'Se connecter',

          handler: async () => {

            // Rediriger vers la page de connexion

            await this.router.navigate(['/login']);

          }

        }]

      });

      await successAlert.present();
      
      // Notifier l'inscription réussie

      if (this.registrationData?.id) {

        await this.notificationManager.notifyWelcome(this.registrationData.id);

      }
     
      // Réinitialiser les données du formulaire

      this.registrationData.password_hash = "";

      this.registrationData.QR_proof = "";

      this.registrationData.status = "pending";

      this.registrationData.first_name = "";

      this.registrationData.last_name = "";

      this.registrationData.gender = "";

      this.registrationData.birthDate = new Date();

      this.registrationData.age = 0;

      this.registrationData.email = "";

      this.registrationData.password = "";

      this.registrationData.user_type = "fan";

      this.registrationData.user_status = "other";

      this.registrationData.registration_date = "";

      }

    } catch (error: any) {

      console.error('Erreur d\'inscription:', error);
      
      // Message d'erreur par défaut

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

}

  /**

   * Traduit les messages d'erreur du service Auth en messages utilisateur

   */

  private translateErrorMessage(error: any): string {

    const message = error?.error || error;

    console.log(message);

    // Messages d'erreur spécifiques du service Auth

    if (message.error === 'MISSING_CREDENTIALS') {

      return 'Veuillez remplir tous les champs obligatoires';

    }

    if (message.error === 'INVALID_EMAIL') {

      return 'Veuillez saisir un email valide';

    }

    if (message.error === 'PASSWORD_TOO_SHORT') {

      return 'Le mot de passe doit contenir au moins 8 caractères';

    }

    if (message.error === 'EMAIL_ALREADY_EXISTS') {

      return 'Cet email est déjà utilisé. Veuillez en choisir un autre.';

    }

    if (message.error === 'USERNAME_ALREADY_EXISTS') {

      return 'Ce nom d\'utilisateur est déjà utilisé. Veuillez en choisir un autre.';

    }

    

    // Message par défaut

    return message || 'Une erreur est survenue lors de l\'inscription';

  }

}