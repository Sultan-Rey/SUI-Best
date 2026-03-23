import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { ShortNumberPipe } from 'src/app/utils/pipes/shortNumberPipe/short-number-pipe';
import { MessageService } from 'src/services/MESSAGE_SERVICE/message-service';
import { DmTimePipe } from '../../../utils/pipes/dmPipe/dmtime-pipe';
import { MediaUrlPipe } from 'src/app/utils/pipes/mediaUrlPipe/media-url-pipe';
import { Conversation, ConversationUtils } from 'src/models/Conversation';
import { SearchPage } from 'src/app/search/search.page';
import { ModalConversationComponent } from '../../../components/modal-conversation/modal-conversation.component';
import { ModalCreateChatGroupComponent } from '../../../components/modal-create-chat-group/modal-create-chat-group.component';

import { addIcons } from 'ionicons';
import {
  chevronBack, chevronDownOutline, chevronDownCircleOutline,
  createOutline, chevronForward, searchOutline, trashOutline,
  volumeMuteOutline, volumeHighOutline, imageOutline, peopleOutline,
  videocamOutline, micOutline, paperPlaneOutline, checkmarkCircle, star, diamond
} from 'ionicons/icons';

@Component({
  selector: 'app-messages',
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.scss'],
  providers: [ModalController],
  imports: [CommonModule, FormsModule, IonicModule, DmTimePipe, MediaUrlPipe, ShortNumberPipe, AsyncPipe]
})
export class MessagesComponent implements OnInit, OnDestroy {

  @Input() currentUserId!: string;
  @Input() currentUsername = '';

  conversations: Conversation[] = [];
  filteredConversations: Conversation[] = [];
  isLoading = false;
  searchQuery = '';

  private subscriptions: Subscription[] = [];

  constructor(
    private messageService: MessageService,
    private modalController: ModalController,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({
      chevronBack, chevronDownOutline, chevronDownCircleOutline,
      createOutline, chevronForward, searchOutline, trashOutline,
      volumeMuteOutline, volumeHighOutline, imageOutline, peopleOutline,
      videocamOutline, micOutline, paperPlaneOutline, checkmarkCircle, star, diamond
    });
  }

  ngOnInit() {
    if (!this.currentUserId) return;
    this.loadConversations();
    this.subscribeToConversations();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  // ==============================================================
  //  CHARGEMENT
  // ==============================================================

  private loadConversations(): void {
    this.isLoading = true;
    this.subscriptions.push(
      this.messageService.getConversations(this.currentUserId).subscribe({
        next: () => { this.isLoading = false; this.cdr.markForCheck(); },
        error: () => { this.isLoading = false; this.cdr.markForCheck(); }
      })
    );
  }

  /**
   * S'abonne au store réactif — mis à jour par le service à chaque
   * chargement initial, envoi de message ou événement SSE.
   */
  private subscribeToConversations(): void {
    this.subscriptions.push(
      this.messageService.conversations$.subscribe(conversations => {
        this.conversations = conversations.filter(c =>
          c.participantIds.includes(this.currentUserId)
        );
        this.filteredConversations = this.applyFilter(this.searchQuery);
        this.cdr.markForCheck();
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
      const name = conv.participant?.username?.toLowerCase() ?? '';
      const last = conv.lastMessage?.toLowerCase() ?? '';
      return name.includes(term) || last.includes(term);
    });
  }

  // ==============================================================
  //  ACTIONS
  // ==============================================================

  openConversation(conversation: Conversation): void {
    this.openConversationModal(conversation);
  }

  private async openConversationModal(conversation: Conversation): Promise<void> {
    const receiverId = ConversationUtils.getReceiverId(conversation.participantIds, this.currentUserId);

    const modal = await this.modalController.create({
      component: ModalConversationComponent,
      componentProps: {
        conversationId: conversation.id,
        currentUserId:  this.currentUserId,
        otherUser: {
          receiverId,
          username:   conversation.participant?.username,
          avatar:     conversation.participant?.avatar,
          isVerified: conversation.participant?.isVerified,
        }
      },
      presentingElement: await this.modalController.getTop()
    });

    await modal.present();
  }

  deleteConversation(conversationId: string, slidingItem: any): void {
    slidingItem.close();
    this.subscriptions.push(
      this.messageService.deleteConversation(conversationId).subscribe()
    );
  }

  toggleMute(conversationId: string, slidingItem: any): void {
    slidingItem.close();
    const conv = this.conversations.find(c => c.id === conversationId);
    if (!conv) return;
    this.subscriptions.push(
      this.messageService.updateConversation({ ...conv, isMuted: !conv.isMuted }).subscribe()
    );
  }

  async openNewMessage(): Promise<void> {
    const modal = await this.modalController.create({
      component: SearchPage,
      componentProps: { IsModal: true, currentUserId: this.currentUserId },
      initialBreakpoint: 0.87,
      breakpoints: [0, 0.87, 1],
      handle: true
    });
    await modal.present();
  }

  async createGroupe(): Promise<void> {
    const modal = await this.modalController.create({
      component: ModalCreateChatGroupComponent,
      handle: true
    });
    await modal.present();
  }

  // ==============================================================
  //  UTILS
  // ==============================================================

  isLastMessageFromMe(conversation: Conversation): boolean {
    const msgs = conversation.messages;
    if (!msgs?.length) return false;
    return msgs[msgs.length - 1]?.senderId === this.currentUserId;
  }

  isPopularArtist(conversation: Conversation): boolean {
    return conversation.participant?.userType === 'artist' &&
           (conversation.participant?.stats ?? 0) > 1000;
  }

  trackByConvId(_index: number, conv: Conversation): string {
    return conv.id as string;
  }

  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.onerror = null;
    img.src = 'assets/avatar-default.png';
  }

  refreshMessages(event: any): void {
    this.loadConversations();
    setTimeout(() => event.target.complete(), 1000);
  }

  onScroll(event:any){}

  loadMore(event: any): void {
    // TODO: pagination
    setTimeout(() => event.target.complete(), 1000);
  }

  dismiss(): void {
    this.modalController.dismiss();
  }
}
