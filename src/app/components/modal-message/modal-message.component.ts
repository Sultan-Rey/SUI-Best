import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { Subscription, forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ShortNumberPipe } from 'src/app/utils/pipes/shortNumberPipe/short-number-pipe';
import { MessageService } from '../../../services/MESSAGE_SERVICE/message-service';
import { ProfileService } from '../../../services/PROFILE_SERVICE/profile-service';
import { SocketService } from '../../../services/SOCKET/socket-service';
import { DmTimePipe } from '../../utils/pipes/dmPipe/dmtime-pipe';
import { MediaUrlPipe } from 'src/app/utils/pipes/mediaUrlPipe/media-url-pipe';
import { Conversation, ConversationUtils } from '../../../models/Conversation';
import { SearchPage } from 'src/app/search/search.page';
import { ModalConversationComponent } from '../../components/modal-conversation/modal-conversation.component';

import { addIcons } from 'ionicons';
import {
  chevronBack, chevronDownOutline, chevronDownCircleOutline,
  createOutline, chevronForward, searchOutline, trashOutline,
  volumeMuteOutline, volumeHighOutline, imageOutline,
  videocamOutline, micOutline, paperPlaneOutline, checkmarkCircle, star, diamond
} from 'ionicons/icons';

@Component({
  selector: 'app-modal-message',
  templateUrl: './modal-message.component.html',
  styleUrls: ['./modal-message.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, DmTimePipe, MediaUrlPipe, ShortNumberPipe]
})
export class ModalMessageComponent implements OnInit, OnDestroy {
  @Input() currentUserId!: string;
  @Input() currentUsername: string = '';

  // ─── Données ────────────────────────────────────────────────
  conversations: Conversation[] = [];
  filteredConversations: Conversation[] = [];

  // ─── UI ─────────────────────────────────────────────────────
  isLoading = false;
  searchQuery = '';

  private subscriptions: Subscription[] = [];

  constructor(
    private messageService: MessageService,
    private profileService: ProfileService,
    private socketService: SocketService,
    private modalController: ModalController,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({
      chevronBack, chevronDownOutline, chevronDownCircleOutline,
      createOutline, chevronForward, searchOutline, trashOutline,
      volumeMuteOutline, volumeHighOutline, imageOutline,
      videocamOutline, micOutline, paperPlaneOutline, checkmarkCircle, star, diamond
    });
  }

  ngOnInit() {
    if (!this.currentUserId) return;
    this.setupSubscriptions();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  // ==============================================================
  //  CHARGEMENT
  // ==============================================================

  /**
   * Enrichit une conversation avec les infos du participant
   */
  private enrichConversation(conv: Conversation): any {
    const receiverId = ConversationUtils.getReceiverId(conv.participantIds, this.currentUserId);
    return this.profileService.getProfileById(receiverId).pipe(
      map(profile => ({
        ...conv,
        participant: {
          id: receiverId,
          username: profile?.username || 'Unknown',
          avatar: profile?.avatar || 'assets/avatar-default.png',
          isOnline: Math.random() > 0.5,
          isTyping: false,
          isVerified: profile?.isVerified || false,
          userType: profile?.userType || 'fan',
          stats: profile?.stats.fans,
          plan: profile?.plan || 'free'
        },
        unreadCount: conv.unreadCount || 0,
        lastMessage: conv.messages?.length > 0 ? conv.messages[conv.messages.length - 1].content : '',
        lastMessageTime: conv.messages?.length > 0 ? conv.messages[conv.messages.length - 1].createdAt : new Date(),
        lastMessageType: conv.messages?.length > 0 ? this.getMessageType(conv.messages[conv.messages.length - 1].content) : 'text'
      }))
    );
  }

  /**
   * Détermine le type de message (text, image, etc.)
   */
  private getMessageType(content: string): string {
    if (content.includes('image') || content.includes('photo')) return 'image';
    if (content.includes('video')) return 'video';
    if (content.includes('audio')) return 'audio';
    return 'text';
  }

  private setupSubscriptions() {
    this.isLoading = true;
    
    // Initialiser le cache en appelant getConversations une première fois
    this.messageService.getConversations(this.currentUserId).subscribe();
    
    // Mises à jour temps réel (nouveau message → aperçu mis à jour)
    this.subscriptions.push(
      this.messageService.conversations$.pipe(
        switchMap(conversations => {
          // Filtrer pour ne garder que les conversations de l'utilisateur courant
          const userConversations = conversations.filter(conv => 
            conv.participantIds.includes(this.currentUserId)
          );
          
          if (userConversations.length === 0) {
            return of([]);
          }
          
          // Enrichir chaque conversation avec les infos du participant
          const enrichedRequests = userConversations.map(conv => this.enrichConversation(conv));
          return forkJoin(enrichedRequests);
        })
      ).subscribe(enrichedConversations => {
        console.log('[ModalMessage] Enriched conversations:', enrichedConversations.length);
        this.conversations = enrichedConversations;
        this.filteredConversations = this.applyFilter(this.searchQuery);
        console.log('[ModalMessage] Filtered conversations:', this.conversations);
        this.isLoading = false;
        this.cdr.markForCheck(); // Forcer la détection de changement
      })
    );
  }

  // ==============================================================
  //  RECHERCHE
  // ==============================================================

  onSearchInput(event: any) {
    this.searchQuery = event.target.value ?? '';
    this.filteredConversations = this.applyFilter(this.searchQuery);
  }

  private applyFilter(query: string): Conversation[] {
    const term = query.trim().toLowerCase();
    if (!term) return [...this.conversations];
    return this.conversations.filter(conv => {
      // Récupérer le nom du participant via le service
      const participantName = this.messageService.getParticipantName(
        ConversationUtils.getReceiverId(conv.participantIds, this.currentUserId)
      );
      return participantName.toLowerCase().includes(term) ||
             conv.messages.some(msg => msg.content.toLowerCase().includes(term));
    });
  }

  // ==============================================================
  //  ACTIONS SUR LES CONVERSATIONS
  // ==============================================================

  openConversation(conversation: Conversation) {
    // Marquer la conversation comme ouverte
    this.messageService.markConversationAsRead(conversation.id);
    
    // Initialiser ou mettre à jour le socket pour cette conversation
    this.initializeOrUpdateSocket(conversation.id, conversation.participantIds);
    
    this.openConversationModal(conversation);
  }

  /**
   * Initialise ou met à jour le socket pour une conversation existante
   */
  private async initializeOrUpdateSocket(conversationId: string, participantIds: string[]) {
    try {
      // Vérifier si le socket existe
      const existingSocket = await this.socketService.socketFind(conversationId).toPromise();
      
      if (existingSocket) {
        // Socket existe : réinitialiser les pings à 0 pour tous les participants
        console.log('[ModalMessage] Socket exists, resetting pings to 0');
        
        // Mettre à jour le socket avec tous les pings à 0
        await this.socketService.socketPing(conversationId, participantIds[0], 0).toPromise();
        await this.socketService.socketPing(conversationId, participantIds[1], 0).toPromise();
        
      } else {
        // Socket n'existe pas : en créer un nouveau
        console.log('[ModalMessage] Socket does not exist, creating new one');
        await this.socketService.socketCreate(conversationId, participantIds).toPromise();
      }
    } catch (error) {
      console.error('[ModalMessage] Error initializing socket:', error);
    }
  }

  private async openConversationModal(conversation: Conversation) {
    const modal = await this.modalController.create({
      component: ModalConversationComponent,
      componentProps: {
        conversationId: conversation.id,
        currentUserId: this.currentUserId,
        otherUser: {
          username: conversation.participant?.username,
          isVerified: conversation.participant?.isVerified,
        avatar: conversation.participant?.avatar,
        receiverId: ConversationUtils.getReceiverId(conversation.participantIds, this.currentUserId)
        }
        
      },
      presentingElement: await this.modalController.getTop()
    });
    
    // Écouter la fermeture du modal - pas besoin de recharger, l'abonnement gère déjà les mises à jour
    modal.onDidDismiss().then(() => {
      // L'abonnement à conversations$ dans setupSubscriptions() gère déjà les mises à jour
      console.log('Modal conversation fermé');
    });
    
    await modal.present();
  }

  deleteConversation(conversationId: string, slidingItem: any) {
    slidingItem.close();
    this.messageService.deleteConversation(conversationId).subscribe(() => {
      this.conversations = this.conversations.filter(c => c.id !== conversationId);
      this.filteredConversations = this.applyFilter(this.searchQuery);
    });
  }

  toggleMute(conversationId: string, slidingItem: any) {
    slidingItem.close();
    const conv = this.conversations.find(c => c.id === conversationId);
    if (conv) {
      conv.isMuted = !conv.isMuted;
      // TODO: persister via le service
    }
  }

  // ==============================================================
  //  NOUVEAU MESSAGE
  // ==============================================================

  async openNewMessage() {
    const modal = await this.modalController.create({
      component: SearchPage,
      componentProps: { IsModal: true, currentUserId: this.currentUserId },
      handle: true
    });
    await modal.present();
  }

  openRequests() {
    // TODO: ouvrir le modal des demandes en attente
  }

  // ==============================================================
  //  SCROLL / REFRESH
  // ==============================================================

  refreshMessages(event: any) {
    // L'abonnement réactif gère déjà les mises à jour
    setTimeout(() => event.target.complete(), 1000);
  }

  loadMore(event: any) {
    // TODO: pagination
    setTimeout(() => event.target.complete(), 1000);
  }

  onScroll(_event: any) {}

  // ==============================================================
  //  UTILS
  // ==============================================================

  /** Retourne true si le dernier message a été envoyé par l'utilisateur courant. */
  isLastMessageFromMe(conversation: Conversation): boolean {
    if (!conversation || !conversation.messages || conversation.messages.length === 0) {
      return false;
    }
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    return lastMessage?.senderId === this.currentUserId;
  }

  /** Retourne true si l'artiste est populaire (plus de 1000 fans) */
  isPopularArtist(conversation: Conversation): boolean {
    return conversation.participant?.userType === 'artist' && 
           conversation.participant?.stats !== undefined && 
           conversation.participant?.stats > 1000;
  }

  get pendingRequestsCount(): number {
    return 0; // Plus de pendingRequests dans la nouvelle architecture
  }

  trackByConvId(_index: number, conv: Conversation): string {
    return conv.id as string;
  }

  onAvatarError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.onerror = null;
    img.src = 'assets/avatar-default.png';
  }

  dismiss() {
    this.modalController.dismiss();
  }
}