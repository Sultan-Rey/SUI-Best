import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { Notification } from '../../models/Notification';
import { ApiJSON } from '../API/LOCAL/api-json';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly NOTIFICATION_RESSOURCE = 'notifications';
  private notifications: Notification[] = [];
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);

  constructor(private api: ApiJSON) {
  }

  getNotifications(): Observable<Notification[]> {
    return this.notificationsSubject.asObservable();
  }

  /**
   * Charge les notifications depuis le backend pour un utilisateur spécifique
   * Utilise la méthode filter d'ApiJSON pour récupérer les notifications où l'utilisateur est destinataire
   */
  loadNotificationsForUser(userId: string): Observable<Notification[]> {
    return this.api.filter<Notification>(this.NOTIFICATION_RESSOURCE, {
      'recipients.type': 'user',
      'recipients.userIds': ['like', userId]
    }).pipe(
      tap(notifications => {
        this.notifications = notifications;
        this.notificationsSubject.next(notifications);
      }),
      catchError(error => {
        console.error('[NotificationService] Error loading notifications:', error);
        // En cas d'erreur, initialiser avec un tableau vide
        this.notifications = [];
        this.notificationsSubject.next([]);
        return of([]);
      })
    );
  }

  
  markAsRead(notificationId: string): Observable<Notification> {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (!notification) {
      return of(null as any);
    }

    return this.api.patch<Notification>(this.NOTIFICATION_RESSOURCE, notificationId, { status: 'read' }).pipe(
      tap(updatedNotification => {
        const index = this.notifications.findIndex(n => n.id === notificationId);
        if (index !== -1) {
          this.notifications[index] = updatedNotification;
          this.notificationsSubject.next([...this.notifications]);
        }
      }),
      catchError(error => {
        console.error('[NotificationService] Error marking notification as read:', error);
        // Mise à jour locale en fallback
        notification.status = 'read';
        this.notificationsSubject.next([...this.notifications]);
        return of(notification);
      })
    );
  }

  markAllAsRead(): Observable<Notification[]> {
    const unreadNotifications = this.notifications.filter(n => n.status === 'unread');
    
    if (unreadNotifications.length === 0) {
      return of(this.notifications);
    }

    // Marquer toutes les notifications non lues comme lues via l'API
    const updateRequests = unreadNotifications.map(notification => 
      this.api.patch<Notification>(this.NOTIFICATION_RESSOURCE, notification.id, { status: 'read' })
    );

    // Pour l'instant, on fait une mise à jour locale puis on synchronise
    this.notifications.forEach(n => n.status = 'read');
    this.notificationsSubject.next([...this.notifications]);

    // TODO: Implémenter la synchronisation avec le backend quand l'API supportera les mises à jour en lot
    return of(this.notifications);
  }

  deleteNotification(notificationId: string): Observable<void> {
    return this.api.delete(this.NOTIFICATION_RESSOURCE, notificationId).pipe(
      tap(() => {
        this.notifications = this.notifications.filter(n => n.id !== notificationId);
        this.notificationsSubject.next([...this.notifications]);
      }),
      catchError(error => {
        console.error('[NotificationService] Error deleting notification:', error);
        return of(undefined as void);
      })
    );
  }

  getUnreadCount(): number {
    return this.notifications.filter(n => n.status === 'unread').length;
  }

  /**
   * Récupère les notifications non lues depuis le backend
   */
  getUnreadNotifications(userId: string): Observable<Notification[]> {
    return this.api.filter<Notification>(this.NOTIFICATION_RESSOURCE, {
      'recipients.type': 'user',
      'recipients.userIds': ['like', userId],
      status: 'unread'
    }).pipe(
      catchError(error => {
        console.error('[NotificationService] Error getting unread notifications:', error);
        return of([]);
      })
    );
  }

  getNotificationsByCategory(category: string, userId?: string): Observable<Notification[]> {
    const filters: any = { category };
    
    if (userId) {
      filters['recipients.type'] = 'user';
      filters['recipients.userIds'] = ['like', userId];
    }

    return this.api.filter<Notification>(this.NOTIFICATION_RESSOURCE, filters).pipe(
      catchError(error => {
        console.error('[NotificationService] Error getting notifications by category:', error);
        // Fallback sur les données locales si disponibles
        const localNotifications = userId 
          ? this.notifications.filter(n => n.category === category && n.recipients.userIds.includes(userId))
          : this.notifications.filter(n => n.category === category);
        return of(localNotifications);
      })
    );
  }

  /**
   * Crée une nouvelle notification
   */
  createNotification(notification: Omit<Notification, 'id' | 'createdAt'>): Observable<Notification> {
    const newNotification: Partial<Notification> = {
      ...notification,
      createdAt: new Date(),
      status: 'unread'
    };

    return this.api.create<Notification>(this.NOTIFICATION_RESSOURCE, newNotification).pipe(
      tap(createdNotification => {
        this.notifications.unshift(createdNotification);
        this.notificationsSubject.next([...this.notifications]);
      }),
      catchError(error => {
        console.error('[NotificationService] Error creating notification:', error);
        return of(null as any);
      })
    );
  }

  /**
   * Rafraîchit les notifications depuis le backend
   */
  refreshNotifications(userId: string): Observable<Notification[]> {
    return this.loadNotificationsForUser(userId);
  }
}
