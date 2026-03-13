import {
  Component, Input, OnInit, OnDestroy,
  ViewChild, ChangeDetectorRef
} from '@angular/core';
import { CommonModule, DatePipe, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, IonContent, IonTextarea, ActionSheetController, AlertController } from '@ionic/angular';
import { Subscription, interval } from 'rxjs';
import { MessageService } from '../../../services/MESSAGE_SERVICE/message-service';
import { DmTimePipe } from '../../utils/pipes/dmPipe/dmtime-pipe';
import { MediaUrlPipe} from '../../utils/pipes/mediaUrlPipe/media-url-pipe'
import { v4 as uuidv4 } from 'uuid';
import {
  Conversation,
  Message,
  MessageStatus,
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
  otherUserIsOnline = false;

  // ─── UI ─────────────────────────────────────────────────────
  isLoading = false;
  showScrollToBottom = false;
  isRecording = false;
  recordingDuration = 0;

  // ─── État interne ────────────────────────────────────────────
  private isTyping = false;
  private typingTimeout: ReturnType<typeof setTimeout> | null = null;
  private recordingInterval: ReturnType<typeof setInterval> | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private readonly MAX_VOICE_DURATION = 30; // 30 secondes max
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
    this.subscribeToConversation();
    this.setupTypingDetection();
  }

  ngOnDestroy() {
    // Nettoyer les subscriptions
    this.subscriptions.forEach(s => s.unsubscribe());
    
    // Nettoyer l'enregistrement vocal si actif
    if (this.isRecording) {
      this.stopVoiceRecording();
    }
    
    // Nettoyer le MediaRecorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.mediaRecorder = null;
    }
    
    // Nettoyer le timeout de frappe
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
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
            }
          });
        }
      })
    );

    // S'abonner au statut de frappe de l'autre participant
    this.subscribeToTypingIndicators();
    // S'abonner au statut en ligne de l'autre participant
    this.subscribeToOnlineStatus();
  }

  // ==============================================================
  //  SOCKET & TYPING
  // ==============================================================


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
   * S'abonne aux indicateurs de frappe
   */
  private subscribeToTypingIndicators() {
    if (!this.conversationId) return;
    
    this.subscriptions.push(
      this.messageService.isOtherUserTyping(this.conversationId, this.currentUserId).subscribe({
        next: (isTyping) => {
          if (isTyping !== this.otherUserIsTyping) {
            this.otherUserIsTyping = isTyping;
            this.cdr.markForCheck();
          }
        },
        error: (error) => {
          console.error('[ModalConversation] Error checking typing status:', error);
        }
      })
    );
  }

  /**
   * S'abonne au statut en ligne de l'autre participant
   */
  private subscribeToOnlineStatus() {
    if (!this.otherUser?.receiverId) return;
    
    this.subscriptions.push(
      this.messageService.watchOnlineStatus(this.otherUser.receiverId).subscribe({
        next: (status) => {
          this.otherUserIsOnline = status.isOnline;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('[ModalConversation] Error watching online status:', error);
        }
      })
    );
  }

  /**
   * Notifie que l'utilisateur commence/arrête de taper
   */
  private notifyTyping(isTyping: boolean) {
    if (!this.conversationId) return;
    
    if (isTyping) {
      this.messageService.startTyping(this.conversationId, this.currentUserId);
    } else {
      this.messageService.stopTyping(this.conversationId, this.currentUserId);
    }
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
  async startVoiceRecording() {
    try {
      // Demander l'accès au microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Créer le MediaRecorder
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];
      
      // Écouter les données audio
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      
      // Quand l'enregistrement s'arrête
      this.mediaRecorder.onstop = () => {
        this.handleVoiceRecordingComplete();
      };
      
      // Démarrer l'enregistrement
      this.mediaRecorder.start();
      this.isRecording = true;
      this.recordingDuration = 0;
      
      // Timer pour la durée avec limite de 30 secondes
      this.recordingInterval = setInterval(() => {
        this.recordingDuration++;
        this.cdr.markForCheck();
        
        // Arrêter automatiquement après 30 secondes
        if (this.recordingDuration >= this.MAX_VOICE_DURATION) {
          //console.log(`[ModalConversation] Voice recording: ${this.MAX_VOICE_DURATION}s limit reached`);
          this.stopVoiceRecording();
        }
      }, 1000);
      
      //console.log('[ModalConversation] Voice recording started');
    } catch (error) {
      console.error('[ModalConversation] Voice recording error:', error);
      // Afficher une erreur à l'utilisateur
      this.showRecordingError();
    }
  }

  /**
   * Arrête l'enregistrement vocal
   */
  stopVoiceRecording() {
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }
    
    // Arrêter le MediaRecorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      
      // Arrêter tous les tracks audio
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    
    this.isRecording = false;
    this.recordingDuration = 0;
    this.cdr.markForCheck();
  }

  /**
   * Gère la fin de l'enregistrement vocal
   */
  private handleVoiceRecordingComplete() {
    // Créer le blob audio à partir des chunks
    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
    const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
    
    console.log('[ModalConversation] Voice recording complete:', audioFile.size, 'bytes');
    
    // Uploader le fichier audio
    this.uploadVoiceMessage(audioFile);
  }

  /**
   * Uploade et envoie le message vocal
   */
  private uploadVoiceMessage(audioFile: File) {
    // Uploader le fichier audio d'abord
    this.messageService.uploadFile(audioFile, audioFile.name, this.conversationId).subscribe({
      next: (uploadResult) => {
        console.log('[ModalConversation] Voice uploaded:', uploadResult);
        
        // Créer le message avec l'URL du fichier audio
        const tempMessage: Message = {
          id: `temp-${Date.now()}`,
          conversationId: this.conversationId,
          senderId: this.currentUserId,
          receiverId: this.otherUser.receiverId,
          content: uploadResult.url, // URL du fichier audio uploadé
          status: 'sent',
          createdAt: new Date()
        };

        if (this.conversation) {
          this.conversation.messages.push(tempMessage);
          this.scrollToBottomDeferred();
          this.sendMessageToBackend(tempMessage);
        }
      },
      error: (error) => {
        console.error('[ModalConversation] Voice upload error:', error);
        // En cas d'erreur, créer un message d'erreur
        const errorMessage: Message = {
          id: `temp-${Date.now()}`,
          conversationId: this.conversationId,
          senderId: this.currentUserId,
          receiverId: this.otherUser.receiverId,
          content: '❌ Erreur lors de l\'envoi du message vocal',
          status: 'pending' as MessageStatus,
          createdAt: new Date()
        };
        
        if (this.conversation) {
          this.conversation.messages.push(errorMessage);
          this.scrollToBottomDeferred();
        }
      }
    });
  }

  /**
   * Affiche une erreur d'enregistrement
   */
  private showRecordingError() {
    const errorMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId: this.conversationId,
      senderId: this.currentUserId,
      receiverId: this.otherUser.receiverId,
      content: '❌ Impossible d\'accéder au microphone',
      status: 'pending' as MessageStatus,
      createdAt: new Date()
    };
    
    if (this.conversation) {
      this.conversation.messages.push(errorMessage);
      this.scrollToBottomDeferred();
    }
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
      //console.log('Image selected:', file.name, file.size);
      
      // Uploader l'image d'abord
      this.messageService.uploadFile(file, file.name, this.conversationId).subscribe({
        next: (uploadResult) => {
          console.log('Image uploaded:', uploadResult);
          
          // Créer le message avec l'URL de l'image
          const tempMessage: Message = {
            id: `temp-${Date.now()}`,
            conversationId: this.conversationId,
            senderId: this.currentUserId,
            receiverId: this.otherUser.receiverId,
            content: uploadResult.url, // URL de l'image uploadée
            status: 'sent',
            createdAt: new Date()
          };

          if (this.conversation) {
            this.conversation.messages.push(tempMessage);
            this.scrollToBottomDeferred();
            this.sendMessageToBackend(tempMessage);
          }
        },
        error: (error) => {
          console.error('[ModalConversation] Image upload error:', error);
          // En cas d'erreur, créer un message d'erreur
          const errorMessage: Message = {
            id: `temp-${Date.now()}`,
            conversationId: this.conversationId,
            senderId: this.currentUserId,
            receiverId: this.otherUser.receiverId,
            content: '❌ Erreur lors de l\'envoi de l\'image',
            status: 'pending' as MessageStatus,
            createdAt: new Date()
          };
          
          if (this.conversation) {
            this.conversation.messages.push(errorMessage);
            this.scrollToBottomDeferred();
          }
        }
      });
      
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
  async presentMoreOptions() {
    if (!this.conversation) return;

    const isGroup = !!this.conversation.groupData;
    const isAdmin = this.conversation.groupData?.admins.includes(this.currentUserId) || false;

    if (isGroup) {
      // Options pour les conversations de groupe
      const groupActions = [
        {
          text: 'Voir les membres',
          icon: 'people-outline',
          handler: () => this.viewGroupMembers()
        },
        {
          text: 'Copier le lien',
          icon: 'link-outline',
          handler: () => this.copyGroupLink()
        }
      ];

      // Option effacer les messages (uniquement pour les admins)
      if (isAdmin) {
        groupActions.push({
          text: 'Effacer les messages',
          icon: 'trash-outline',
          handler: () => this.clearGroupMessages()
        });
      }

      // Option quitter le groupe
      groupActions.push({
        text: 'Quitter le groupe',
        icon: 'exit-outline',
        handler: () => this.leaveGroup()
      });

      const actionSheet = await this.actionSheetController.create({
        header: 'Options du groupe',
        buttons: groupActions
      });

      await actionSheet.present();

    } else {
      // Options pour les conversations simples
      const privateActions = [
        {
          text: 'Effacer pour moi',
          icon: 'eye-off-outline',
          handler: () => this.clearMessagesForMe()
        },
        {
          text: 'Supprimer la conversation',
          icon: 'trash-outline',
          handler: () => this.deleteConversation()
        }
      ];

      const actionSheet = await this.actionSheetController.create({
        header: 'Options de la conversation',
        buttons: privateActions
      });

      await actionSheet.present();
    }
  }

  // ─── ACTIONS GROUPE ───────────────────────────────────────────

  /**
   * Affiche les membres du groupe
   */
  async viewGroupMembers() {
    console.log('Voir les membres du groupe');
    // TODO: Implémenter l'affichage des membres
  }

  /**
   * Copie le lien du groupe
   */
  async copyGroupLink() {
    const groupLink = `${window.location.origin}/group/${this.conversation?.id}`;
    
    try {
      await navigator.clipboard.writeText(groupLink);
      console.log('Lien du groupe copié');
      // TODO: Afficher un toast de confirmation
    } catch (error) {
      console.error('Erreur lors de la copie du lien:', error);
    }
  }

  /**
   * Efface tous les messages du groupe (admin uniquement)
   */
  async clearGroupMessages() {
    if (!this.conversation?.groupData) return;

    const alert = await this.alertController.create({
      header: 'Effacer les messages',
      message: 'Êtes-vous sûr de vouloir effacer tous les messages du groupe ? Cette action est irréversible.',
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Effacer',
          role: 'destructive',
          handler: async () => {
            try {
              if (!this.conversation) return;

              // Créer une conversation avec tableau de messages vide
              const clearedConversation: Conversation = {
                ...this.conversation,
                messages: [], // 🔥 Supprimer tous les messages
                lastMessage: undefined,
                lastMessageTime: undefined,
                lastMessageType: undefined,
                unreadCount: 0
              };

              // Mettre à jour la conversation
              await this.messageService.updateConversation(clearedConversation).toPromise();

              // Mettre à jour la conversation locale
              this.conversation.messages = [];
              this.conversation.lastMessage = undefined;
              this.conversation.lastMessageTime = undefined;
              this.conversation.lastMessageType = undefined;
              this.conversation.unreadCount = 0;

              // Forcer la détection de changements
              this.cdr.detectChanges();

              console.log('[ModalConversation] Group messages cleared successfully');

            } catch (error) {
              console.error('[ModalConversation] clearGroupMessages error:', error);
              // TODO: Afficher une erreur à l'utilisateur
            }
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Quitte le groupe
   */
  async leaveGroup() {
    if (!this.conversation?.groupData || !this.currentUserId) return;

    const alert = await this.alertController.create({
      header: 'Quitter le groupe',
      message: 'Êtes-vous sûr de vouloir quitter ce groupe ?',
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Quitter',
          role: 'destructive',
          handler: () => {
            this.messageService.removeParticipant(this.conversation!.id, this.currentUserId).subscribe({
              next: () => {
                console.log('Utilisateur a quitté le groupe');
                this.dismiss();
              },
              error: (error) => {
                console.error('Erreur en quittant le groupe:', error);
              }
            });
          }
        }
      ]
    });

    await alert.present();
  }

  // ─── ACTIONS CONVERSATION SIMPLE ───────────────────────────────

  /**
   * Efface les messages pour l'utilisateur courant
   */
  async clearMessagesForMe() {
    if (!this.conversation || !this.currentUserId) return;

    const alert = await this.alertController.create({
      header: 'Effacer mes messages',
      message: 'Êtes-vous sûr de vouloir effacer tous vos messages dans cette conversation ? Cette action est irréversible.',
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Effacer',
          role: 'destructive',
          handler: async () => {
            try {
              // Ajouter l'utilisateur courant au deletedFor de ses messages
              const updatedMessages = this.conversation?.messages.map(msg => {
                if (msg.senderId === this.currentUserId) {
                  return {
                    ...msg,
                    deletedFor: [
                      ...(msg.deletedFor || []),
                      this.currentUserId
                    ]
                  };
                }
                return msg;
              });

              // Mettre à jour la conversation avec les messages modifiés
              const updatedConversation: Conversation = {
                ...this.conversation!,
                messages: (updatedMessages as Message[] || [])
              };

              // Mettre à jour via le service
              await this.messageService.updateConversation(updatedConversation).toPromise();

              // Mettre à jour la conversation locale
              if (this.conversation) {
                this.conversation.messages = (updatedMessages as Message[] || []);
              }

              // Forcer la détection de changements
              this.cdr.detectChanges();

              //console.log('[ModalConversation] Messages cleared for current user successfully');

            } catch (error) {
              console.error('[ModalConversation] clearMessagesForMe error:', error);
              // TODO: Afficher une erreur à l'utilisateur
            }
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Supprime complètement la conversation
   */
  async deleteConversation() {
    const alert = await this.alertController.create({
      header: 'Supprimer la conversation',
      message: 'Êtes-vous sûr de vouloir supprimer cette conversation ? Cette action est irréversible.',
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Supprimer',
          role: 'destructive',
          handler: async () => {
            try {
              if (!this.conversation || !this.currentUserId) return;

              // Si un seul participant, supprimer complètement la conversation
              if (this.conversation.participantIds.length === 1) {
                await this.messageService.deleteConversation(this.conversation.id).toPromise();
              } else {
                // Sinon, soft delete : retirer l'utilisateur des participants et l'ajouter à deletedFor
                const updatedConversation: Conversation = {
                  ...this.conversation,
                  participantIds: this.conversation.participantIds.filter(id => id !== this.currentUserId),
                  deletedFor: [
                    ...(this.conversation.deletedFor || []),
                    this.currentUserId
                  ]
                };
                
                await this.messageService.updateConversation(updatedConversation).toPromise();
              }

              // Fermer le modal après suppression
              await this.modalController.dismiss({
                deleted: true,
                conversationId: this.conversation.id
              });

            } catch (error) {
              console.error('[ModalConversation] deleteConversation error:', error);
              // TODO: Afficher une erreur à l'utilisateur
            }
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Rejoint le groupe (demande d'adhésion)
   */
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
