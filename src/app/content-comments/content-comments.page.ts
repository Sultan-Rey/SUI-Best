// src/app/content-comments/content-comments.page.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { send,chatbubbleOutline } from 'ionicons/icons';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonItem, 
  IonIcon, IonButtons, IonList, IonAvatar, IonLabel, IonFooter, 
  IonSpinner, IonTextarea, IonBackButton
} from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { CommentService } from '../../services/COMMENTS_SERVICE/comment-service.js';
import { Comment } from '../../models/Comment.js';
import { UserProfile } from '../../models/User.js';


@Component({
  selector: 'app-content-comments',
  templateUrl: './content-comments.page.html',
  styleUrls: ['./content-comments.page.scss'],
  standalone: true,
  imports: [
    IonSpinner, IonFooter, IonLabel, IonAvatar, IonList, 
    IonButtons, IonIcon, IonItem, IonButton, IonContent, 
    IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule,
    IonTextarea, IonBackButton
  ]
})
export class ContentCommentsPage implements OnInit {
  contentId!: string;
  currentUser!: UserProfile;
  comments: Comment[] = [];
  newComment = '';
  isLoading = false;
  isPosting = false;

 constructor(
    private route: ActivatedRoute,
    private router: Router,
    private commentService: CommentService
  ) {
    // Récupérer l'ID du contenu depuis l'URL
    this.contentId = this.route.snapshot.paramMap.get('id') || '';
    
    // Récupérer l'utilisateur depuis les extras de navigation
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras.state as { currentUser: UserProfile };
    
    if (state?.currentUser) {
      this.currentUser = state.currentUser;
    } else {
      // Rediriger si l'utilisateur n'est pas défini
      this.router.navigate(['/tabs/home']);
    }
  }

  ngOnInit() {
    addIcons({
      send,
      chatbubbleOutline
    });
    this.loadComments();
  }

  async loadComments() {
    this.isLoading = true;
    try {
      this.comments = await this.commentService.getComments(this.contentId).toPromise() || [];
    } catch (error) {
      console.error('Erreur lors du chargement des commentaires', error);
    } finally {
      this.isLoading = false;
    }
    return of(null);
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
    }
  }

  async toggleLike(comment: Comment) {
  if (!this.currentUser?.id) return;

  try {
    const wasLiked = comment.isLiked ?? false; // Utilisation de l'opérateur de coalescence nulle
    comment.isLiked = !wasLiked;
    comment.likes = wasLiked ? (comment.likes - 1) : (comment.likes + 1);
    
    await this.commentService.toggleLike(
      comment.id!,
      this.currentUser.id,
      wasLiked
    ).toPromise();
  } catch (error) {
    console.error('Erreur lors du like', error);
    // Revert UI on error
    if (comment.isLiked !== undefined) {
      comment.isLiked = !comment.isLiked;
      comment.likes += comment.isLiked ? 1 : -1;
    }
  }
}

  goBack() {
    this.router.navigate(['/tabs/home']);
  }

  onImageError(event: any) {
    event.target.src = 'assets/avatar-default.png';
  }
}