import { Injectable } from '@angular/core';
import { NotificationService } from './notification';

export interface NotificationPreferences {
  messages: boolean;
  challenges: boolean;
  rewards: boolean;
  levelUps: boolean;
  dailyReminders: boolean;
  quietHours: {
    enabled: boolean;
    start: string; // "22:00"
    end: string;   // "08:00"
  };
  frequency: 'low' | 'medium' | 'high';
}

export interface NotificationTemplate {
  title: string;
  body: string;
  icon?: string;
  color?: string;
  priority?: 'low' | 'medium' | 'high';
}

@Injectable({
  providedIn: 'root',
})
export class NotificationManagerService {
  
  // Templates de notifications prédéfinis
  private readonly NOTIFICATION_TEMPLATES = {
    LEVEL_UP: (level: number): NotificationTemplate => ({
      title: '⭐ Niveau supérieur !',
      body: `Félicitations ! Vous avez atteint le niveau ${level}`,
      icon: 'star',
      color: 'gold',
      priority: 'high'
    }),
    
    NEW_MESSAGE: (sender: string, preview: string): NotificationTemplate => ({
      title: `💬 Message de ${sender}`,
      body: preview.length > 100 ? preview.substring(0, 100) + '...' : preview,
      icon: 'chatbubble',
      color: 'blue',
      priority: 'medium'
    }),
    
    CHALLENGE_CREATED: (name: string): NotificationTemplate => ({
      title: '🎯 Défi créé !',
      body: `Votre défi "${name}" a été créé avec succès`,
      icon: 'rocket',
      color: 'orange',
      priority: 'medium'
    }),
    
    CHALLENGE_STARTING: (name: string, timeLeft: string): NotificationTemplate => ({
      title: '🚀 Défi imminent !',
      body: `Le défi "${name}" commence ${timeLeft}`,
      icon: 'time',
      color: 'orange',
      priority: 'medium'
    }),
    
    CHALLENGE_ENDING: (name: string): NotificationTemplate => ({
      title: '⏰ Défi bientôt terminé !',
      body: `Le défi "${name}" se termine demain`,
      icon: 'warning',
      color: 'red',
      priority: 'high'
    }),
    
    REWARD_COLLECTED: (level: number): NotificationTemplate => ({
      title: '🎉 Récompense collectée !',
      body: `Félicitations ! Vous avez récupéré votre récompense de niveau ${level}`,
      icon: 'gift',
      color: 'green',
      priority: 'medium'
    }),
    
    REWARD_AVAILABLE: (level: number): NotificationTemplate => ({
      title: '🎁 Récompense disponible !',
      body: `Une récompense de niveau ${level} vous attend`,
      icon: 'gift',
      color: 'purple',
      priority: 'low'
    }),
    
    WELCOME: (): NotificationTemplate => ({
      title: '🎉 Bienvenue sur Best Academy !',
      body: 'Votre compte a été créé avec succès. Bienvenue dans notre communauté !',
      icon: 'happy',
      color: 'green',
      priority: 'high'
    }),
    
    TRIAL_ENDING: (daysLeft: number): NotificationTemplate => ({
      title: '⏰ Essai bientôt terminé',
      body: `Votre essai gratuit se termine dans ${daysLeft} jour(s). Pensez à vous abonner !`,
      icon: 'alert',
      color: 'orange',
      priority: 'high'
    }),
    
    NEW_CONTENT: (contentType: string, count: number): NotificationTemplate => ({
      title: `📱 Nouveaux ${contentType}`,
      body: `${count} nouveau(x) ${contentType} vous attendent`,
      icon: 'apps',
      color: 'blue',
      priority: 'low'
    }),
    
    DAILY_REMINDER: (): NotificationTemplate => ({
      title: '🔥 Continuez votre progression !',
      body: 'Venez découvrir les nouveautés et compléter vos défis quotidiens',
      icon: 'flame',
      color: 'purple',
      priority: 'low'
    })
  };

