import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { IonIcon, IonInput, IonButton } from "@ionic/angular/standalone";
import { FormsModule } from '@angular/forms';
import { CommentService } from 'src/services/COMMENTS_SERVICE/comment-service';
import { Content } from 'src/models/Content';
import { UserProfile } from 'src/models/User';
import { ToastController} from '@ionic/angular';
import { NgIf, NgFor} from '@angular/common';
@Component({
  selector: 'app-quick-comment',
  templateUrl: './quick-comment.component.html',
  styleUrls: ['./quick-comment.component.scss'],
  imports:[NgIf, NgFor, IonIcon, IonInput, IonButton, FormsModule]
})
export class QuickCommentComponent  implements OnInit {
  @Input() CurrentPost!: Content;
  @Input() CurrentUserProfile!: UserProfile;
  @Output() commentCount = new EventEmitter<number>();
 // Comment functionality
  newComment: string = '';
  showEmojiPicker: boolean = false;
  emojis: string[] = ['❤️', '🔥', '😂', '😍', '👏', '🎉', '😢', '😡', '👍', '👎', '🔥', '💯', '✨', '🌟', '💪', '🙏', '😊', '😎', '🤔', '👀'];
  
  // Animation properties
  isAnimating: boolean = false;
  animationState: string = '';
  projectedComment: string = '';
 
  constructor(private commentService: CommentService, private cdr: ChangeDetectorRef, private toastController: ToastController) { }

  ngOnInit() {}

  //#region Comment System
    toggleEmojiPicker() {
      this.showEmojiPicker = !this.showEmojiPicker;
    }
  
    addEmoji(emoji: string) {
      this.newComment += emoji;
      this.showEmojiPicker = false;
      this.cdr.markForCheck();
    }
  
    onCommentFocus() {
      this.showEmojiPicker = false;
    }
  
    async postComment() {
      if (!this.newComment?.trim() || !this.CurrentUserProfile?.id) return;
      
      if (!this.CurrentPost) return;

      // Sauvegarder le commentaire pour l'animation
      this.projectedComment = this.newComment.trim();
      
      try {
        await this.commentService.addComment({
          contentId: this.CurrentPost.id!,
          userId: this.CurrentUserProfile.id,
          userAvatar: this.CurrentUserProfile.avatar,
          username: this.CurrentUserProfile.username || 'Utilisateur',
          text: this.newComment.trim()
        }).toPromise();
        
        // Déclencher l'animation de projection
        this.startProjectionAnimation();
        
        // Émettre le nouveau compteur après un court délai
        setTimeout(async () => {
          const count = await this.commentService.getCommentCount(this.CurrentPost.id as string).toPromise() || 0;
          this.commentCount.emit(count);
        }, 400);
        
        this.newComment = '';
        this.showEmojiPicker = false;
        this.cdr.markForCheck();
      } catch (error) {
        console.error('Erreur lors de l\'ajout du commentaire:', error);
        const toast = await this.toastController.create({
          message: 'Erreur lors de l\'ajout du commentaire',
          duration: 3000,
          color: 'danger'
        });
        await toast.present();
      }
    }

    startProjectionAnimation() {
      this.isAnimating = true;
      
      // Cacher l'animation après 1000ms (correspond à la durée CSS)
      setTimeout(() => {
        this.isAnimating = false;
        this.cdr.markForCheck();
      }, 1000);
    }
    //#endregion
  

}
