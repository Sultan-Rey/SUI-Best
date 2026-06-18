import { Injectable } from '@angular/core';
import { PushNotifications, PermissionStatus } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { NotificationManagerService } from '../Notification/notification-manager-service';
import { BehaviorSubject } from 'rxjs';
import { UserService } from '../Service_user/user-service';
import { Auth } from '../AUTH/auth';
import { Router } from '@angular/router';

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
    private auth: Auth,
    private router: Router
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
      // Écouter les notifications reçues (quand app est au premier plan)
      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        this.handlePushNotification(notification);
      });

      // ✅ NOUVEAU : Écouter les notifications quand l'app est ouverte via notification
      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        // Ceci est appelé quand l'utilisateur TAPE sur la notification
        this.handleNotificationAction(action.notification);
      });

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
    //console.log('Notification Push reçue:', notification);

    const title = notification.title || 'Nouvelle notification';
    const body = notification.body || 'Vous avez une nouvelle notification';
    const data = notification.data || {};

    // ✅ VÉRIFIER SI C'EST UNE NOTIFICATION DE NOUVEL UTILISATEUR (P2P)
    if (data.type === 'classmate') {
      // Afficher une notification locale (optionnel)
      this.notificationManager.notifyNewMessage(
        title,
        body,
        'p2p_circle',
        data.newUserId || 'system'
      );
      
      // ✅ NE PAS OUVRIR AUTOMATIQUEMENT ICI
      // Laissez l'utilisateur taper sur la notification
      return;
    }

    // Autres types de notifications (messages, défis, etc.)
    if (data.type === 'message') {
      this.notificationManager.notifyNewMessage(
        title, body, data.conversationId || 'system', data.senderId || 'system'
      );
    } else if (data.type === 'challenge') {
      this.notificationManager.notifyChallengeCreated(
        title, data.challengeId || 'unknown', data.userId || 'unknown'
      );
    } else if (data.type == 'content' ){
      this.notificationManager.notifyNewContent('content',data.count );
    }
     else {
      this.notificationManager.notifyNewMessage(title, body, 'system', 'system');
    }
  }

  private async handleNotificationAction(notification: any): Promise<void> {
    console.log('Action sur notification:', notification);

    const data = notification.data || {};
    const deeplink = data.deeplink || data.deepLink || data.link;
    const type = data.type;

    // CAS 1: Deeplink explicite dans la notification
    if (deeplink) {
      console.log('Navigation via deeplink:', deeplink);
      await this.navigateByDeeplink(deeplink);
      return;
    }

    // CAS 2: Notification de nouvel utilisateur P2P (sans deeplink explicite)
    if (type === 'classmate') {
      const newUserId = data.newUserId || data.userId;
      if (newUserId) {
        // Construire le chemin vers la page profil avec le userId
        const profilePath = `/profile/${newUserId}`;
        await this.router.navigateByUrl(profilePath);
      } else {
        console.warn('Notification P2P sans userId, impossible de naviguer');
      }
      return;
    }

    // CAS 3: Challenge ou message (navigation spécifique)
    if (type === 'challenge' && data.challengeId) {
      await this.router.navigateByUrl(`/challenge/${data.challengeId}`);
      return;
    }

    if (type === 'message' && data.conversationId) {
      await this.router.navigateByUrl(`/conversation/${data.conversationId}`);
      return;
    }

    // CAS 4: Fallback - page d'accueil
   // console.log('Aucune action spécifique, navigation vers home');
    await this.router.navigateByUrl('/home');
  }

  /**
   * ✅ NOUVELLE MÉTHODE : Navigation générique par deeplink
   * Supporte différents formats: /profile/123, starinuniform://profile/123, etc.
   */
  private async navigateByDeeplink(deeplink: string): Promise<void> {
    let path = deeplink;

    // Nettoyer le deeplink s'il est au format custom scheme
    if (path.startsWith('starinuniform://')) {
      path = path.replace('starinuniform://', '/');
    }
    
    // Enlever d'éventuels préfixes http:// ou https:// (cas de fallback)
    if (path.startsWith('http://') || path.startsWith('https://')) {
      const url = new URL(path);
      path = url.pathname + url.search;
    }

    // Vérifier que le chemin commence par /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }

    try {
      const success = await this.router.navigateByUrl(path);
      if (!success) {
        console.warn(`Échec navigation vers ${path}, fallback home`);
        //await this.router.navigateByUrl('/home');
      }
    } catch (error) {
      console.error('Erreur navigation:', error);
      await this.router.navigateByUrl('/home');
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
    if(!this.auth.isAuthenticated()) return;
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
