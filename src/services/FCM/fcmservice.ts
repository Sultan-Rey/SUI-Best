import { Injectable } from '@angular/core';
import { PushNotifications, PermissionStatus } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { NotificationManagerService } from '../Notification/notification-manager-service';
import { BehaviorSubject } from 'rxjs';
import { UserService } from '../Service_user/user-service';
import { Auth } from '../AUTH/auth';

@Injectable({
  providedIn: 'root',
})
export class FCMService {
  private tokenSubject = new BehaviorSubject<string | null>(null);
  public token$ = this.tokenSubject.asObservable();
  private isInitialized = false;

  constructor(
    private notificationManager: NotificationManagerService,
    private userService: UserService,
    private auth: Auth
  ) {}

  /**
   * Initialise Push Notifications et demande les permissions
   */
  async initializeFCM(): Promise<boolean> {
    // Vérifier si on est sur mobile
    if (!this.isPushSupported()) {
      console.log('Push Notifications non supporté sur cette plateforme');
      return false;
    }

    if (this.isInitialized) {
      return true;
    }

    try {
      // Demander la permission pour les notifications
      const permission = await this.requestPermission();
      if (!permission) {
        console.log('Permission refusée pour les notifications');
        return false;
      }

      // Enregistrer pour recevoir les notifications
      await this.registerForPush();

      // Écouter les notifications
      await this.setupPushListeners();

      this.isInitialized = true;
      return true;

    } catch (error) {
      console.error('Erreur lors de l\'initialisation Push Notifications:', error);
      return false;
    }
  }

  /**
   * Vérifie si Push Notifications est supporté sur la plateforme actuelle
   */
  private isPushSupported(): boolean {
    return Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios';
  }

  /**
   * Demande la permission pour les notifications
   */
  private async requestPermission(): Promise<boolean> {
    try {
      const permission = await PushNotifications.requestPermissions();
      return permission.receive === 'granted';
    } catch (error) {
      console.error('Erreur demande permission Push:', error);
      return false;
    }
  }

  /**
   * S'enregistre pour recevoir les notifications push
   */
  private async registerForPush(): Promise<void> {
    try {
      await PushNotifications.register();
      
      // Écouter l'enregistrement pour obtenir le token
      await PushNotifications.addListener('registration', (token) => {
        //console.log('Token Push obtenu:', token.value);
        this.tokenSubject.next(token.value);
        this.sendTokenToBackend(token.value);
      });

    } catch (error) {
      console.error('Erreur enregistrement Push:', error);
    }
  }

  /**
   * Configure l'écouteur de notifications push
   */
  private async setupPushListeners(): Promise<void> {
    try {
      // Écouter les notifications reçues
      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        this.handlePushNotification(notification);
      });

      // Écouter les erreurs d'enregistrement
      await PushNotifications.addListener('registrationError', (error) => {
        console.error('Erreur enregistrement Push:', error);
      });

    } catch (error) {
      console.error('Erreur configuration listeners Push:', error);
    }
  }

  /**
   * Gère les notifications push reçues
   */
  private handlePushNotification(notification: any): void {
   // console.log('Notification Push reçue:', notification);

    // Extraire les données de la notification
    const title = notification.title || 'Nouvelle notification';
    const body = notification.body || 'Vous avez une nouvelle notification';
    const data = notification.data || {};

    // Convertir en notification locale via NotificationManager
    // Pour les messages
    if (data.type === 'message') {
      this.notificationManager.notifyNewMessage(
        title,
        body,
        data.conversationId || 'system',
        data.senderId || 'system'
      );
    }
    // Pour les défis
    else if (data.type === 'challenge') {
      this.notificationManager.notifyChallengeCreated(
        title,
        data.challengeId || 'unknown',
        data.userId || 'unknown'
      );
    }
    // Notification générique
    else {
      this.notificationManager.notifyNewMessage(
        title,
        body,
        'system',
        'system'
      );
    }
  }

  /**
   * Envoie le token Push au backend (approche hybride)
   */
  private async sendTokenToBackend(token: string): Promise<void> {
    try {
      // 1. Sauvegarder en local (backup immédiat)
      localStorage.setItem('fcm_token', token);
      localStorage.setItem('token_synced', 'false');
      
     // console.log('Token Push sauvegardé en local:', token);
      
      // 2. Envoyer au backend (source de vérité)
      this.userService.updatePushToken(token, this.auth.getCurrentUser()?.id || '').subscribe({
        next: (response) => {
          console.log('Token Push envoyé au backend avec succès:', response);
          localStorage.setItem('token_synced', 'true');
          localStorage.setItem('last_sync', new Date().toISOString());
        },
        error: (error) => {
          console.error('Erreur envoi token au backend:', error);
          // Le token reste en local comme fallback
          localStorage.setItem('token_synced', 'false');
        }
      });
      
    } catch (error) {
      console.error('Erreur sauvegarde token:', error);
    }
  }

  /**
   * Initialise la synchronisation du token au démarrage
   */
  async initializeTokenSync(): Promise<void> {
    try {
      const currentToken = this.getCurrentToken();
      const localToken = localStorage.getItem('fcm_token');
      const tokenSynced = localStorage.getItem('token_synced') === 'true';
      
      // Si le token actuel est différent du token local
      if (currentToken && currentToken !== localToken) {
        console.log('Changement de token détecté, synchronisation...');
        await this.sendTokenToBackend(currentToken);
      }
      // Si le token local n'est pas synchronisé
      else if (localToken && !tokenSynced) {
        console.log('Token local non synchronisé, envoi en cours...');
        await this.sendTokenToBackend(localToken);
      }
      
    } catch (error) {
      console.error('Erreur synchronisation token:', error);
    }
  }

  /**
   * Rafraîchit le token Push
   */
  async refreshToken(): Promise<string | null> {
    try {
      // Se réenregistrer pour obtenir un nouveau token
      await PushNotifications.unregister();
      await this.registerForPush();
      return this.tokenSubject.value;
    } catch (error) {
      console.error('Erreur rafraîchissement token Push:', error);
      return null;
    }
  }

  /**
   * Désactive les Push Notifications
   */
  async disableFCM(): Promise<void> {
    try {
      await PushNotifications.unregister();
      this.tokenSubject.next(null);
      this.isInitialized = false;
      
      // Nettoyer le stockage local
      localStorage.removeItem('fcm_token');
      localStorage.removeItem('token_synced');
      localStorage.removeItem('last_sync');
      
      console.log('Push Notifications désactivées');
    } catch (error) {
      console.error('Erreur désactivation Push:', error);
    }
  }

  /**
   * Obtient le token actuel
   */
  getCurrentToken(): string | null {
    return this.tokenSubject.value;
  }

  /**
   * Obtient le token depuis le localStorage
   */
  getLocalToken(): string | null {
    return localStorage.getItem('fcm_token');
  }

  /**
   * Vérifie les permissions actuelles
   */
  async checkPermissions(): Promise<PermissionStatus> {
    return await PushNotifications.checkPermissions();
  }

  /**
   * Vérifie l'état de synchronisation du token
   */
  getTokenSyncStatus(): { synced: boolean; lastSync: string | null } {
    return {
      synced: localStorage.getItem('token_synced') === 'true',
      lastSync: localStorage.getItem('last_sync')
    };
  }
}
