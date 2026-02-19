import { Component, EnvironmentInjector, inject, OnInit } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { NgClass, NgIf } from '@angular/common';
import { home, trophy, addCircle, person, star } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { Auth } from 'src/services/AUTH/auth';
import { UserService } from 'src/services/USER_SERVICE/user-service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';


@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  imports: [ NgClass, NgIf, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
})
export class TabsPage implements OnInit {
  public environmentInjector = inject(EnvironmentInjector);
   activeTab = 'home';
   private destroy$ = new Subject<void>();
   subscriptionStatus: 'active' | 'expiring' | 'expired' | 'inactive' = 'inactive';
   isRight_toWrite: boolean = false;

constructor(
  private userService: UserService, 
  private authService: Auth
) {
  addIcons({ home, trophy, addCircle, person, star });
  
  // 4. S'abonner aux changements d'authentification
  this.authService.currentUser$
    .pipe(takeUntil(this.destroy$))
    .subscribe(user => {
      if (user) {
        this.checkSubscriptionStatus();
      } else {
        this.subscriptionStatus = 'inactive';
      }
    });
}

   async checkSubscriptionStatus() {
  try {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.id) {
      this.subscriptionStatus = 'inactive';
      return;
    }

    const user = await this.userService.getUserById(currentUser.id.toString()).toPromise();
   
    if (user?.myPlan) {
      const endDate = new Date(user.myPlan.endDate);
      const today = new Date();
      
      if (endDate < today || user.myPlan.id == 'exhibition') {
        this.subscriptionStatus = 'expired';
      } else if (this.isExpiringSoon(endDate)) {
        this.subscriptionStatus = 'expiring';
      } else {
        this.subscriptionStatus = 'active';
      }
    } else {
      this.subscriptionStatus = 'inactive';
    }
  } catch (error) {
    console.error('Erreur lors de la vérification de l\'abonnement:', error);
    this.subscriptionStatus = 'inactive';
  }
}

// 7. Implémentez la méthode isExpiringSoon si elle n'existe pas déjà
private isExpiringSoon(endDate: Date): boolean {
  const today = new Date();
  const timeDiff = endDate.getTime() - today.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  return daysDiff <= 7; // Moins de 7 jours restants
}

  async checkRightToWrite(){
      try {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.id) {
      this.subscriptionStatus = 'inactive';
      return;
    }
     const user = await this.userService.getUserById(currentUser.id.toString()).toPromise();
    if (user?.readonly) {
      this.isRight_toWrite = true;
    } else {
      this.isRight_toWrite = false;
    }
  } catch (error) {
    console.error('Erreur lors de la vérification de l\'abonnement:', error);
    this.subscriptionStatus = 'inactive';
  }


}



  getSubscriptionStatus() {
   
    return this.subscriptionStatus;
  }

  getRightToWrite(){
    return this.isRight_toWrite
  }

  setActiveTab(event: any) {
    this.activeTab = event.tab;
  }

  ngOnInit(): void {
    this.checkSubscriptionStatus();
    this.checkRightToWrite();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
