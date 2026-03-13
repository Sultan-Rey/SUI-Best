import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons, IonBackButton, IonIcon, IonBadge, IonToggle } from '@ionic/angular/standalone';
import { Auth } from 'src/services/AUTH/local-auth/auth';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { logOutOutline, chevronBackOutline, personCircleOutline, keyOutline, chevronForwardOutline, shieldCheckmarkOutline, banOutline, lockClosedOutline, locationOutline, peopleOutline, eyeOffOutline, radioOutline, notificationsOutline, settingsOutline, phonePortraitOutline, mailOutline, shieldOutline, fingerPrintOutline, desktopOutline, informationCircleOutline, documentTextOutline, openOutline, shieldHalfOutline, codeOutline, warningOutline, trashOutline } from 'ionicons/icons';
import { ModalController, AlertController, ToastController, LoadingController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { UserProfile, User } from '../../models/User';
import { UserService } from '../../services/USER_SERVICE/user-service';
import { PreferenceService } from '../../services/PREFERENCES/preference-service';
import { Setting } from '../../models/Setting';
import * as bcrypt from 'bcryptjs';
import { WalletService } from 'src/services/WALLET_SERVICE/wallet-service';

interface PrivacySettings {
  disableLocation: boolean;
  contactsAccess: boolean;
  privateAccount: boolean;
  hideOnlineStatus: boolean;
}

interface NotificationSettings {
  pushEnabled: boolean;
  emailEnabled: boolean;
}

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  providers: [ModalController],
  imports: [IonToggle, IonBadge, IonIcon, IonButtons, IonButton, IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class SettingsPage implements OnInit {

   // Données utilisateur
  userProfile: UserProfile | null = null;
  user: User | null = null;
  settings: Setting | null = null;
  isVerified = false;
  blockedCount = 0;
  is2FAEnabled = false;
  activeSessionsCount = 1;
  appVersion = '1.0.0';

  // Paramètres de confidentialité
  privacySettings: PrivacySettings = {
    disableLocation: false,
    contactsAccess: false,
    privateAccount: false,
    hideOnlineStatus: false,
  };

  // Paramètres de notifications
  notificationSettings: NotificationSettings = {
    pushEnabled: true,
    emailEnabled: true,
  };

  
  constructor(
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private route: ActivatedRoute,
    private userService: UserService,
    private router: Router,
    private auth: Auth,
    private preferenceService: PreferenceService,
    private walletService: WalletService
  )  {
    addIcons({chevronBackOutline,personCircleOutline,keyOutline,chevronForwardOutline,shieldCheckmarkOutline,banOutline,lockClosedOutline,locationOutline,peopleOutline,eyeOffOutline,radioOutline,notificationsOutline,settingsOutline,phonePortraitOutline,mailOutline,shieldOutline,fingerPrintOutline,desktopOutline,informationCircleOutline,documentTextOutline,openOutline,shieldHalfOutline,codeOutline,warningOutline,logOutOutline,trashOutline});
  }

    ngOnInit() {
    // Récupérer le UserProfile et User depuis le router state
    const navigation = this.router.getCurrentNavigation();
    this.userProfile = navigation?.extras.state?.['userProfile'] || null;
    this.user = navigation?.extras.state?.['user'] || null;
    
    // Si l'utilisateur n'a pas de password_hash, le récupérer depuis le service
    if (this.user && !this.user.password_hash) {
      this.userService.getUserById(this.user.id).subscribe({
        next: (fullUser: User | null) => {
          this.user = fullUser;
          //console.log('👤 UTILISATEUR COMPLET CHARGÉ:', !!fullUser.password_hash);
        },
        error: (error: any) => {
         // console.error('❌ Erreur chargement utilisateur complet:', error);
        }
      });
    }
    
    if (this.userProfile) {
      this.isVerified = this.userProfile.isVerified;
      this.blockedCount = this.userProfile.myBlackList.length;
    }
    
    // Charger les settings depuis PreferenceService
    if (this.user) {
      this.settings = this.preferenceService.getSettingsForUser(this.user.id.toString()) || 
                   this.preferenceService.initializeSettings(this.user.id.toString());
    }
    
    // Récupérer le nombre de sessions actives depuis le backend
    this.auth.getActiveSessionsCount().subscribe({
      next: (count) => {
        this.activeSessionsCount = count;
      },
      error: (error) => {
        console.error('Erreur lors de la récupération du nombre de sessions:', error);
        this.activeSessionsCount = 0;
      }
    });
    
    this.loadSettings();
  }

  // ==========================================
  // Page MANAGEMENT
  // ==========================================

  back() {
    this.router.navigate(['tabs/tabs/profile']);
  }

 // ==========================================
  // COMPTE
  // ==========================================

  async changePassword() {
    const alert = await this.alertCtrl.create({
      header: 'Changer le mot de passe',
      message: 'Vous allez recevoir un email pour réinitialiser votre mot de passe.',
      inputs: [
        {
          name: 'currentPassword',
          type: 'password',
          placeholder: 'Mot de passe actuel',
        },
        {
          name: 'newPassword',
          type: 'password',
          placeholder: 'Nouveau mot de passe',
        },
        {
          name: 'confirmPassword',
          type: 'password',
          placeholder: 'Confirmer le mot de passe',
        },
      ],
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel',
        },
        {
          text: 'Modifier',
          handler: (data) => {
            if (data.newPassword !== data.confirmPassword) {
              this.showToast('Les mots de passe ne correspondent pas', 'danger');
              return false;
            }
            // Appel API pour changer le mot de passe
            this.handlePasswordChange(data.currentPassword, data.newPassword);
            return true;
          },
        },
      ],
    });

    await alert.present();
  }

  async verifyAccount() {
    const alert = await this.alertCtrl.create({
      header: 'Vérifier mon compte',
      message: 'Pour obtenir le badge vérifié, vous devez fournir une pièce d\'identité valide.',
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel',
        },
        {
          text: 'Commencer',
          handler: () => {
            // Navigation vers le processus de vérification
            this.showToast('Processus de vérification lancé', 'success');
          },
        },
      ],
    });

    await alert.present();
  }

  async manageBlockList() {
    if (this.userProfile && this.userProfile.myBlackList && this.userProfile.myBlackList.length > 0) {
      // Navigation vers la page de liste noire avec myBlackList en extras
      this.router.navigate(['/blacklist'], {
        state: {
          myBlackList: this.userProfile.myBlackList
        }
      });
    } else {
      // Message toast si la liste est vide
      this.showToast('Votre liste noire est vide', 'primary');
    }
  }

  // ==========================================
  // CONFIDENTIALITÉ
  // ==========================================

  async updatePrivacySetting(setting: string, event: any) {
    const isEnabled = event.detail.checked;
    
    if (!this.user) {
      this.showToast('Erreur: utilisateur non trouvé', 'danger');
      return;
    }
    
    try {
      // Mettre à jour les settings avec PreferenceService
      switch (setting) {
        case 'location':
          this.preferenceService.toggleLocationAccess(this.user.id.toString());
          this.showToast(isEnabled ? 'Localisation activée' : 'Localisation désactivée', 'success');
          break;
          
        case 'contacts':
          this.preferenceService.toggleContactsAccess(this.user.id.toString());
          this.showToast(isEnabled ? 'Accès aux contacts activé' : 'Accès aux contacts désactivé', 'success');
          break;
          
        case 'private':
          this.preferenceService.togglePrivateAccount(this.user.id.toString());
          this.showToast(isEnabled ? 'Compte privé activé' : 'Compte public activé', 'success');
          break;
          
        case 'onlineStatus':
          this.preferenceService.toggleOnlineStatusVisibility(this.user.id.toString());
          this.showToast(isEnabled ? 'Statut en ligne masqué' : 'Statut en ligne visible', 'success');
          break;
          
        default:
          console.warn('Paramètre de confidentialité non reconnu:', setting);
          return;
      }
      
      // Recharger les settings pour synchroniser
      this.settings = this.preferenceService.getSettingsForUser(this.user.id.toString());
      this.loadSettings();
      
    } catch (error) {
      console.error('Erreur lors de la mise à jour du paramètre:', error);
      this.showToast('Erreur lors de la mise à jour du paramètre', 'danger');
    }
  }

  // ==========================================
  // NOTIFICATIONS
  // ==========================================

  async manageNotifications() {
    // Navigation vers la page de gestion détaillée des notifications
    this.showToast('Gestion des notifications...', 'primary');
  }

  async updateNotificationSetting(setting: string, event: any) {
    const isEnabled = event.detail.checked;
    
    // Sauvegarder le paramètre
    // await this.settingsService.updateNotification(setting, isEnabled);
    
    const messages: { [key: string]: string } = {
      push: isEnabled ? 'Notifications push activées' : 'Notifications push désactivées',
      email: isEnabled ? 'Notifications email activées' : 'Notifications email désactivées',
    };

    this.showToast(messages[setting] || 'Paramètre mis à jour', 'success');
  }

  // ==========================================
  // SÉCURITÉ
  // ==========================================

  async setup2FA() {
    const message = this.is2FAEnabled
      ? 'Voulez-vous désactiver l\'authentification à deux facteurs ?'
      : 'Activez l\'authentification à deux facteurs pour sécuriser votre compte.';

    const alert = await this.alertCtrl.create({
      header: 'Authentification 2FA',
      message,
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel',
        },
        {
          text: this.is2FAEnabled ? 'Désactiver' : 'Activer',
          handler: () => {
            this.is2FAEnabled = !this.is2FAEnabled;
            const status = this.is2FAEnabled ? 'activée' : 'désactivée';
            this.showToast(`Authentification 2FA ${status}`, 'success');
          },
        },
      ],
    });

    await alert.present();
  }

  async manageSessions() {
    const alert = await this.alertCtrl.create({
      header: 'Sessions actives',
      message: `Vous avez ${this.activeSessionsCount} appareil(s) connecté(s). Voulez-vous déconnecter tous les autres appareils ?`,
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel',
        },
        {
          text: 'Déconnecter',
          handler: async () => {
            // Approche UX : afficher un loading pendant la révocation
            const loading = await this.loadingCtrl.create({
              message: 'Déconnexion des autres appareils...',
              spinner: 'crescent',
              cssClass: 'sessions-loading'
            });
            
            await loading.present();
            
            try {
              if (!this.user) {
                throw new Error('Utilisateur non trouvé');
              }

              // Récupérer les informations de la session actuelle
              const currentSessionInfo = this.auth.getSessionInfo();
              if (!currentSessionInfo) {
                throw new Error('Session actuelle non trouvée');
              }

              // Révoquer toutes les autres sessions via le backend
              await this.revokeOtherSessions(this.user.id.toString(), currentSessionInfo.sessionId);
              
              // Simuler un délai pour l'UX
              await new Promise(resolve => setTimeout(resolve, 800));
              
              await loading.dismiss();
              
              // Mettre à jour le compteur de sessions
              this.activeSessionsCount = 1;
              
              // Toast de succès
              await this.showToast('Autres sessions déconnectées avec succès', 'success');
              
            } catch (error) {
              await loading.dismiss();
              console.error('Erreur lors de la déconnexion des autres sessions:', error);
              await this.showToast('Erreur lors de la déconnexion des autres appareils', 'danger');
            }
          },
        },
      ],
    });

    await alert.present();
  }

  private async revokeOtherSessions(userId: string, currentSessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Utiliser la méthode du service Auth pour révoquer les autres sessions
      this.auth.revokeAllOtherSessions(userId, currentSessionId);
      
      // Simuler un délai pour l'UX et permettre au backend de traiter
      setTimeout(() => {
        resolve();
      }, 500);
    });
  }

  // ==========================================
  // À PROPOS
  // ==========================================

  openTerms() {
    // Ouvrir les conditions d'utilisation
    window.open('https://yourapp.com/terms', '_blank');
  }

  openPrivacyPolicy() {
    // Ouvrir la politique de confidentialité
    window.open('https://yourapp.com/privacy', '_blank');
  }

  // ==========================================
  // ZONE DE DANGER
  // ==========================================

  async logout() {
    const alert = await this.alertCtrl.create({
      header: 'Se déconnecter',
      message: 'Êtes-vous sûr de vouloir vous déconnecter ?',
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel',
        },
        {
          text: 'Déconnexion',
          handler: async () => {
            // Approche UX : afficher un loading pendant la déconnexion
            const loading = await this.loadingCtrl.create({
              message: 'Déconnexion en cours...',
              spinner: 'crescent',
              cssClass: 'logout-loading'
            });
            
            await loading.present();
            
            try {
              // Utiliser la méthode logout de Auth pour supprimer les traces
              this.auth.logout();
              
              // Supprimer les caches 
              this.walletService.clearWalletCache();
              this.preferenceService.clearAllSettings();
              
              // Simuler un délai pour l'UX
              await new Promise(resolve => setTimeout(resolve, 800));
              
              await loading.dismiss().then(() => {
                window.location.href = '/login';
              });
              
            } catch (error) {
              await loading.dismiss();
              console.error('Erreur lors de la déconnexion:', error);
              await this.showToast('Erreur lors de la déconnexion', 'danger');
            }
          },
        },
      ],
    });

    await alert.present();
  }

  async deleteAccount() {
    const alert = await this.alertCtrl.create({
      header: '⚠️ Supprimer le compte',
      message: 'Cette action est IRRÉVERSIBLE. Toutes vos données seront définitivement supprimées.',
      inputs: [
        {
          name: 'confirmation',
          type: 'text',
          placeholder: 'Tapez "SUPPRIMER" pour confirmer',
        },
      ],
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel',
        },
        {
          text: 'Supprimer définitivement',
          role: 'destructive',
          handler: (data) => {
            if (data.confirmation.toUpperCase() === 'SUPPRIMER') {
              this.handleAccountDeletion();
              return true;
            } else {
              this.showToast('Confirmation incorrecte', 'danger');
              return false;
            }
          },
        },
      ],
    });

    await alert.present();
  }

  // ==========================================
  // HELPERS
  // ==========================================

  private loadSettings() {
    
    // Charger les paramètres depuis PreferenceService
    if (this.settings) {
      // Mettre à jour les propriétés locales depuis les settings
      this.privacySettings = {
        disableLocation: this.settings.privacy.enableLocation,
        contactsAccess: this.settings.privacy.contactsAccess,
        privateAccount: this.settings.privacy.privateAccount,
        hideOnlineStatus: this.settings.privacy.hideOnlineStatus,
      };
      
      this.notificationSettings = {
        pushEnabled: this.settings.notifications.pushEnabled,
        emailEnabled: this.settings.notifications.emailEnabled,
      };
      
      this.is2FAEnabled = this.settings.security.twoFactorEnabled;
    }
  }

  private async handlePasswordChange(currentPassword: string, newPassword: string) {
    try {
      
      if (!this.user) {
        this.showToast('Erreur: utilisateur non trouvé', 'danger');
        return;
      }

      if (!this.user.password_hash) {
        //console.error('❌ PASSWORD_HASH MANQUANT');
        this.showToast('Erreur: hash du mot de passe non disponible', 'danger');
        return;
      }

      // 1. Vérifier que le hash bcrypt du currentPassword correspond au password_hash du User
       const isPasswordValid = await bcrypt.compare(currentPassword, this.user.password_hash);
       
      if (!isPasswordValid) {
        this.showToast('Mot de passe actuel incorrect', 'danger');
        return;
      }

      // 2. Si le mot de passe est valide, hasher le nouveau mot de passe
      const saltRounds = await bcrypt.genSalt(10);
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
     
      // 3. Utiliser updatePasswordHash de UserService pour mettre à jour le mot de passe
       const result = await this.userService.updatePasswordHash(this.user.id as string, newPasswordHash).toPromise();
 
      // 4. Mettre à jour le user local avec le nouveau hash
      this.user.password_hash = newPasswordHash;

      this.showToast('Mot de passe modifié avec succès', 'success');
    } catch (error) {
      console.error('❌ Erreur lors du changement de mot de passe:', error);
      console.error('❌ STACK TRACE:', (error as any)?.stack);
      
      // Message d'erreur plus spécifique
      let errorMessage = 'Erreur lors du changement de mot de passe';
      if ((error as any)?.message?.includes('bcrypt')) {
        errorMessage = 'Erreur lors du hashage du mot de passe';
      } else if ((error as any)?.status) {
        errorMessage = `Erreur serveur: ${(error as any).status}`;
      }
      
      this.showToast(errorMessage, 'danger');
    }
  }

  private async handleAccountDeletion() {
    try {
      if (!this.user) {
        this.showToast('Erreur: utilisateur non trouvé', 'danger');
        return;
      }

      // Approche UX : afficher un loading pendant la suppression
      const loading = await this.loadingCtrl.create({
        message: 'Suppression de votre compte...',
        spinner: 'crescent',
        cssClass: 'delete-loading'
      });
      
      await loading.present();
      
      try {
        // Utiliser deleteUser de UserService
        await this.userService.deleteUser(this.user.id as string).toPromise();
        
        // Simuler un délai pour l'UX
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        await loading.dismiss();
        
        // Toast de confirmation
        await this.showToast('Compte supprimé. Au revoir 😢', 'success');
        
        // Déconnexion pour nettoyer les traces
        this.auth.logout();
        
        // Redirection vers login avec un léger délai pour voir le toast
        setTimeout(() => {
          this.router.navigate(['/login'], { replaceUrl: true });
        }, 800);
        
      } catch (error) {
        await loading.dismiss();
        console.error('Erreur lors de la suppression du compte:', error);
        await this.showToast('Erreur lors de la suppression du compte', 'danger');
      }
    } catch (error) {
      console.error('Erreur inattendue:', error);
      this.showToast('Erreur lors de la suppression du compte', 'danger');
    }
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      position: 'top',
      color,
      cssClass: 'custom-toast',
    });
    await toast.present();
  }

}
