import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponentComponent } from '../components/header-component/header-component.component';
import {
  IonContent,
  IonIcon,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  searchOutline,
  eyeOutline,
  timeOutline,
  lockClosedOutline,
  play,
  starOutline,
  videocamOutline,
  imagesOutline,
} from 'ionicons/icons';
import { Observable, combineLatest, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { ExclusiveService } from '../../services/EXCLUSIVE_SERVICE/exclusive-service';
import { ExclusiveContent, Series } from '../../models/Content';

// ─── Models ───────────────────────────────────────────────────────────────────

export interface Author {
  name: string;
  initials: string;
  color: string; // CSS gradient string
}

export interface FilterTab {
  id: string;
  label: string;
  icon?: string;
  prefix?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-exclusive',
  templateUrl: 'exclusive.page.html',
  styleUrls: ['exclusive.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonIcon, HeaderComponentComponent],
})
export class ExclusivePage implements OnInit {

  searchQuery = '';
  activeFilter = 'all';

  filterTabs: FilterTab[] = [
    { id: 'all',        label: 'Tout',      prefix: '✦' },
    { id: 'video',      label: 'Vidéos',    icon: 'videocam-outline' },
    { id: 'behind',     label: 'Coulisses', icon: 'images-outline' },
    { id: 'masterclass',label: 'Masterclass',icon: 'star-outline' },
    { id: 'series',     label: 'Séries',    icon: 'play' },
  ];

  // Données observables
  featuredItems$!: Observable<ExclusiveContent[]>;
  allContents$!: Observable<ExclusiveContent[]>;
  series$!: Observable<Series[]>;

  constructor(
    private toastCtrl: ToastController,
    private exclusiveService: ExclusiveService
  ) {
    addIcons({
      searchOutline,
      eyeOutline,
      timeOutline,
      lockClosedOutline,
      play,
      starOutline,
      videocamOutline,
      imagesOutline,
    });
  }

  ngOnInit() {
    this.loadData();
  }

  // ── Data Loading ─────────────────────────────────────────────────────────────

  loadData(): void {
    this.featuredItems$ = this.exclusiveService.getFeaturedContents();
    this.allContents$ = this.exclusiveService.getAllContents();
    this.series$ = this.exclusiveService.getSeries();
  }

  // ── Filter ──────────────────────────────────────────────────────────────────

  setFilter(filterId: string): void {
    this.activeFilter = filterId;
    
    // Mettre à jour les observables avec les filtres
    if (filterId === 'series') {
      // Afficher les séries
      this.featuredItems$ = this.exclusiveService.getSeries().pipe(
        map(series => series.map(s => this.convertSeriesToContent(s)))
      );
      this.allContents$ = this.exclusiveService.getSeries().pipe(
        map(series => series.map(s => this.convertSeriesToContent(s)))
      );
    } else {
      // Filtrer les contenus par type
      this.featuredItems$ = this.exclusiveService.getFeaturedContents().pipe(
        map(contents => filterId === 'all' ? contents : contents.filter(c => c.type === filterId))
      );
      this.allContents$ = this.exclusiveService.getAllContents({ type: filterId === 'all' ? undefined : filterId as any });
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  onSubscribe(): void {
    this.showToast('Redirection vers l\'abonnement Premium…');
  }

  onContentTap(item: ExclusiveContent | Series): void {
    if ('locked' in item && item.locked) {
      this.showToast(`Acheter pour déverrouiller : ${item.title}`);
    } else if ('episodeNumber' in item && item.episodeNumber) {
      // C'est un épisode de série
      this.showToast(`Lecture épisode ${item.episodeNumber} : ${item.title}`);
    } else {
      this.showToast(`Lecture : ${item.title}`);
    }
  }

  onBuy(item: ExclusiveContent, event: Event): void {
    event.stopPropagation();
    this.showToast(`Achat en cours : ${item.title} — ${item.price}€`);
  }

  onWatch(item: ExclusiveContent, event: Event): void {
    event.stopPropagation();
    this.showToast(`Lecture : ${item.title}`);
  }

  onSeriesTap(series: Series): void {
    this.showToast(`Ouverture de la série : ${series.title}`);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private convertSeriesToContent(series: Series): ExclusiveContent {
    return {
      id: series.id,
      userId: '', // Sera rempli par le backend
      challengeId: '',
      commentIds: [],
      fileUrl: '',
      mimeType: 'video/series',
      fileSize: 0,
      cadrage: 'default',
      isPublic: true,
      allowDownloads: true,
      allowComments: true,
      source: 'gallery' as any,
      status: 'published' as any,
      created_at: series.created_at,
      
      // Propriétés ExclusiveContent
      title: series.title,
      author: series.author,
      thumbnail: series.thumbnail,
      locked: false, // Les séries sont généralement déverrouillées
      price: series.price,
      isLive: false,
      type: series.type,
      
      // Propriétés série
      seriesId: series.id,
      seriesTitle: series.title,
      isSeries: true,
      totalEpisodes: series.totalEpisodes,
      viewCount: series.viewCount,
      likeCount: series.likeCount,
      
      // Métadonnées calculées
      description: series.description,
      duration: series.duration ? Number(series.duration) : undefined,
    };
  }

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'bottom',
      cssClass: 'ex-toast',
    });
    await toast.present();
  }
}