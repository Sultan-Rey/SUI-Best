import { Injectable } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Platform } from '@ionic/angular';

export interface NotificationSchedule {
  id: number;
  title: string;
  body: string;
  scheduled?: boolean;
  schedule?: {
    at?: Date;
    repeats?: boolean;
    every?: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
  };
  sound?: string;
  attachments?: any[];
  actionTypeId?: string;
  extra?: any;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private isAvailable = false;

  constructor(private platform: Platform) {
    this.initializeNotifications();
  }

  private async initializeNotifications(): Promise<void> {
    try {
      if (this.platform.is('capacitor')) {
        const result = await LocalNotifications.requestPermissions();
        this.isAvailable = result.display === 'granted';

        if (this.isAvailable) {
          await LocalNotifications.registerActionTypes({
            types: [
              {
                id: 'default',
                actions: [
                  {
                    id: 'view',
                    title: 'Voir',
                    requiresAuthentication: false,
                  },
                  {
                    id: 'dismiss',
                    title: 'Ignorer',
                    requiresAuthentication: false,
                  },
                ],
              },
            ],
          });

          LocalNotifications.addListener(
            'localNotificationReceived',
            (notification) => {
              console.log('Notification reçue:', notification);
            }
          );

          LocalNotifications.addListener(
            'localNotificationActionPerformed',
            (action) => {
              console.log('Action de notification:', action);
            }
          );
        }
      } else {
        console.warn('Les notifications locales ne sont disponibles que sur les appareils natifs');
      }
    } catch (error) {
      console.error('Erreur lors de l\'initialisation des notifications:', error);
    }
  }

  async checkPermissions(): Promise<boolean> {
    try {
      const result = await LocalNotifications.requestPermissions();
      this.isAvailable = result.display === 'granted';
      return this.isAvailable;
    } catch (error) {
      console.error('Erreur lors de la vérification des permissions:', error);
      return false;
    }
  }

  async scheduleNotification(notification: NotificationSchedule): Promise<boolean> {
    if (!this.isAvailable) {
      console.warn('Les notifications locales ne sont pas disponibles');
      return false;
    }

    try {
      const notifications = [{
        id: notification.id,
        title: notification.title,
        body: notification.body,
        schedule: notification.schedule,
        sound: notification.sound || 'default',
        attachments: notification.attachments || [],
        actionTypeId: notification.actionTypeId || 'default',
        extra: notification.extra || {},
      }];

      await LocalNotifications.schedule({
        notifications: notifications,
      });

      console.log(`Notification ${notification.id} planifiée avec succès`);
      return true;
    } catch (error) {
      console.error('Erreur lors de la planification de la notification:', error);
      return false;
    }
  }

  async scheduleImmediateNotification(
    id: number,
    title: string,
    body: string,
    extra?: any
  ): Promise<boolean> {
    return this.scheduleNotification({
      id,
      title,
      body,
      scheduled: false,
      extra,
    });
  }

  async scheduleDelayedNotification(
    id: number,
    title: string,
    body: string,
    delayInMinutes: number,
    extra?: any
  ): Promise<boolean> {
    const scheduledDate = new Date();
    scheduledDate.setMinutes(scheduledDate.getMinutes() + delayInMinutes);

    return this.scheduleNotification({
      id,
      title,
      body,
      scheduled: true,
      schedule: {
        at: scheduledDate,
      },
      extra,
    });
  }

  async scheduleRecurringNotification(
    id: number,
    title: string,
    body: string,
    interval: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year',
    startDate?: Date,
    extra?: any
  ): Promise<boolean> {
    return this.scheduleNotification({
      id,
      title,
      body,
      scheduled: true,
      schedule: {
        at: startDate || new Date(),
        repeats: true,
        every: interval,
      },
      extra,
    });
  }

  async cancelNotification(notificationId: number): Promise<boolean> {
    if (!this.isAvailable) {
      console.warn('Les notifications locales ne sont pas disponibles');
      return false;
    }

    try {
      await LocalNotifications.cancel({
        notifications: [{ id: notificationId }],
      });
      console.log(`Notification ${notificationId} annulée avec succès`);
      return true;
    } catch (error) {
      console.error('Erreur lors de l\'annulation de la notification:', error);
      return false;
    }
  }

  async cancelAllNotifications(): Promise<boolean> {
    if (!this.isAvailable) {
      console.warn('Les notifications locales ne sont pas disponibles');
      return false;
    }

    try {
      await LocalNotifications.cancel({
        notifications: [],
      });
      console.log('Toutes les notifications ont été annulées');
      return true;
    } catch (error) {
      console.error('Erreur lors de l\'annulation des notifications:', error);
      return false;
    }
  }

  async getPendingNotifications(): Promise<any[]> {
    if (!this.isAvailable) {
      console.warn('Les notifications locales ne sont pas disponibles');
      return [];
    }

    try {
      const result = await LocalNotifications.getPending();
      return result.notifications || [];
    } catch (error) {
      console.error('Erreur lors de la récupération des notifications en attente:', error);
      return [];
    }
  }

  async areNotificationsEnabled(): Promise<boolean> {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const result = await LocalNotifications.checkPermissions();
      return result.display === 'granted';
    } catch (error) {
      console.error('Erreur lors de la vérification du statut des notifications:', error);
      return false;
    }
  }

  async launchNotificationImmediately(
    id: number,
    title: string,
    body: string,
    extra?: any
  ): Promise<boolean> {
    return this.scheduleImmediateNotification(id, title, body, extra);
  }

  generateUniqueId(): number {
    return Date.now() + Math.floor(Math.random() * 1000);
  }

  async scheduleDailyReminder(
    id: number,
    title: string,
    body: string,
    hour: number,
    minute: number,
    extra?: any
  ): Promise<boolean> {
    const now = new Date();
    const scheduledDate = new Date();
    scheduledDate.setHours(hour, minute, 0, 0);

    if (scheduledDate <= now) {
      scheduledDate.setDate(scheduledDate.getDate() + 1);
    }

    return this.scheduleNotification({
      id,
      title,
      body,
      scheduled: true,
      schedule: {
        at: scheduledDate,
        repeats: true,
        every: 'day',
      },
      extra,
    });
  }

  async scheduleWeeklyReminder(
    id: number,
    title: string,
    body: string,
    dayOfWeek: number,
    hour: number,
    minute: number,
    extra?: any
  ): Promise<boolean> {
    const now = new Date();
    const scheduledDate = new Date();
    
    const currentDay = scheduledDate.getDay();
    let daysUntilTarget = dayOfWeek - currentDay;
    
    if (daysUntilTarget <= 0) {
      daysUntilTarget += 7;
    }
    
    scheduledDate.setDate(scheduledDate.getDate() + daysUntilTarget);
    scheduledDate.setHours(hour, minute, 0, 0);

    return this.scheduleNotification({
      id,
      title,
      body,
      scheduled: true,
      schedule: {
        at: scheduledDate,
        repeats: true,
        every: 'week',
      },
      extra,
    });
  }
}
