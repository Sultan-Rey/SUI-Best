import {
  Component, Input, OnInit, OnDestroy,
  ViewChild, ChangeDetectorRef
} from '@angular/core';
import { CommonModule, DatePipe, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, IonContent, IonTextarea } from '@ionic/angular';
import { Subscription, interval } from 'rxjs';
import { MessageService } from '../../../services/MESSAGE_SERVICE/message-service';
import { SocketService } from '../../../services/SOCKET/socket-service';
import { DmTimePipe } from '../../utils/pipes/dmPipe/dmtime-pipe';
import { MediaUrlPipe} from '../../utils/pipes/mediaUrlPipe/media-url-pipe'
import { v4 as uuidv4 } from 'uuid';
import {
  Conversation,
  Message,
  MessageStatus,
  ConversationStatus,
  ConversationUtils
} from '../../../models/Conversation';

import { addIcons } from 'ionicons';
import {
  chevronBack, send, mic, image, happy, attach,
  call, videocamOutline, ellipsisVertical,
  checkmark, checkmarkDone, timeOutline, play, alertCircleOutline,
  checkmarkCircle
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
  @Input() otherUser!: any;
  @Input() conversationId!: string;
  
  // ─── Données ────────────────────────────────────────────────
  conversation?: Conversation;
  messages: Message[] = [];
  newMessage = '';
  receiverName = '';
  private conversationFromBackend = false;
  otherUserIsTyping = false;

  // ─── UI ─────────────────────────────────────────────────────
  isLoading = false;
  showScrollToBottom = false;
  isRecording = false;
  recordingDuration = 0;

  // ─── État interne ────────────────────────────────────────────
  private isTyping = false;
  private typingTimeout: ReturnType<typeof setTimeout> | null = null;
  private recordingInterval: ReturnType<typeof setInterval> | null = null;
  private subscriptions: Subscription[] = [];

  @ViewChild(IonContent) content!: IonContent;
  @ViewChild('messageInput') messageInput!: IonTextarea;
  @ViewChild('imageInput') imageInput!: any;

  constructor(
    private messageService: MessageService,
    private socketService: SocketService,
    private modalController: ModalController,
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
    this.subscribeToConversation();
    this.setupTypingDetection();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    if (this.recordingInterval) clearInterval(this.recordingInterval);
    if (this.isTyping) this.stopTyping();
  }

  // ==============================================================
  //  CHARGEMENT
  // ==============================================================

  private subscribeToConversation() {
    this.isLoading = true;
    
    // S'abonner d'abord à toutes les conversations pour les mises à jour en temps réel
    this.subscriptions.push(
      this.messageService.conversations$.subscribe((conversations: Conversation[]) => {
        // Chercher la conversation actuelle dans les mises à jour
        const currentConversation = conversations.find(c => c.id === this.conversationId);
        
        if (currentConversation) {
          // Vérifier si de nouveaux messages ont été reçus
          const previousMessageCount = this.conversation?.messages?.length || 0;
          const newMessageCount = currentConversation.messages?.length || 0;
          const hasNewMessages = newMessageCount > previousMessageCount;
          
          this.conversation = currentConversation;
          this.messages = currentConversation.messages || [];
          this.receiverName = this.messageService.getParticipantName(
            ConversationUtils.getReceiverId(this.conversation.participantIds, this.currentUserId)
          );
          this.conversationFromBackend = true;
          
          this.isLoading = false;
          this.cdr.markForCheck();
          this.scrollToBottomDeferred();
          
          // Marquer les messages reçus comme lus
          if (hasNewMessages) {
            this.messageService.markMessageAsRead(this.conversationId, this.currentUserId);
          }
          
          // Initialiser le socket pour cette conversation
          this.initializeSocket();
        } else {
          // Si pas trouvée, vérifier si elle existe via l'API
          this.messageService.findExistingConversationId(
            [this.currentUserId, this.otherUser.receiverId], 
            this.currentUserId
          ).subscribe(existingConversationId => {
            if (!existingConversationId) {
              // Créer une conversation vide seulement si elle n'existe vraiment pas
              this.conversation = {
                id: this.conversationId,
                participantIds: [this.currentUserId, this.otherUser.receiverId],
                messages: [],
                createdAt: new Date(),
                status: 'open'
              };
              this.messages = [];
              this.receiverName = this.messageService.getParticipantName(this.otherUser.receiverId);
              this.conversationFromBackend = false;
              this.isLoading = false;
              this.cdr.markForCheck();
              this.scrollToBottomDeferred();
              
              // Initialiser le socket même pour les nouvelles conversations
              this.initializeSocket();
            }
          });
        }
      })
    );

    // Surveiller le statut de frappe de l'autre participant toutes les 3 secondes
    this.subscriptions.push(
      interval(3000).subscribe(() => {
        if (this.conversationId) {
          this.checkOtherParticipantTyping();
        }
      })
    );
  }

  // ==============================================================
  //  SOCKET & TYPING
  // ==============================================================

  /**
   * Initialise le socket pour la conversation
   */
  private initializeSocket() {
    if (!this.conversationId || !this.conversation) return;
    
    this.socketService.initializeSocket(this.conversationId, this.conversation.participantIds).subscribe({
      next: (socket) => {
        console.log('[ModalConversation] Socket initialized:', socket);
      },
      error: (error) => {
        console.error('[ModalConversation] Error initializing socket:', error);
      }
    });
  }

  /**
   * Configure la détection de frappe
   */
  private setupTypingDetection() {
    // Utiliser un timeout simple pour détecter quand l'utilisateur arrête de taper
    let typingTimer: ReturnType<typeof setTimeout>;
    
    // Définir le gestionnaire d'entrée
    this.onMessageInput = (event: any) => {
      const value = event.target.value;
      
      // Si l'utilisateur commence à taper
      if (value.trim().length > 0 && !this.isTyping) {
        this.isTyping = true;
        this.notifyTyping(true);
      }
      
      // Réinitialiser le timer
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        if (this.isTyping) {
          this.isTyping = false;
          this.notifyTyping(false);
        }
      }, 1000); // Arrêter de taper après 1 seconde d'inactivité
    };
  }

  /**
   * Vérifie si l'autre participant est en train de taper
   */
  private checkOtherParticipantTyping() {
    if (!this.conversationId) return;
    
    this.socketService.isOtherParticipantTyping(this.conversationId, this.currentUserId).subscribe({
      next: (isTyping) => {
        if (isTyping !== this.otherUserIsTyping) {
          this.otherUserIsTyping = isTyping;
          this.cdr.markForCheck();
        }
      },
      error: (error) => {
        console.error('[ModalConversation] Error checking typing status:', error);
      }
    });
  }

  /**
   * Notifie que l'utilisateur commence/arrête de taper
   */
  private notifyTyping(isTyping: boolean) {
    if (!this.conversationId) return;
    
    this.socketService.socketPing(this.conversationId, this.currentUserId, isTyping ? 1 : 0).subscribe({
      next: (socket) => {
        console.log('[ModalConversation] Typing status updated:', isTyping);
      },
      error: (error) => {
        console.error('[ModalConversation] Error updating typing status:', error);
      }
    });
  }

  /**
   * Gestionnaire d'entrée pour le champ de message
   */
  onMessageInput(event: any) {
    // Implémenté dans setupTypingDetection
  }

  /**
   * Arrête la frappe
   */
  stopTyping() {
    if (this.isTyping) {
      this.isTyping = false;
      this.notifyTyping(false);
      if (this.typingTimeout) { 
        clearTimeout(this.typingTimeout); 
        this.typingTimeout = null; 
      }
    }
  }

  // ==============================================================
  //  ENVOI DE MESSAGES
  // ==============================================================

  sendMessage() {
    const content = this.newMessage.trim();
    if (!content || !this.currentUserId || !this.otherUser.receiverId || !this.conversation) return;

    if (this.isTyping) this.stopTyping();

    // Créer le message temporaire pour l'UI
    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId: this.conversationId,
      senderId: this.currentUserId,
      receiverId: this.otherUser.receiverId,
      content,
      status: 'sent',
      createdAt: new Date()
    };

    // Ajouter directement à conversation.messages
    this.conversation.messages.push(tempMessage);
    this.newMessage = '';
    this.scrollToBottomDeferred();

    // Envoyer au backend
    this.sendMessageToBackend(tempMessage);
  }

  private sendMessageToBackend(message: Message) {
    if (!this.conversation) return;

    if (this.conversationFromBackend) {
      // Conversation existe - envoyer le message
      this.messageService.sendMessage(this.conversation).subscribe({
        next: () => {
          console.log('[ModalConversation] Message sent successfully');
        },
        error: (error: any) => {
          console.error('[ModalConversation] sendMessage error:', error);
          message.status = 'pending';
          this.cdr.markForCheck();
        }
      });
    } else {
      // Première fois - créer la conversation avec le premier message
      this.messageService.createConversation(this.conversation).subscribe({
        next: (createdConversation) => {
          console.log('[ModalConversation] Conversation created successfully:', createdConversation);
          this.conversationFromBackend = true;
          this.conversation = createdConversation;
          this.conversationId = createdConversation.id;
          
          // Créer le socket pour cette nouvelle conversation
          this.socketService.socketCreate(createdConversation.id, createdConversation.participantIds).subscribe({
            next: (socket) => {
              console.log('[ModalConversation] Socket created for new conversation:', socket);
            },
            error: (error) => {
              console.error('[ModalConversation] Error creating socket:', error);
            }
          });
          
          // Mettre à jour le statut du message à 'sent'
          message.status = 'sent';
          this.cdr.markForCheck();
        },
        error: (error: any) => {
          console.error('[ModalConversation] createConversation error:', error);
          message.status = 'pending';
          this.cdr.markForCheck();
        }
      });
    }
  }

  // ==============================================================
  //  UTILS
  // ==============================================================

  private scrollToBottomDeferred() {
    setTimeout(() => this.scrollToBottom(), 100);
  }

  /**
   * Fait défiler vers le bas
   */
  scrollToBottom() {
    this.content?.scrollToBottom(300);
  }

  /**
   * Vérifie si le message a été envoyé par l'utilisateur courant
   */
  isMessageFromMe(message: Message): boolean {
    return message.senderId === this.currentUserId;
  }

  /**
   * TrackBy function pour optimiser le ngFor des messages
   */
  trackByMessageId(index: number, message: Message): string {
    return message.id;
  }

  /**
   * Gère les erreurs de chargement d'avatar
   */
  onAvatarError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.onerror = null;
    img.src = 'assets/avatar-default.png';
  }

  /**
   * Gère l'événement de scroll
   */
  onScroll(event: any) {
    const scrollTop = event.detail.scrollTop;
    this.showScrollToBottom = scrollTop > 100;
  }

  /**
   * Formate la durée d'enregistrement vocal
   */
  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Démarre l'enregistrement vocal
   */
  startVoiceRecording() {
    this.isRecording = true;
    this.recordingDuration = 0;
    
    this.recordingInterval = setInterval(() => {
      this.recordingDuration++;
      this.cdr.markForCheck();
    }, 1000);
  }

  /**
   * Arrête l'enregistrement vocal
   */
  stopVoiceRecording() {
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }
    
    this.isRecording = false;
    this.recordingDuration = 0;
    this.cdr.markForCheck();
  }

  /**
   * Ouvre les options de médias
   */
  openMediaOptions() {
    // TODO: Implémenter les options de médias
    console.log('Media options clicked');
  }

  /**
   * Envoie une image
   */
  sendImage() {
    if (this.imageInput && this.imageInput.nativeElement && this.imageInput.nativeElement.files.length > 0) {
      const file = this.imageInput.nativeElement.files[0];
      console.log('Image selected:', file.name, file.size);
      
      // TODO: Implémenter l'upload et l'envoi de l'image
      // Pour l'instant, on simule l'envoi
      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        conversationId: this.conversationId,
        senderId: this.currentUserId,
        receiverId: this.otherUser.receiverId,
        content: `[Image: ${file.name}]`,
        status: 'sent',
        createdAt: new Date()
      };

      if (this.conversation) {
        this.conversation.messages.push(tempMessage);
        this.scrollToBottomDeferred();
        this.sendMessageToBackend(tempMessage);
      }
      
      // Réinitialiser l'input
      this.imageInput.nativeElement.value = '';
    }
  }

  /**
   * Retourne l'icône du statut du message
   */
  getStatusIcon(status: string): string {
    switch (status) {
      case 'sent':
        return 'checkmark';
      case 'delivered':
        return 'checkmark-done';
      case 'read':
        return 'checkmark-done';
      case 'pending':
        return 'time-outline';
      case 'failed':
        return 'alert-circle-outline';
      default:
        return 'time-outline';
    }
  }

  /**
   * Retourne la classe CSS du statut du message
   */
  getStatusClass(status: string): string {
    switch (status) {
      case 'sent':
        return 'status-sent';
      case 'delivered':
        return 'status-delivered';
      case 'read':
        return 'status-read';
      case 'pending':
        return 'status-pending';
      case 'failed':
        return 'status-failed';
      default:
        return 'status-pending';
    }
  }

  /**
   * Ouvre les options supplémentaires
   */
  openMoreOptions() {
    // TODO: Implémenter les options supplémentaires
    console.log('More options clicked');
  }

  /**
   * Fait défiler vers le bas
   */
  scrollToBottomClick() {
    this.scrollToBottom();
  }

  dismiss() {
    this.modalController.dismiss();
  }
}