  // Préférences par défaut
  private defaultPreferences: NotificationPreferences = {
    messages: true,
    challenges: true,
    rewards: true,
    levelUps: true,
    dailyReminders: false,
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00'
    },
    frequency: 'medium'
  };

  constructor(private notificationService: NotificationService) {
    this.loadUserPreferences();
  }

  private userPreferences: NotificationPreferences = { ...this.defaultPreferences };

  // ── GESTION DES PRÉFÉRENCES ───────────────────────────────────

  /**
   * Charge les préférences de notification de l'utilisateur
   */
  private loadUserPreferences(): void {
    const stored = localStorage.getItem('notification_preferences');
    if (stored) {
      try {
        this.userPreferences = { ...this.defaultPreferences, ...JSON.parse(stored) };
      } catch (error) {
        console.warn('Erreur lors du chargement des préférences de notification:', error);
        this.userPreferences = { ...this.defaultPreferences };
      }
    }
  }

  /**
   * Sauvegarde les préférences de notification de l'utilisateur
   */
  saveUserPreferences(preferences: Partial<NotificationPreferences>): void {
    this.userPreferences = { ...this.userPreferences, ...preferences };
    localStorage.setItem('notification_preferences', JSON.stringify(this.userPreferences));
  }

  /**
   * Récupère les préférences actuelles de l'utilisateur
   */
  getUserPreferences(): NotificationPreferences {
    return { ...this.userPreferences };
  }

  // ── VÉRIFICATION DES CONDITIONS ───────────────────────────────────

  /**
   * Vérifie si les notifications sont autorisées selon les préférences
   */
  private canSendNotification(type: keyof NotificationPreferences): boolean {
    // Vérifier si le type de notification est activé
    if (!this.userPreferences[type]) {
      return false;
    }

    // Vérifier les heures silencieuses
    if (this.userPreferences.quietHours.enabled) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const { start, end } = this.userPreferences.quietHours;
      
      if (this.isTimeInRange(currentTime, start, end)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Vérifie si une heure est dans une plage horaire
   */
  private isTimeInRange(current: string, start: string, end: string): boolean {
    const currentMinutes = this.timeToMinutes(current);
    const startMinutes = this.timeToMinutes(start);
    const endMinutes = this.timeToMinutes(end);

    if (startMinutes <= endMinutes) {
      // Plage normale (ex: 22:00 à 08:00)
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      // Plage qui traverse minuit (ex: 22:00 à 08:00)
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  }

  /**
   * Convertit une heure HH:MM en minutes
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // ── MÉTHODES DE NOTIFICATION ───────────────────────────────────────

  /**
   * Notification de niveau atteint
   */
  async notifyLevelUp(level: number, userId?: string): Promise<boolean> {
    if (!this.canSendNotification('levelUps')) return false;

    const template = this.NOTIFICATION_TEMPLATES.LEVEL_UP(level);
    return await this.notificationService.scheduleImmediateNotification(
      this.notificationService.generateUniqueId(),
      template.title,
      template.body,
      { 
        type: 'level_up', 
        level, 
        userId,
        priority: template.priority 
      }
    );
  }

  /**
   * Notification de nouveau message
   */
  async notifyNewMessage(sender: string, preview: string, conversationId: string, senderId: string): Promise<boolean> {
    if (!this.canSendNotification('messages')) return false;

    const template = this.NOTIFICATION_TEMPLATES.NEW_MESSAGE(sender, preview);
    return await this.notificationService.scheduleImmediateNotification(
      this.notificationService.generateUniqueId(),
      template.title,
      template.body,
      { 
        type: 'new_message', 
        conversationId, 
        senderId,
        priority: template.priority 
      }
    );
  }

  /**
   * Notification de création de défi
   */
  async notifyChallengeCreated(challengeName: string, challengeId: string, creatorId: string): Promise<boolean> {
    if (!this.canSendNotification('challenges')) return false;

    const template = this.NOTIFICATION_TEMPLATES.CHALLENGE_CREATED(challengeName);
    return await this.notificationService.scheduleImmediateNotification(
      this.notificationService.generateUniqueId(),
      template.title,
      template.body,
      { 
        type: 'challenge_created', 
        challengeId, 
        creatorId,
        priority: template.priority 
      }
    );
  }

  /**
   * Notification de début imminent de défi
   */
  async notifyChallengeStarting(challengeName: string, challengeId: string, startTime: Date): Promise<boolean> {
    if (!this.canSendNotification('challenges')) return false;

    const timeLeft = this.getTimeLeft(startTime);
    const template = this.NOTIFICATION_TEMPLATES.CHALLENGE_STARTING(challengeName, timeLeft);
    
    return await this.notificationService.scheduleNotification({
      id: this.notificationService.generateUniqueId(),
      title: template.title,
      body: template.body,
      scheduled: true,
      schedule: { at: startTime },
      extra: { 
        type: 'challenge_starting', 
        challengeId,
        priority: template.priority 
      }
    });
  }

  /**
   * Notification de fin de défi imminente
   */
  async notifyChallengeEnding(challengeName: string, challengeId: string, endTime: Date): Promise<boolean> {
    if (!this.canSendNotification('challenges')) return false;

    const template = this.NOTIFICATION_TEMPLATES.CHALLENGE_ENDING(challengeName);
    
    return await this.notificationService.scheduleNotification({
      id: this.notificationService.generateUniqueId(),
      title: template.title,
      body: template.body,
      scheduled: true,
      schedule: { at: new Date(endTime.getTime() - 24 * 60 * 60 * 1000) }, // 24h avant
      extra: { 
        type: 'challenge_ending', 
        challengeId,
        priority: template.priority 
      }
    });
  }

  /**
   * Notification de récompense collectée
   */
  async notifyRewardCollected(level: number, userId?: string): Promise<boolean> {
    if (!this.canSendNotification('rewards')) return false;

    const template = this.NOTIFICATION_TEMPLATES.REWARD_COLLECTED(level);
    return await this.notificationService.scheduleImmediateNotification(
      this.notificationService.generateUniqueId(),
      template.title,
      template.body,
      { 
        type: 'reward_collected', 
        level, 
        userId,
        priority: template.priority 
      }
    );
  }

  /**
   * Notification de récompense disponible
   */
  async notifyRewardAvailable(level: number, userId?: string): Promise<boolean> {
    if (!this.canSendNotification('rewards')) return false;

    const template = this.NOTIFICATION_TEMPLATES.REWARD_AVAILABLE(level);
    return await this.notificationService.scheduleImmediateNotification(
      this.notificationService.generateUniqueId(),
      template.title,
      template.body,
      { 
        type: 'reward_available', 
        level, 
        userId,
        priority: template.priority 
      }
    );
  }

  /**
   * Notification de bienvenue
   */
  async notifyWelcome(userId: string): Promise<boolean> {
    const template = this.NOTIFICATION_TEMPLATES.WELCOME();
    return await this.notificationService.scheduleImmediateNotification(
      this.notificationService.generateUniqueId(),
      template.title,
      template.body,
      { 
        type: 'welcome', 
        userId,
        priority: template.priority 
      }
    );
  }

  /**
   * Notification de fin d'essai
   */
  async notifyTrialEnding(daysLeft: number, userId: string): Promise<boolean> {
    const template = this.NOTIFICATION_TEMPLATES.TRIAL_ENDING(daysLeft);
    return await this.notificationService.scheduleImmediateNotification(
      this.notificationService.generateUniqueId(),
      template.title,
      template.body,
      { 
        type: 'trial_ending', 
        daysLeft, 
        userId,
        priority: template.priority 
      }
    );
  }

  /**
   * Notification de nouveau contenu
   */
  async notifyNewContent(contentType: string, count: number): Promise<boolean> {
    if (!this.canSendNotification('dailyReminders')) return false;

    const template = this.NOTIFICATION_TEMPLATES.NEW_CONTENT(contentType, count);
    return await this.notificationService.scheduleImmediateNotification(
      this.notificationService.generateUniqueId(),
      template.title,
      template.body,
      { 
        type: 'new_content', 
        contentType, 
        count,
        priority: template.priority 
      }
    );
  }

  /**
   * Configuration des rappels quotidiens
   */
  async setupDailyReminders(hour: number = 9, minute: number = 0): Promise<boolean> {
    if (!this.canSendNotification('dailyReminders')) return false;

    const template = this.NOTIFICATION_TEMPLATES.DAILY_REMINDER();
    return await this.notificationService.scheduleDailyReminder(
      this.notificationService.generateUniqueId(),
      template.title,
      template.body,
      hour,
      minute,
      { 
        type: 'daily_reminder',
        priority: template.priority 
      }
    );
  }

  // ── UTILITAIRES ───────────────────────────────────────────────────────

  /**
   * Formate le temps restant en texte lisible
   */
  private getTimeLeft(date: Date): string {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    
    if (diff < 0) return 'maintenant';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `dans ${days} jour(s)`;
    } else if (hours > 0) {
      return `dans ${hours} heure(s)${minutes > 0 ? ` et ${minutes} minute(s)` : ''}`;
    } else {
      return `dans ${minutes} minute(s)`;
    }
  }

  /**
   * Annule toutes les notifications d'un type spécifique
   */
  async cancelNotificationsByType(type: string): Promise<void> {
    const pending = await this.notificationService.getPendingNotifications();
    const notificationsToCancel = pending.filter(n => n.extra?.type === type);
    
    for (const notification of notificationsToCancel) {
      await this.notificationService.cancelNotification(notification.id);
    }
  }

  /**
   * Récupère les statistiques de notification
   */
  async getNotificationStats(): Promise<{ [key: string]: number }> {
    const pending = await this.notificationService.getPendingNotifications();
    const stats: { [key: string]: number } = {};
    
    pending.forEach(notification => {
      const type = notification.extra?.type || 'unknown';
      stats[type] = (stats[type] || 0) + 1;
    });
    
    return stats;
  }

  /**
   * Test les permissions de notification
   */
  async checkAndRequestPermissions(): Promise<boolean> {
    return await this.notificationService.checkPermissions();
  }
}
