import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { UserProfile } from 'src/models/User';
import { Dialog } from '@capacitor/dialog';
import { Plan } from '../../models/Plan';
import { ProfileService } from 'src/services/PROFILE_SERVICE/profile-service';
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
import { SubscriptionService } from 'src/services/SUBSCRIPTION/subscription-service';
import { User } from 'src/models/User';
import { UserService } from 'src/services/USER_SERVICE/user-service';
import { firstValueFrom, tap } from 'rxjs';



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
    IonIcon
  ]
})
export class SubscriptionPage implements OnInit {

  selectedPlan: string | null = null;
  plans: Plan[] = [];
  selectedPlanId: string | null = null;
  currentUser: User | null = null;
  isLoading = false;
  error: string | null = null
  registrationData: User | null = null;
  constructor( private router: Router, private subscriptionService: SubscriptionService, 
              private userService: UserService, private profileService: ProfileService) {
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

  ngOnInit() {this.loadPlans();}

  private loadPlans() {
    this.isLoading = true;
    this.error = null;
    
    this.subscriptionService.getAvailablePlans().subscribe({
      next: (plans) => {
    
        this.plans = plans;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des plans', err);
        this.error = 'Impossible de charger les plans. Veuillez réessayer plus tard.';
        this.isLoading = false;
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
    await Dialog.alert({
      title: 'Information',
      message: 'Veuillez sélectionner un plan pour continuer',
      buttonTitle: 'OK'
    });
    return;
  }

  // 2️⃣ Mettre à jour les données avec le plan sélectionné
  if (this.registrationData) {
    const selectedPlan = this.plans.find(plan => plan.id === this.selectedPlan);
    if (!selectedPlan) {
      await Dialog.alert({
        title: 'Erreur',
        message: 'Le plan sélectionné est invalide',
        buttonTitle: 'OK'
      });
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
    this.isLoading = true;

    try {
      // 3️⃣ Créer l'utilisateur
      const userCreated = await firstValueFrom(
        this.userService.createUser(this.registrationData).pipe(
          tap({
            next: (response) => console.log('Utilisateur créé :', response),
            error: (error) => {
              console.error('Erreur création utilisateur :', error);
              throw error;
            }
          })
        )
      );

      if (!userCreated?.id) {
        throw new Error('La création du compte a échoué. Aucun ID utilisateur reçu.');
      }

      // 4️⃣ Créer le profil utilisateur
      const userProfile: UserProfile = {
        id: userCreated.id.toString(),
        username: await this.generateUniqueUsername(
    this.registrationData.first_name || 'user',
    this.registrationData.last_name || userCreated.id.toString().substring(0, 8)
  ),
        displayName: `${this.registrationData.first_name} ${this.registrationData.last_name}`,
        avatar: 'assets/avatar-default.png',
        isVerified: false,
        isFollowing: false,
        bio: '',
        school: this.registrationData.user_status === 'university' ? 'Nom de l\'université' : 
               this.registrationData.user_status === 'student' ? 'Nom de l\'école' : '',
        contact: this.registrationData.email,
        memberSince: new Date().toISOString().split('T')[0],
        userType: this.registrationData.user_type || 'fan',
        stats: {
          posts: 0,
          fans: 0,
          votes: 0,
          stars: 0
        }
      };

      // 5️⃣ Enregistrer le profil
      await firstValueFrom(
        this.profileService.createProfile(userProfile).pipe(
          tap({
            next: (response) => console.log('Profil créé :', response),
            error: (error) => {
              console.error('Erreur création profil :', error);
              throw error;
            }
          })
        )
      );

      // 6️⃣ Afficher un message de succès
      await Dialog.alert({
        title: 'Succès',
        message: 'Votre compte a été créé avec succès ! Vous pouvez maintenant vous connecter.',
        buttonTitle: 'Se connecter'
      });

          this.registrationData.id = userCreated.id;
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
      // 7️⃣ Rediriger vers la page de connexion
      await this.router.navigate(['/login']);

    } catch (error) {
      console.error('Erreur lors de l\'inscription :', error);
      await Dialog.alert({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Une erreur est survenue lors de l\'inscription',
        buttonTitle: 'OK'
      });
    } finally {
      this.isLoading = false;
    }
  }
}




private async generateUniqueUsername(firstName: string, lastName: string): Promise<string> {
  // Nettoyer les caractères spéciaux et les accents
  const cleanString = (str: string) => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') // Garde uniquement les lettres et chiffres
      .substring(0, 15); // Limite la longueur
  };

  const cleanFirstName = cleanString(firstName);
  const cleanLastName = cleanString(lastName);
  
  // Première tentative : prénom.nom
  let baseUsername = `${cleanFirstName}.${cleanLastName}`;
  let username = baseUsername;
  let counter = 1;

  // Vérifier si le nom d'utilisateur existe déjà
  const usernameExists = async (username: string): Promise<boolean> => {
    try {
      const profiles = await firstValueFrom(this.profileService.getProfiles());
      return profiles.some(profile => profile.username === username);
    } catch (error) {
      console.error('Erreur lors de la vérification du nom d\'utilisateur', error);
      return false; // En cas d'erreur, on considère que le nom est disponible
    }
  };

  // Tant que le nom d'utilisateur existe, on ajoute un numéro
  while (await usernameExists(username)) {
    username = `${baseUsername}${counter}`;
    counter++;
    
    // Limite de sécurité pour éviter les boucles infinies
    if (counter > 1000) {
      throw new Error('Impossible de générer un nom d\'utilisateur unique');
    }
  }

  return username;
}

}