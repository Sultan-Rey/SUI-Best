import { Injectable } from '@angular/core';
import { MessageService } from './message-service';
import { Message } from 'src/models/Conversation';
@Injectable({
  providedIn: 'root',
})
export class SystemMessenger {
  constructor(private messageService: MessageService){

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
