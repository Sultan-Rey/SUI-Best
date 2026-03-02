import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { 
  send, chatbubbleOutline, happyOutline, heartOutline, closeOutline, 
  chevronDownOutline, chatbubblesOutline, layersOutline, returnDownForwardOutline
} from 'ionicons/icons';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonItem, 
  IonIcon, IonButtons, IonList, IonAvatar, IonLabel, IonFooter, 
  IonSpinner, IonTextarea, IonBackButton, IonInput
} from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { CommentService } from '../../../services/COMMENTS_SERVICE/comment-service.js';
import { Comment } from '../../../models/Comment';
import { UserProfile } from '../../../models/User';
import { ModalController} from '@ionic/angular';
import { NgFor, SlicePipe } from '@angular/common';
import { MediaUrlPipe } from 'src/app/utils/pipes/mediaUrlPipe/media-url-pipe.js';

@Component({
  selector: 'app-modal-comment',
  templateUrl: './modal-comment.component.html',
  styleUrls: ['./modal-comment.component.scss'],
  standalone: true,
  providers: [ModalController],
  imports: [
    IonFooter, MediaUrlPipe,
    IonButtons, IonIcon, IonButton, IonContent, 
    IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, NgFor, IonInput, SlicePipe
  ]
})
export class ModalCommentComponent implements OnInit {

  @Input() contentId!: string;
  @Input() currentUser!: UserProfile;
  comments: Comment[] = [];
  showEmojiPicker: boolean = false;
  emojis: string[] = ['❤️', '🔥', '😂', '😍', '👏', '🎉', '😢', '😡', '👍', '👎', '🔥', '💯', '✨', '🌟', '💪', '🙏', '😊', '😎', '🤔', '👀'];

  newComment = '';
  isLoading = false;
  isPosting = false;
  
  replyingTo: Comment | null = null;
  replyText: string = '';
  isReplying = false;
  hasMoreComments = false;
  isLoadingMore = false;
  currentLimit = 10;
  currentOffset = 0;
  
  // Commentaires agrégés expansés (voir les sous-messages)
  expandedAggregatedComments: Set<string> = new Set();
  
