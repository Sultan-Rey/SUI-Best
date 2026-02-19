import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton, IonSpinner, IonIcon, IonAvatar, IonButton, IonFooter } from '@ionic/angular/standalone';
import { Content } from 'src/models/Content';
import { ActivatedRoute, Router } from '@angular/router';
import { CreationService } from 'src/services/CREATION_SERVICE/creation-service';
import { Auth, AuthUser } from 'src/services/AUTH/auth';
import { User } from 'src/models/User';
interface Comment {
  id?: string;
  text: string;
  userId: string;
  user: {
    id: string;
    username: string;
    avatar?: string;
  };
  timestamp: Date;
  likes: number;
}
@Component({
  selector: 'app-content-detail',
  templateUrl: './content-detail.page.html',
  styleUrls: ['./content-detail.page.scss'],
  standalone: true,
  imports: [IonFooter, IonButton, IonAvatar, IonIcon, IonSpinner, IonBackButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class ContentDetailPage implements OnInit {
  @ViewChild('commentInput') commentInput!: ElementRef<HTMLIonInputElement>;
  @ViewChild('commentsSection') commentsSection!: ElementRef<HTMLDivElement>;

  content: Content | null = null;
  isLoading = true;
  error: string | null = null;
  isLiked = false;
  isSaved = false;
  newComment = '';
  comments: Comment[] = [];
  currentUser: AuthUser | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private creationService: CreationService,
    private authService: Auth
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    const contentId = this.route.snapshot.paramMap.get('id');
    if (contentId) {
      this.loadContent(contentId);
      this.loadComments(contentId);
    } else {
      this.error = 'Aucun contenu spécifié';
      this.isLoading = false;
    }
  }

  getFullFileUrl(relativePath: string): string {
    const apiUrl = 'http://localhost:3000'; 
    const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
    return `${apiUrl}/${cleanPath}`;
  }

  private loadContent(id: string) {
    this.isLoading = true;
    this.creationService.getContentById(id).subscribe({
      next: (content) => {
        this.content = content;
        this.isLoading = false;
        // Vérifier si l'utilisateur actuel a aimé ce contenu
        if (content.likeCount && this.currentUser) {
          this.isLiked = false; //content.likeCount.some(like => like.userId === this.currentUser?.id);
        }
      },
      error: (err) => {
        console.error('Erreur lors du chargement du contenu:', err);
        this.error = 'Impossible de charger le contenu';
        this.isLoading = false;
      }
    });
  }

  private loadComments(contentId: string) {
    // Implémentez le chargement des commentaires depuis votre service
    // Exemple:
    // this.creationService.getComments(contentId).subscribe(comments => {
    //   this.comments = comments;
    // });
  }

  toggleLike() {
    if (!this.content || !this.currentUser) return;

    this.isLiked = !this.isLiked;
    
    if (this.isLiked) {
      // Ajouter un like
      if (this.content.likeCount !== undefined) {
        this.content.likeCount++;
      }
      // this.creationService.likeContent(this.content.id).subscribe();
    } else {
      // Retirer le like
      if (this.content.likeCount && this.content.likeCount > 0) {
        this.content.likeCount--;
      }
      // this.creationService.unlikeContent(this.content.id).subscribe();
    }
  }

  toggleSave() {
    this.isSaved = !this.isSaved;
    // Implémentez la logique de sauvegarde
  }

  focusCommentInput() {
    setTimeout(() => {
      this.commentInput.nativeElement.setFocus();
    }, 100);
  }

  addComment() {
    if (!this.newComment.trim() || !this.content || !this.currentUser) return;

    const newComment: Comment = {
      id: Date.now().toString(),
      userId: this.currentUser.id as string,
      user: {
        id: this.currentUser.id as string,
        username: this.currentUser.email || 'Utilisateur',
        avatar: this.currentUser.user_type
      },
      text: this.newComment,
      timestamp: new Date(),
      likes: 0
    };

    this.comments.push(newComment);
    this.newComment = '';

    // Faire défiler vers le bas pour voir le nouveau commentaire
    setTimeout(() => {
      this.commentsSection.nativeElement.scrollTop = this.commentsSection.nativeElement.scrollHeight;
    }, 100);

    // Envoyer le commentaire au serveur
    // this.creationService.addComment(this.content.id, newComment).subscribe();
  }

  likeComment(commentId: string) {
    // Implémentez la logique pour aimer un commentaire
    //const comment = this.comments.find(c => c.id === commentId);
    //if (comment) {
      //comment.likeCount++;
      // this.creationService.likeComment(commentId).subscribe();
    //}
  }

  scrollToComments() {
    this.commentsSection.nativeElement.scrollIntoView({ behavior: 'smooth' });
  }

  toggleMedia() {
    // Implémentez la logique pour afficher le média en plein écran
  }

  sharePost() {
    // Implémentez la logique de partage
    if (this.content) {
      const shareData = {
        
        text: this.content.description,
        url: window.location.href
      };
      
      if (navigator.share) {
        navigator.share(shareData).catch(console.error);
      } else {
        // Fallback pour les navigateurs qui ne supportent pas l'API Web Share
        console.log('Partage non supporté sur ce navigateur');
      }
    }
  }
}
