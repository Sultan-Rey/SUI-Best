import {
  Component, Input, OnInit, OnDestroy,
  ViewChild, ChangeDetectorRef
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonicModule, ModalController, IonContent, IonTextarea,
  ActionSheetController, AlertController
} from '@ionic/angular';
import { Subscription } from 'rxjs';
import { MessageService, StreamEvent, PresenceData } from '../../../services/Service_message/message-service';
import { DmTimePipe } from '../../utils/pipes/dmPipe/dmtime-pipe';
import { MediaUrlPipe } from '../../utils/pipes/mediaUrlPipe/media-url-pipe';
import { Conversation, Message, MessageStatus, ConversationUtils } from '../../../models/Conversation';

import { addIcons } from 'ionicons';
import {
  chevronBack, send, mic, image, happy, attach,
  call, videocamOutline, ellipsisVertical,
  checkmark, checkmarkDone, timeOutline, play, alertCircleOutline, checkmarkCircle
} from 'ionicons/icons';

@Component({
  selector: 'app-modal-conversation',
  templateUrl: './modal-conversation.component.html',
  styleUrls: ['./modal-conversation.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, DmTimePipe, DatePipe, MediaUrlPipe]
})
export class ModalConversationComponent implements OnInit, OnDestroy {

  @Input() currentUserId!: string;
  @Input() otherUser!: { receiverId: string; username: string; avatar: string; isVerified: boolean };
  @Input() conversationId!: string;

  // ─── Données ──────────────────────────────────────────────────
  conversation?: Conversation;
  messages: Message[] = [];
  newMessage = '';
  otherUserIsOnline = false;
  hasDeleted = false;
  onlineUsers: PresenceData[] = [];

  // ─── UI ───────────────────────────────────────────────────────
  isLoading = false;
  showScrollToBottom = false;
  isRecording = false;
  recordingDuration = 0;

  // ─── État interne ─────────────────────────────────────────────
  private isTyping = false;
  private typingTimer: ReturnType<typeof setTimeout> | null = null;
  private presencePingInterval: ReturnType<typeof setInterval> | null = null;
  private recordingInterval: ReturnType<typeof setInterval> | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private lastMessageSince?: string;
  private readonly MAX_VOICE_DURATION = 30;
  private subscriptions: Subscription[] = [];

  @ViewChild(IonContent) content!: IonContent;
  @ViewChild('messageInput') messageInput!: IonTextarea;
  @ViewChild('imageInput') imageInput!: any;

  constructor(
    private messageService: MessageService,
    private modalController: ModalController,
    private actionSheetController: ActionSheetController,
    private alertController: AlertController,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({
      chevronBack, send, mic, image, happy, attach,
      call, videocamOutline, ellipsisVertical,
      checkmark, checkmarkCircle, checkmarkDone, timeOutline, play, alertCircleOutline
    });
  }

  ngOnInit() {
    if (!this.currentUserId || !this.conversationId) return;
    this.loadConversation();
    this.startSSE();
    this.startPresencePing();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
    this.messageService.leavePresence(this.conversationId);
    if (this.presencePingInterval) clearInterval(this.presencePingInterval);
    if (this.typingTimer)          clearTimeout(this.typingTimer);
    if (this.isRecording)          this.stopVoiceRecording();
    if (this.mediaRecorder?.state !== 'inactive') {
      this.mediaRecorder?.stream.getTracks().forEach(t => t.stop());
    }
  }

  // ==============================================================
  //  CHARGEMENT
  // ==============================================================

  private loadConversation(): void {
    this.isLoading = true;

    this.subscriptions.push(
      this.messageService.conversations$.subscribe(conversations => {
        const conv = conversations.find(c => c.id === this.conversationId);
        if (conv) {
          // Vérifier si otherUser.receiverId est dans deletedFor
          this.hasDeleted = conv.deletedFor?.includes(this.otherUser.receiverId) || false;
          
          this.conversation = conv;
          this.messages     = [...(conv.messages ?? [])];
          this.isLoading    = false;
          this.cdr.markForCheck();
          this.scrollToBottomDeferred();
        }
      })
    );

    // Charger les messages paginés si la conversation n'est pas encore dans le store
this.subscriptions.push(
  this.messageService.getMessages(this.conversationId).subscribe(msgs => {
    if (msgs.length > 0) {
      // Filtrer les messages qui n'ont PAS été supprimés pour l'utilisateur courant
      const filteredMessages = msgs.filter(msg => 
        !msg.deletedFor || !msg.deletedFor.includes(this.currentUserId)
      );
      
      this.messages = filteredMessages;
      // Utiliser le dernier message NON supprimé pour lastMessageSince
      if (filteredMessages.length > 0) {
        this.lastMessageSince = filteredMessages[filteredMessages.length - 1].createdAt?.toString();
      }
      this.isLoading = false;
      this.cdr.markForCheck();
      this.scrollToBottomDeferred();
    }
  })
);

  }

  // ==============================================================
  //  SSE
  // ==============================================================

  private startSSE(): void {
    this.subscriptions.push(
      this.messageService.connectToRealTime(this.conversationId, this.lastMessageSince).subscribe({
        next: (event: StreamEvent) => {
          switch (event.event) {
            case 'message':
              this.handleIncomingMessage(event.data as Message);
              break;
            case 'presence':
              this.handlePresenceUpdate(event.data.online ?? []);
              break;
          }
        }
      })
    );
  }

  private handleIncomingMessage(msg: Message): void {
    // Ignorer les messages qu'on vient d'envoyer (déjà en UI via optimistic)
    if (msg.senderId === this.currentUserId) return;
    if (this.messages.some(m => m.id === msg.id)) return;

    this.messages = [...this.messages, msg];
    this.lastMessageSince = msg.createdAt?.toString();
    this.cdr.markForCheck();
    this.scrollToBottomDeferred();

    // Marquer comme lu
    this.messageService.markMessageAsRead(this.conversationId, msg.id).subscribe();
  }

  private handlePresenceUpdate(online: PresenceData[]): void {
    this.onlineUsers      = online;
    this.otherUserIsOnline = online.some(u => u.user_id === this.otherUser.receiverId);
    this.cdr.markForCheck();
  }

  // ==============================================================
  //  PRÉSENCE PING
  // ==============================================================

  private startPresencePing(): void {
    // Ping immédiat puis toutes les 30s
    this.pingPresence();
    this.presencePingInterval = setInterval(() => this.pingPresence(), 30_000);
  }

  private pingPresence(): void {
    this.subscriptions.push(
      this.messageService.pingPresence(this.conversationId).subscribe({
        next: online => this.handlePresenceUpdate(online)
      })
    );
  }

  // ==============================================================
  //  ENVOI DE MESSAGES
  // ==============================================================

  sendMessage(): void {
    const content = this.newMessage.trim();
    if (!content || !this.currentUserId || !this.otherUser.receiverId) return;

    this.stopTyping();

    // Message optimiste (affiché immédiatement)
    const optimistic: Message = {
      id:             `temp-${Date.now()}`,
      conversationId: this.conversationId,
      senderId:       this.currentUserId,
      receiverId:     this.otherUser.receiverId,
      content,
      status:         'pending',
      createdAt:      new Date(),
    };

    this.messages = [...this.messages, optimistic];
    this.newMessage = '';
    this.scrollToBottomDeferred();

    if (!this.conversation) {
      // Première conversation — créer puis envoyer
      this.messageService.createConversation({
        participantIds: [this.currentUserId, this.otherUser.receiverId],
        messages:       [],
        status:         'closed',
      }).subscribe({
        next: created => {
          this.conversation   = created;
          this.conversationId = created.id as string;
          this.sendToBackend(optimistic);
        },
        error: () => this.setMessageStatus(optimistic.id, 'pending')
      });
    } else {
      this.sendToBackend(optimistic);
    }
  }

  private sendToBackend(optimistic: Message): void {
    // Si hasDeleted est true, réhabiliter d'abord l'utilisateur
    if (this.hasDeleted) {
      this.messageService.rehabilitateUserInConversation(this.conversationId, [this.otherUser.receiverId]).subscribe({
        next: () => {
          // Une fois réhabilité, envoyer le message
          this.hasDeleted = false; // Mettre à jour l'état
          this.doSendMessage(optimistic);
        },
        error: () => {
          // En cas d'erreur de réhabilitation, essayer quand même d'envoyer
          //this.doSendMessage(optimistic);
        }
      });
    } else {
      // Si pas de réhabilitation nécessaire, envoyer directement
      this.doSendMessage(optimistic);
    }
  }

  private doSendMessage(optimistic: Message): void {
    const payload = {
      senderId:   optimistic.senderId,
      receiverId: optimistic.receiverId,
      content:    optimistic.content,
      type:       'user' as const,
    };

    this.messageService.sendMessage(this.conversationId, payload).subscribe({
      next: sent => this.replaceOptimisticMessage(optimistic.id, sent),
      error: ()  => this.setMessageStatus(optimistic.id, 'pending')
    });
  }

  private replaceOptimisticMessage(tempId: string, real: Message): void {
    this.messages = this.messages.map(m => m.id === tempId ? real : m);
    this.cdr.markForCheck();
  }

  private setMessageStatus(messageId: string, status: MessageStatus): void {
    this.messages = this.messages.map(m =>
      m.id === messageId ? { ...m, status } : m
    );
    this.cdr.markForCheck();
  }

  // ==============================================================
  //  FRAPPE (TYPING)
  // ==============================================================

  onMessageInput(event: any): void {
    const value = (event.target.value ?? '').trim();

    if (value.length > 0 && !this.isTyping) {
      this.isTyping = true;
    }

    if (this.typingTimer) clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => {
      this.isTyping = false;
    }, 1500);
  }

  private stopTyping(): void {
    this.isTyping = false;
    if (this.typingTimer) { clearTimeout(this.typingTimer); this.typingTimer = null; }
  }

  // ==============================================================
  //  UPLOAD MEDIA
  // ==============================================================

  sendImage(): void {
    const file = this.imageInput?.nativeElement?.files?.[0];
    if (!file) return;

    this.messageService.uploadFile(file, this.conversationId).subscribe({
      next: result => {
        this.newMessage = result.path;
        this.sendMessage();
      },
      error: () => this.addErrorMessage('❌ Erreur lors de l\'envoi de l\'image')
    });

    this.imageInput.nativeElement.value = '';
  }

  async startVoiceRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks   = [];

      this.mediaRecorder.ondataavailable = e => { if (e.data.size > 0) this.audioChunks.push(e.data); };
      this.mediaRecorder.onstop          = () => this.handleVoiceComplete();

      this.mediaRecorder.start();
      this.isRecording       = true;
      this.recordingDuration = 0;

      this.recordingInterval = setInterval(() => {
        this.recordingDuration++;
        this.cdr.markForCheck();
        if (this.recordingDuration >= this.MAX_VOICE_DURATION) this.stopVoiceRecording();
      }, 1000);

    } catch {
      this.addErrorMessage('❌ Impossible d\'accéder au microphone');
    }
  }

  stopVoiceRecording(): void {
    if (this.recordingInterval) { clearInterval(this.recordingInterval); this.recordingInterval = null; }
    if (this.mediaRecorder?.state !== 'inactive') {
      this.mediaRecorder?.stop();
      this.mediaRecorder?.stream.getTracks().forEach(t => t.stop());
    }
    this.isRecording       = false;
    this.recordingDuration = 0;
    this.cdr.markForCheck();
  }

  private handleVoiceComplete(): void {
    const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
    const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });

    this.messageService.uploadFile(file, this.conversationId).subscribe({
      next: result => { this.newMessage = result.path; this.sendMessage(); },
      error: ()     => this.addErrorMessage('❌ Erreur lors de l\'envoi du message vocal')
    });
  }

  private addErrorMessage(content: string): void {
    this.messages = [...this.messages, {
      id:             `err-${Date.now()}`,
      conversationId: this.conversationId,
      senderId:       this.currentUserId,
      receiverId:     this.otherUser.receiverId,
      content,
      status:         'pending',
      createdAt:      new Date(),
    }];
    this.cdr.markForCheck();
  }

  // ==============================================================
  //  OPTIONS
  // ==============================================================

  async joinGroup() {
    if (!this.conversation?.groupData || !this.currentUserId) return;

    try {
      this.isLoading = true;
      
      // Ajouter le currentUserId aux participants du groupe
      this.messageService.addParticipant(this.conversation.id, this.currentUserId).subscribe({
        next: (updatedConversation) => {
          console.log('Utilisateur ajouté au groupe avec succès');
          
          // Mettre à jour la conversation locale
          this.conversation = updatedConversation;
          this.cdr.markForCheck();
          
          // Fermer le modal après succès
          this.dismiss();
        },
        error: (error) => {
          console.error('[ModalConversation] Error joining group:', error);
          // TODO: Afficher une erreur à l'utilisateur
        },
        complete: () => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
      
    } catch (error) {
      console.error('[ModalConversation] Error joining group:', error);
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }
  
  async presentMoreOptions(): Promise<void> {
    if (!this.conversation) return;
    const isGroup = !!this.conversation.groupData;
    const isAdmin = this.conversation.groupData?.admins?.includes(this.currentUserId) ?? false;

    const buttons: any[] = isGroup ? [
      { text: 'Voir les membres',   icon: 'people-outline',   handler: () => this.viewGroupMembers() },
      { text: 'Copier le lien',     icon: 'link-outline',     handler: () => this.copyGroupLink() },
      ...(isAdmin ? [{ text: 'Effacer les messages', icon: 'trash-outline', handler: () => this.clearGroupMessages() }] : []),
      { text: 'Quitter le groupe',  icon: 'exit-outline',     handler: () => this.leaveGroup() },
    ] : [
      { text: 'Effacer pour moi',         icon: 'eye-off-outline', handler: () => this.clearMessagesForMe() },
      { text: 'Supprimer la conversation',icon: 'trash-outline',   handler: () => this.deleteConversation() },
    ];

    const sheet = await this.actionSheetController.create({
      header: isGroup ? 'Options du groupe' : 'Options de la conversation',
      buttons
    });
    await sheet.present();
  }

  async viewGroupMembers():  Promise<void> { /* TODO */ }
  async copyGroupLink():     Promise<void> {
    await navigator.clipboard.writeText(`${window.location.origin}/group/${this.conversationId}`);
  }

  async clearGroupMessages(): Promise<void> {
    if (!this.conversation) return;
    const alert = await this.buildConfirmAlert(
      'Effacer les messages',
      'Êtes-vous sûr de vouloir effacer tous les messages ? Cette action est irréversible.',
      async () => {
        if (!this.conversation) return;
        await this.messageService.updateConversation({
          ...this.conversation, messages: [], unreadCount: 0,
          lastMessage: undefined, lastMessageTime: undefined
        }).toPromise();
        this.messages = [];
        this.cdr.detectChanges();
      }
    );
    await alert.present();
  }

  async leaveGroup(): Promise<void> {
    const alert = await this.buildConfirmAlert(
      'Quitter le groupe',
      'Êtes-vous sûr de vouloir quitter ce groupe ?',
      () => {
        this.messageService.removeParticipant(this.conversationId, this.currentUserId)
          .subscribe(() => this.dismiss());
      }
    );
    await alert.present();
  }

  async clearMessagesForMe(): Promise<void> {
    if (!this.conversation) return;
    const alert = await this.buildConfirmAlert(
      'Effacer mes messages',
      'Êtes-vous sûr de vouloir effacer vos messages dans cette conversation ?',
      async () => this.deleteFromMessages()
    );
    await alert.present();
  }

  async deleteFromMessages() {
    if (!this.conversation) return;
        const updated = {
          ...this.conversation,
          messages: this.conversation.messages.map(m =>
            m.senderId === this.currentUserId
              ? { ...m, deletedFor: [...(m.deletedFor ?? []), this.currentUserId] }
              : m
          )
        };
        await this.messageService.updateConversation(updated).toPromise();
        this.messages = updated.messages;
        this.cdr.detectChanges();
  }
  async deleteConversation(): Promise<void> {
    const alert = await this.buildConfirmAlert(
      'Supprimer la conversation',
      'Êtes-vous sûr de vouloir supprimer cette conversation ?',
      async () => {
        if (!this.conversation) return;
        if (this.conversation.participantIds.length <= 1) {
          await this.messageService.deleteConversation(this.conversationId).toPromise();
        } else {
          await this.deleteFromMessages();
          await this.messageService.updateConversation({
            ...this.conversation,
            participantIds: this.conversation.participantIds.filter(id => id !== this.currentUserId),
            deletedFor: [...(this.conversation.deletedFor ?? []), this.currentUserId]
          }).toPromise();
        }
        await this.modalController.dismiss({ deleted: true, conversationId: this.conversationId });
      }
    );
    await alert.present();
  }

  // ==============================================================
  //  UTILS
  // ==============================================================

  isMessageFromMe(message: Message): boolean { return message.senderId === this.currentUserId; }

  getStatusIcon(status: string): string {
    return { sent: 'checkmark', delivered: 'checkmark-done', read: 'checkmark-done', pending: 'time-outline', failed: 'alert-circle-outline' }[status] ?? 'time-outline';
  }

  getStatusClass(status: string): string {
    return `status-${status}` || 'status-pending';
  }

  formatDuration(seconds: number): string {
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  }

  trackByMessageId(_: number, m: Message): string { return m.id; }

  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.onerror = null;
    img.src = 'assets/avatar-default.png';
  }

  onScroll(event: any): void {
    this.showScrollToBottom = event.detail.scrollTop > 100;
  }

  scrollToBottom(): void { this.content?.scrollToBottom(300); }
  scrollToBottomClick(): void { this.scrollToBottom(); }
  private scrollToBottomDeferred(): void { setTimeout(() => this.scrollToBottom(), 100); }

  dismiss(): void { this.modalController.dismiss(); }

  private buildConfirmAlert(header: string, message: string, handler: () => any): Promise<HTMLIonAlertElement> {
    return this.alertController.create({
      header, message,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Confirmer', role: 'destructive', handler }
      ]
    });
  }
}
