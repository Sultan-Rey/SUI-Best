import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  IonIcon,
  IonBackButton,
  IonButtons, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  play,
  pause,
  volumeHigh,
  volumeMute,
  chevronBack,
  heart,
  heartOutline,
  shareSocial,
  bookmark,
  bookmarkOutline
} from 'ionicons/icons';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ExclusiveContentService } from '../../../../services/Service_exclusive_content/exclusive-service';
import { ExclusiveContent, ExclusiveContentType } from '../../../../models/Content';
import { MediaUrlPipe } from '../../../utils/pipes/mediaUrlPipe/media-url-pipe';
import { AsyncPipe } from '@angular/common';
import { Auth } from '../../../../services/AUTH/auth';

@Component({
  selector: 'app-content-player',
  templateUrl: 'content-player.page.html',
  styleUrls: ['content-player.page.scss'],
  standalone: true,
  imports: [IonSpinner, 
    CommonModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButton,
    IonIcon,
    IonBackButton,
    IonButtons,
    MediaUrlPipe,
    AsyncPipe
  ]
})
export class ContentPlayerPage implements OnInit {
  content$!: Observable<ExclusiveContent>;
  contentId: string = '';
  
  // Player state
  isPlaying: boolean = false;
  isMuted: boolean = false;
  currentTime: number = 0;
  duration: number = 0;
  isLiked: boolean = false;
  isBookmarked: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private exclusiveService: ExclusiveContentService,
    private auth: Auth
  ) {
    addIcons({
      play,
      pause,
      volumeHigh,
      volumeMute,
      chevronBack,
      heart,
      heartOutline,
      shareSocial,
      bookmark,
      bookmarkOutline
    });
  }

  ngOnInit() {
    this.contentId = this.route.snapshot.paramMap.get('id') || '';
    if (this.contentId) {
      this.loadContent();
    } else {
      this.router.navigate(['/tab-exclusive']);
    }
  }

  private loadContent(): void {
    this.content$ = this.exclusiveService.getById(this.contentId).pipe(
      map(content => {
        // Vérifier si l'utilisateur a accès au contenu
        if (this.isLockedForUser(content)) {
          console.log('Contenu verrouillé pour l\'utilisateur, redirection');
          this.router.navigate(['/tab-exclusive']);
          return {} as ExclusiveContent;
        }
        return content;
      }),
      catchError(error => {
        console.error('Erreur lors du chargement du contenu:', error);
        this.router.navigate(['/tab-exclusive']);
        return of({} as ExclusiveContent);
      })
    );
  }

  /**
   * Vérifie si l'utilisateur actuel a accès à un contenu (son ID est dans watchers)
   */
  private hasAccess(item: ExclusiveContent): boolean {
    const currentUser = this.auth.getCurrentUser();
    if (!currentUser || !currentUser.id) return false;
    
    if (item.watchers) {
      return item.watchers.includes(currentUser.id);
    }
    return false;
  }

  /**
   * Vérifie si le contenu est verrouillé pour l'utilisateur actuel
   * (locked=true et utilisateur n'a pas accès via watchers)
   */
  private isLockedForUser(item: ExclusiveContent): boolean {
    if (item.locked) {
      return !this.hasAccess(item);
    }
    return false;
  }

  // ── Player Controls ─────────────────────────────────────────────────────

  togglePlay(): void {
    this.isPlaying = !this.isPlaying;
  }

  toggleMute(): void {
    this.isMuted = !this.isMuted;
  }

  seekTo(time: number): void {
    this.currentTime = time;
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  toggleLike(): void {
    this.isLiked = !this.isLiked;
  }

  toggleBookmark(): void {
    this.isBookmarked = !this.isBookmarked;
  }

  shareContent(): void {
    if (navigator.share) {
      navigator.share({
        title: 'Contenu exclusif',
        text: 'Regarde ce contenu exclusif sur Best Academy',
        url: window.location.href
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/tab-exclusive']);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  getContentIcon(type: ExclusiveContentType): string {
    switch (type) {
      case ExclusiveContentType.VIDEO:
        return 'videocam-outline';
      case ExclusiveContentType.BEHIND:
        return 'images-outline';
      case ExclusiveContentType.MASTERCLASS:
        return 'star-outline';
      case ExclusiveContentType.SERIES:
        return 'play';
      default:
        return 'videocam-outline';
    }
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
