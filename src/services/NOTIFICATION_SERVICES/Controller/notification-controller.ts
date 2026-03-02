import { Injectable } from '@angular/core';
import { Notification } from 'src/models/Notification';

@Injectable({
  providedIn: 'root',
})
export class NotificationController {
  notification!:Notification;

  notifyChallengeCreator(challengeCreator: string, postId: string): Omit<Notification, 'id' | 'createdAt'> {
      const notification: Omit<Notification, 'id'> = {
            title: 'Participation au défi',
            message: 'Nouvelle demande de participation a votre défi en cours',
            category: 'interaction',
            priority: 'medium',
            status: 'unread',
            recipients: {
              type: 'challenge',
              userIds: [challengeCreator]
            },
            action: {
              type: 'response',
              label: 'Aprouvé le candidat',
              meta: { postId, reason: 'acceptation' }
            },
            effects: {
              sound: 'default',
              vibration: true,
              badge: true
            },
            createdAt: new Date(Date.now())
          };
          
          return notification;
  }
 
   notifyChallengerForGift(challengerId: string, postId: string, gift:any): Omit<Notification, 'id' | 'createdAt'> {
      const notification: Omit<Notification, 'id'> = {
            title: 'Nouveau cadeau',
            message: `Vous avez récu un ${gift.name}  pour l\'un de vos contenus`,
            category: 'interaction',
            priority: 'high',
            status: 'unread',
            recipients: {
              type: 'gift',
              userIds: [challengerId]
            },
            action: {
              type: 'response',
              label: 'Reclamer',
              meta: { postId, reason: gift.id , giftPrice: gift.price }
            },
            effects: {
              sound: 'default',
              vibration: true,
              badge: true
            },
                createdAt: new Date(Date.now())
          };
          
          return notification;
  }
}
