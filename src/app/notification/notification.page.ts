import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonList, IonItem, IonLabel, IonButton, IonIcon, IonBadge, IonRefresher, IonRefresherContent, IonSegment, IonSegmentButton, IonBackButton, IonButtons } from '@ionic/angular/standalone';
import { NotificationService } from '../../services/NOTIFICATION_SERVICE/notification-service';
import { Notification } from '../../models/Notification';
import { addIcons } from 'ionicons';
import {
  checkmarkDoneOutline, closeOutline, notificationsOutline,
  trophyOutline, heartOutline, chatbubbleOutline, shareOutline,
  statsChartOutline, personOutline, alertCircleOutline, starOutline, checkmarkDoneCircle } from 'ionicons/icons';

interface SegmentOption {
  value: string;
  label: string;
}

interface NotificationGroup {
  label: string;
  items: Notification[];
}

@Component({
  selector: 'app-notification',
  templateUrl: './notification.page.html',
  styleUrls: ['./notification.page.scss'],
  standalone: true,
  imports: [ IonBackButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar, IonIcon, IonRefresher, IonRefresherContent, CommonModule]
})
export class NotificationPage implements OnInit {

  notifications: Notification[] = [];
  filteredNotifications: Notification[] = [];
  groupedNotifications: NotificationGroup[] = [];
  selectedSegment = 'all';
  unreadCount = 0;

  segments: SegmentOption[] = [
    { value: 'all',         label: 'Toutes'      },
    { value: 'unread',      label: 'Non lues'    },
    { value: 'engagement',  label: 'Engagement'  },
    { value: 'interaction', label: 'Interactions' },
  ];

  constructor(private notificationService: NotificationService) {
    addIcons({checkmarkDoneCircle,closeOutline,notificationsOutline,checkmarkDoneOutline,trophyOutline,heartOutline,chatbubbleOutline,shareOutline,statsChartOutline,personOutline,alertCircleOutline,starOutline});
  }

  ngOnInit() {
    this.loadNotifications();
  }

  loadNotifications() {
    // TODO: Récupérer l'ID utilisateur actuel (peut venir d'un service d'auth)
    const currentUserId = 'current-user'; // Remplacer par l'ID réel de l'utilisateur
    
    this.notificationService.loadNotificationsForUser(currentUserId).subscribe({
      next: (notifications) => {
        this.notifications = notifications;
        this.unreadCount = this.notificationService.getUnreadCount();
        this.applyFilter();
      },
      error: (error) => {
        console.error('Erreur lors du chargement des notifications:', error);
      }
    });
  }

  onSegmentChange(value: string) {
    this.selectedSegment = value;
    this.applyFilter();
  }

  private applyFilter() {
    const currentUserId = 'current-user'; // Remplacer par l'ID réel de l'utilisateur
    
    switch (this.selectedSegment) {
      case 'unread':
        this.notificationService.getUnreadNotifications(currentUserId).subscribe(notifications => {
          this.filteredNotifications = notifications;
          this.groupedNotifications = this.buildGroups(this.filteredNotifications);
        });
        break;
      case 'engagement':
        this.notificationService.getNotificationsByCategory('engagement', currentUserId).subscribe(notifications => {
          this.filteredNotifications = notifications;
          this.groupedNotifications = this.buildGroups(this.filteredNotifications);
        });
        break;
      case 'interaction':
        this.notificationService.getNotificationsByCategory('interaction', currentUserId).subscribe(notifications => {
          this.filteredNotifications = notifications;
          this.groupedNotifications = this.buildGroups(this.filteredNotifications);
        });
        break;
      default:
        this.filteredNotifications = [...this.notifications];
        this.groupedNotifications = this.buildGroups(this.filteredNotifications);
    }
  }

