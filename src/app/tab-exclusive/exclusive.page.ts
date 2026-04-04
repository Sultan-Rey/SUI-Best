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
import { ExclusiveService } from '../../services/Service_exclusive_content/exclusive-service';
import { ExclusiveContent, ExclusiveContentType, Series } from '../../models/Content';
import { Router } from '@angular/router';

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
  public subscriptionStatus: string = '';
  
  constructor(
    private toastCtrl: ToastController,
    private exclusiveService: ExclusiveService,
    private router: Router
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

   getSubscriptionStatus(status: string) {
  this.subscriptionStatus = status; // On stocke la valeur
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
      // Afficher les séries (converties en contenus pour l'affichage)
      this.featuredItems$ = this.exclusiveService.getSeries().pipe(
        map(series => series.map(s => this.convertSeriesToContent(s)))
      );
      this.allContents$ = this.exclusiveService.getSeries().pipe(
        map(series => series.map(s => this.convertSeriesToContent(s)))
      );
    } else {
      // Filtrer les contenus par type (utilise les vues optimisées)
      this.featuredItems$ = this.exclusiveService.getFeaturedContents().pipe(
        map(contents => filterId === 'all' ? contents : contents.filter(c => c.type === filterId))
      );
      this.allContents$ = this.exclusiveService.getAllContents({ 
        type: filterId === 'all' ? undefined : filterId as ExclusiveContentType 
      });
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  onSubscribe(): void {
    this.router.navigate(['/subscription']);
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

  /**
   * Convertit une Series en ExclusiveContent pour l'affichage unifié
   */
  private convertSeriesToContent(series: Series): ExclusiveContent {
    return {
      id: series.id,
      userId: 'current-user', // Sera rempli par le backend
      title: series.title,
      description: series.description || '',
      author: series.author,
      type: series.type as ExclusiveContentType,
      status: 'published' as any,
      
      // Média
      media: {
        videoFile: undefined,
        thumbnail: series.thumbnail,
        mimeType: 'video/mp4',
        fileSize: 0,
        duration: 0
      },
      
      // Monétisation
      locked: false, // Les séries sont généralement déverrouillées
      price: series.price,
      isLive: false,
      
      // Série (pour l'affichage)
      series: {
        isSeries: true,
        seriesId: series.id,
        seriesTitle: series.title,
        episodeNumber: undefined,
        totalEpisodes: series.totalEpisodes,
        season: undefined
      },
      
      created_at: series.created_at,
      updatedAt: series.updated_at
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