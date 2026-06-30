import { Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { PremiumLockComponent } from '../../app/components/premium-lock/premium-lock.component';

@Injectable({
  providedIn: 'root'
})
export class PremiumService {

  constructor(
    private modalCtrl: ModalController,
    private router: Router
  ) {}

  /**
   * Vérifie si l'utilisateur a accès. 
   * Si oui, retourne true. Si non, ouvre le modal PremiumLock et retourne false.
   */
  async checkAccessOrLock(currentUserProfile: any, enterAnimation?: any, leaveAnimation?: any): Promise<boolean> {
    if (!currentUserProfile?.userInfo?.memberShip) {
      // Pas d'abonnement du tout -> On bloque
      await this.openPremiumLock(currentUserProfile, enterAnimation, leaveAnimation);
      return false;
    }

    const plan = currentUserProfile.userInfo.memberShip.plan.trim().toLowerCase();
    const expirationDate = new Date(currentUserProfile.userInfo.memberShip.date).getTime();
    const isExpired = expirationDate <= Date.now();

    // Déclenchement si plan 'exhibition' OU expiré
    if (plan === 'exhibition' || isExpired) {
      await this.openPremiumLock(currentUserProfile, enterAnimation, leaveAnimation);
      return false;
    }

    return true; // Accès autorisé !
  }

  private async openPremiumLock(currentUserProfile: any, enterAnimation?: any, leaveAnimation?: any): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: PremiumLockComponent,
      cssClass: 'dialog-modal',
      backdropDismiss: false,
      enterAnimation: enterAnimation,
      leaveAnimation: leaveAnimation
    });
    
    await modal.present();

    const { role } = await modal.onWillDismiss();
    
    if (role === 'upgrade') {
      try {
        const renewalInfo = {
          plan: currentUserProfile.userInfo.memberShip?.plan,
          date: currentUserProfile.userInfo.memberShip?.date
        };
        
        await this.router.navigate(['/subscription'], {
          state: { registrationData: currentUserProfile, renewalData: renewalInfo }
        });
      } catch (navError) {
        console.error("Erreur lors de la navigation :", navError);
      }
    }
  }
}