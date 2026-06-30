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
  IonButtons,
  IonChip,
  IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  play,
  chevronBack,
  heart,
  heartOutline,
  bookmark,
  bookmarkOutline,
  timeOutline,
  eyeOutline,
  starOutline
} from 'ionicons/icons';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ExclusiveContentService } from '../../../../services/Service_exclusive_content/exclusive-service';
import { Series, ExclusiveContent } from '../../../../models/Content';
import { MediaUrlPipe } from '../../../utils/pipes/mediaUrlPipe/media-url-pipe';
import { AsyncPipe } from '@angular/common';
import { Auth } from '../../../../services/AUTH/auth';

@Component({
  selector: 'app-series-detail',
  templateUrl: 'series-detail.page.html',
  styleUrls: ['series-detail.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButton,
    IonIcon,
    IonBackButton,
    IonButtons,
    IonSpinner,
    MediaUrlPipe,
    AsyncPipe
  ]
})
export class SeriesDetailPage implements OnInit {
  series$!: Observable<Series>;
  episodes$!: Observable<ExclusiveContent[]>;
  seriesId: string = '';
  
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
      chevronBack,
      heart,
      heartOutline,
      bookmark,
      bookmarkOutline,
      timeOutline,
      eyeOutline,
      starOutline
    });
  }

  ngOnInit() {
    this.seriesId = this.route.snapshot.paramMap.get('id') || '';
    if (this.seriesId) {
      this.loadSeries();
    } else {
      this.router.navigate(['/tab-exclusive']);
    }
  }

  private loadSeries(): void {
    this.series$ = this.exclusiveService.getSeriesById(this.seriesId).pipe(
      catchError(error => {
        console.error('Erreur lors du chargement de la série:', error);
        this.router.navigate(['/tab-exclusive']);
        return of({} as Series);
      })
    );
    
    // Charger les épisodes de la série
    this.episodes$ = this.exclusiveService.getAll().pipe(
      map(contents => contents.filter(c => 
        c.series?.seriesId === this.seriesId &&
        c.status === 'published'
      )),
      catchError(error => {
        console.error('Erreur lors du chargement des épisodes:', error);
        return of([]);
      })
    );
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  /**
   * Vérifie si l'utilisateur actuel a accès à un contenu (son ID est dans watchers)
   */
  hasAccess(item: ExclusiveContent): boolean {
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
  isLockedForUser(item: ExclusiveContent): boolean {
    if (item.locked) {
      return !this.hasAccess(item);
    }
    return false;
  }

  onEpisodeTap(episode: ExclusiveContent): void {
    if (this.isLockedForUser(episode)) {
      // Ouvrir le modal de paiement
      console.log('Contenu verrouillé, paiement requis');
    } else {
      // Naviguer vers le lecteur
      this.router.navigate(['/content-player', episode.id]);
    }
  }

  toggleLike(): void {
    this.isLiked = !this.isLiked;
  }

  toggleBookmark(): void {
    this.isBookmarked = !this.isBookmarked;
  }

  goBack(): void {
    this.router.navigate(['/tab-exclusive']);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  getSeriesIcon(type: string): string {
    switch (type) {
      case 'masterclass':
        return 'star-outline';
      case 'behind':
        return 'images-outline';
      case 'series':
        return 'play';
      default:
        return 'play';
    }
  }
}