  private buildGroups(items: Notification[]): NotificationGroup[] {
    const now   = new Date();
    const today = this.startOfDay(now);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(thisWeekStart.getDate() - today.getDay());

    const buckets: Record<string, Notification[]> = {
      "Aujourd'hui": [],
      'Hier':        [],
      'Cette semaine': [],
      'Plus ancien':  [],
    };

    for (const n of items) {
      const d = this.startOfDay(new Date(n.createdAt));
      if (d >= today)         buckets["Aujourd'hui"].push(n);
      else if (d >= yesterday) buckets['Hier'].push(n);
      else if (d >= thisWeekStart) buckets['Cette semaine'].push(n);
      else                    buckets['Plus ancien'].push(n);
    }

    return Object.entries(buckets)
      .filter(([, v]) => v.length > 0)
      .map(([label, items]) => ({ label, items }));
  }

  private startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  markAsRead(notificationId: string) {
    this.notificationService.markAsRead(notificationId).subscribe({
      next: (updatedNotification) => {
        if (updatedNotification) {
          // Mettre à jour localement la notification
          const index = this.notifications.findIndex(n => n.id === notificationId);
          if (index !== -1) {
            this.notifications[index] = updatedNotification;
            this.applyFilter();
          }
        }
      },
      error: (error) => {
        console.error('Erreur lors du marquage comme lu:', error);
        // Recharger les notifications en cas d'erreur
        this.loadNotifications();
      }
    });
  }

  markAllAsRead() {
    this.notificationService.markAllAsRead().subscribe({
      next: (updatedNotifications) => {
        this.notifications = updatedNotifications;
        this.applyFilter();
      },
      error: (error) => {
        console.error('Erreur lors du marquage de toutes comme lues:', error);
        // Recharger les notifications en cas d'erreur
        this.loadNotifications();
      }
    });
  }

  deleteNotification(notificationId: string) {
    this.notificationService.deleteNotification(notificationId).subscribe({
      next: () => {
        // La notification est déjà supprimée du cache local par le service
        this.applyFilter();
      },
      error: (error) => {
        console.error('Erreur lors de la suppression:', error);
        // Recharger les notifications en cas d'erreur
        this.loadNotifications();
      }
    });
  }

  handleRefresh(event: any) {
    const currentUserId = 'current-user'; // Remplacer par l'ID réel de l'utilisateur
    
    this.notificationService.refreshNotifications(currentUserId).subscribe({
      next: (notifications) => {
        this.notifications = notifications;
        this.unreadCount = this.notificationService.getUnreadCount();
        this.applyFilter();
        event.target.complete();
      },
      error: (error) => {
        console.error('Erreur lors du rafraîchissement:', error);
        event.target.complete();
      }
    });
  }

  getIconForCategory(category: string): string {
    const map: Record<string, string> = {
      engagement:  'trophy-outline',
      interaction: 'heart-outline',
      alert:       'alert-circle-outline',
      share:       'share-outline',
      stats:       'stats-chart-outline',
      person:      'person-outline',
    };
    return map[category] ?? 'notifications-outline';
  }

  /**
   * Returns one of: 'gold' | 'red' | 'blue' | 'green'
   * Used by [ngClass]="'icon-' + getIconColor(...)" in the template.
   */
  getIconColor(priority: string, category: string): string {
    if (priority === 'high')   return 'red';
    if (category === 'engagement') return 'gold';
    if (category === 'interaction') return 'blue';
    if (priority === 'low')    return 'green';
    return 'gold';
  }

  /**
   * Returns CSS class suffix for the unread dot color.
   */
  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'high':   return 'red';
      case 'medium': return 'blue';
      case 'low':    return 'green';
      default:       return 'gold';
    }
  }

  formatRelativeTime(date: Date): string {
    const diff    = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60_000);
    const hours   = Math.floor(diff / 3_600_000);
    const days    = Math.floor(diff / 86_400_000);

    if (minutes < 1)  return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes} minute${minutes > 1 ? 's' : ''}`;
    if (hours   < 24) return `Il y a ${hours} heure${hours > 1 ? 's' : ''}`;
    return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
  }
}