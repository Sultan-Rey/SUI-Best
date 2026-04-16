import { Injectable } from '@angular/core';
import { MessageService } from './message-service';
import { Message } from 'src/models/Conversation';
import { Auth } from '../AUTH/auth';
import { firstValueFrom } from 'rxjs';
@Injectable({
  providedIn: 'root',
})
export class SystemMessenger {
  constructor(private messageService: MessageService, private auth:Auth){
  }

  sendParticipationRequired_msg(details:string, participantId: string, participantName: string){
    this.messageService.createConversation({
        participantIds: ['system', participantId],
        messages:       [],
        status:         'closed',
      }).subscribe({
        next: created => {
        const systemMSG =  this.makeSystemMSG(created.id, participantId, participantName, details)
        this.sendSystemMSG(systemMSG);
      },
        error: () => console.log("Message system not sent")
      });
    
  }


async sendNoticeOfReport(details: string): Promise<boolean> {
  try {
    // 1. Récupérer l'UID de l'admin
    const admin_uid = await firstValueFrom(this.auth.getAdminUID());
    
    if (!admin_uid) {
      console.warn('Signalement : UID Admin non trouvé');
      return false;
    }

    // 2. Trouver ou créer la conversation avec le système
    const existing_convId = await firstValueFrom(
      this.messageService.findExistingConversationId('system', admin_uid)
    );

    if (existing_convId) {
      // 3. Récupérer la conversation actuelle
      const conv = await firstValueFrom(this.messageService.getConversation(existing_convId));
      
      if (conv) {
        // 4. Créer et ajouter le message de signalement
        const message = this.makeSystemMSG(conv.id, admin_uid, "admin", details);
        conv.messages.push(message);

        // 5. Mettre à jour (on attend que ce soit fait avant de confirmer le true)
        await firstValueFrom(this.messageService.updateConversation(conv));
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Erreur lors de l\'envoi du signalement à l\'admin:', error);
    return false;
  }
}

  private makeSystemMSG(conversation_id: string, receiver: string, receiverName: string, message:string): Message{
     const systemMSG:Message = {
      id:             `system-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      conversationId: conversation_id,
      senderId:       'system',
      receiverId:     receiver,
      content:        message,
      type:           'system',
      systemData:     { participantName: receiverName, action: 'requirement' },
      status:         'sent',
      createdAt:      new Date(),
    }
    return systemMSG;
  }

  private sendSystemMSG(systemMSG: Message){
    this.messageService.sendMessage(systemMSG.conversationId as string, systemMSG).subscribe({
      next: () => console.log("Message system sent"),
      error: () => console.log("Message system not sent")
    });
  }
  
}
