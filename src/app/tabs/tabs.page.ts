import { Component, EnvironmentInjector, inject, OnInit } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { NgClass } from '@angular/common';
import { home, trophy, addCircle, person, star } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { Auth } from 'src/services/AUTH/auth';
import { UserService } from 'src/services/USER_SERVICE/user-service';


@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  imports: [ NgClass, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
})
export class TabsPage implements OnInit {
  public environmentInjector = inject(EnvironmentInjector);
   activeTab = 'home';
   subscriptionStatus: 'active' | 'expiring' | 'expired' | 'inactive' = 'inactive';
  constructor( private userService:UserService, private authService:Auth) {
    
    addIcons({ home, trophy, addCircle, person, star });
  }
    async checkSubscriptionStatus() {
    try {
      // Récupérer l'utilisateur connecté via le service Auth
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser || !currentUser.email) {
        this.subscriptionStatus = 'inactive';
        return;
      }

      // Récupérer les détails complets de l'utilisateur via UserService
      const user = await firstValueFrom(
        this.userService.getUserByEmail(currentUser.email)
      );

      if (user && user.myPlan) {
        const endDate = new Date(user.myPlan.endDate);
        const today = new Date();
        const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        console.log("subscription status", user.myPlan.id);
        if (user.myPlan.status === 'active' && user.myPlan.id !=='exhibition') {
          this.subscriptionStatus = daysUntilExpiry <= 7 ? 'expiring' : 'active';
        } else {
          this.subscriptionStatus = 'expired';
        }
      } else {
        this.subscriptionStatus = 'inactive';
      }
    } catch (error) {
      console.error('Erreur lors de la vérification du statut d\'abonnement:', error);
      this.subscriptionStatus = 'inactive';
    }
  }

  getSubscriptionStatus() {
   
    return this.subscriptionStatus;
  }

  setActiveTab(event: any) {
    this.activeTab = event.tab;
  }

  ngOnInit(): void {
    this.checkSubscriptionStatus();
  }
}