  // Réponses expansées par commentaire (toggle "Voir N réponses")
  expandedReplies: Set<string> = new Set();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private commentService: CommentService,
    private modalController: ModalController,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({
      chevronDownOutline, chatbubblesOutline, chatbubbleOutline, 
      closeOutline, send, happyOutline, heartOutline,
      layersOutline, returnDownForwardOutline
    });
  }

  ngOnInit() {
    this.loadComments();
  }

  async loadComments(loadMore: boolean = false) {
    if (loadMore) {
      this.isLoadingMore = true;
    } else {
      this.isLoading = true;
      this.currentOffset = 0;
    }
    
    try {
      const commentsData = await this.commentService.getComments(
        this.contentId, 
        this.currentLimit, 
        this.currentOffset,
        this.currentUser?.id
      ).toPromise() || [];
      
      if (loadMore) {
        this.comments = [...this.comments, ...commentsData];
      } else {
        this.comments = commentsData;
      }
      
      this.hasMoreComments = commentsData.length === this.currentLimit;
      this.currentOffset += commentsData.length;
      
    } catch (error) {
      console.error('Erreur lors du chargement des commentaires', error);
      if (!loadMore) this.comments = [];
    } finally {
      this.isLoading = false;
      this.isLoadingMore = false;
      this.cdr.markForCheck();
    }
    return of(null);
  }

  async loadMoreComments() {
    if (!this.isLoadingMore && this.hasMoreComments) {
      await this.loadComments(true);
    }
  }

  // Toggle pour les commentaires agrégés (voir les sous-messages du même user)
  toggleAggregatedComments(commentId: string) {
    if (this.expandedAggregatedComments.has(commentId)) {
      this.expandedAggregatedComments.delete(commentId);
    } else {
      this.expandedAggregatedComments.add(commentId);
    }
    this.cdr.markForCheck();
  }

  // Toggle pour afficher/cacher les réponses d'un commentaire
  toggleReplies(commentId: string) {
    if (this.expandedReplies.has(commentId)) {
      this.expandedReplies.delete(commentId);
    } else {
      this.expandedReplies.add(commentId);
    }
    this.cdr.markForCheck();
  }

  startReply(comment: Comment) {
    this.replyingTo = comment;
    this.replyText = '';
    this.isReplying = true;
    this.showEmojiPicker = false;
    this.cdr.markForCheck();
  }

  cancelReply() {
    this.replyingTo = null;
    this.replyText = '';
    this.isReplying = false;
    this.cdr.markForCheck();
  }

  async addReply() {
    if (!this.replyText.trim() || !this.replyingTo || !this.currentUser?.id) return;
    
    this.isPosting = true;
    try {
      const reply = await this.commentService.addReply(this.replyingTo, {
        contentId: this.contentId,
        userId: this.currentUser.id,
        userAvatar: this.currentUser.avatar,
        username: this.currentUser.username || 'Utilisateur',
        text: this.replyText.trim()
      }).toPromise();
      
      if (this.replyingTo.replies) {
        this.replyingTo.replies.push(reply as Comment);
      } else {
        this.replyingTo.replies = [reply as Comment];
      }
      this.replyingTo.replyCount = (this.replyingTo.replyCount || 0) + 1;
      
      // Auto-expand les réponses après avoir posté
      if (this.replyingTo.id) {
        this.expandedReplies.add(this.replyingTo.id);
      }
      
      this.cancelReply();
      
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la réponse:', error);
    } finally {
      this.isPosting = false;
      this.cdr.markForCheck();
    }
  }

  async addComment() {
    if (!this.newComment.trim() || !this.currentUser?.id) return;

    this.isPosting = true;
    try {
      const comment: Omit<Comment, 'id' | 'createdAt' | 'likes'> = {
        contentId: this.contentId,
        userId: this.currentUser.id,
        username: this.currentUser.username || 'Utilisateur',
        userAvatar: this.currentUser.avatar,
        text: this.newComment,
        parentId: undefined
      };

      const newComment = await this.commentService.addComment(comment).toPromise();
      if (newComment) {
        this.comments = [newComment, ...this.comments];
        this.newComment = '';
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout du commentaire', error);
    } finally {
      this.isPosting = false;
      this.cdr.markForCheck();
    }
  }

  async toggleLike(comment: Comment) {
    if (!this.currentUser?.id) return;

    try {
      const wasLiked = comment.isLiked ?? false;
      const userId = this.currentUser.id;
      
      comment.isLiked = !wasLiked;
      comment.likes = wasLiked ? (comment.likes - 1) : (comment.likes + 1);
      
      if (!comment.likedBy) comment.likedBy = [];
      
      if (wasLiked) {
        comment.likedBy = comment.likedBy.filter(id => id !== userId);
      } else {
        if (!comment.likedBy.includes(userId)) comment.likedBy.push(userId);
      }
      
      await this.commentService.toggleLike(
        comment.id!, userId, wasLiked
      ).toPromise();
      
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Erreur lors du like', error);
      comment.isLiked = !comment.isLiked;
      comment.likes += comment.isLiked ? 1 : -1;
      this.cdr.markForCheck();
    }
  }

  toggleEmojiPicker() {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  addEmoji(emoji: string) {
    if (this.isReplying) {
      this.replyText += emoji;
    } else {
      this.newComment += emoji;
    }
    this.showEmojiPicker = false;
    this.cdr.markForCheck();
  }

  onCommentFocus() {
    this.showEmojiPicker = false;
  }

  onImageError(event: any) {
    event.target.src = 'assets/avatar-default.png';
  }

  dismiss() {
    this.modalController.dismiss({ isPost: this.isPosting });
  }
}