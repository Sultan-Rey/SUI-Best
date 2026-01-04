import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonButton,
  IonIcon
} from '@ionic/angular/standalone';
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

interface Plan {
  id: string;
  name: string;
  price: number;  // Changé de string à number
  period: string;
  icon: string;
  features: string[];
  popular: boolean;
  color?: string;  // Optionnel, ajouté pour la couleur
}

@Component({
  selector: 'app-subscription',
  templateUrl: './subscription.page.html',
  styleUrls: ['./subscription.page.scss'],
  standalone: true,
  imports: [
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
  plans: Plan[] = [
    {
      id: 'exhibition',
      name: 'Exhibition',
      price: 0,
      period: 'Gratuit',
      color: '#6b7280',
      icon: 'eye-outline',
      popular: false,
      features: [
        'Regarder les performances',
        'Accès de base',
        'Streaming standard'
      ]
    },
  {
      id: 'silver',
      name: 'Silver',
      price: 9.99,
      period: '/mois',
      color: '#c0c0c0',
      icon: 'star-outline',
      popular: false,
      features: [
        'Regarder les performances',
        'Interactions avec les artistes',
        'Chat en direct',
        'Notifications prioritaires'
      ]
    },
  {
      id: 'gold',
      name: 'Gold',
      price: 19.99,
      period: '/mois',
      color: '#ff7f00',
      icon: 'trophy-outline',
      popular: true,
      features: [
        'Tous les avantages Silver',
        'Accès aux contenus exclusifs',
        'Droits de publications',
        'Badge Gold exclusif',
        'Support prioritaire'
      ]
    },
    {
      id: 'diamond',
      name: 'Diamond',
      price: 39.99,
      period: '/mois',
      color: '#000055',
      icon: 'diamond-outline',
      popular: false,
      features: [
        'Tous les avantages Gold',
        'Possibilités de créer des challenges',
        'Accès VIP aux événements',
        'Badge Diamond exclusif',
        'Support dédié 24/7'
      ]
    }
];

  constructor( private router: Router) {
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
  }

  ngOnInit() {}

  selectPlan(planId: string) {
    this.selectedPlan = planId;
  }

  goBack() {
    this.router.navigate(['/register']);
  }

  subscribe() {
    // Si aucun plan n'est sélectionné ou si le plan est 'exhibition', rediriger vers la page d'accueil
    if (!this.selectedPlan || this.selectedPlan === 'exhibition') {
      this.router.navigate(['/login']);
      return;
    }
    
    // Implémentez ici la logique d'abonnement pour les autres plans
    if (this.selectedPlan) {
      // Logique d'abonnement pour les autres plans
      console.log('Abonnement au plan:', this.selectedPlan);
    }
  }
}