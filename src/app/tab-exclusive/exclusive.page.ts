import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponentComponent } from '../components/header-component/header-component.component';
import {
  IonContent,
  IonIcon,
  ToastController,
  ModalController
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
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ExclusiveService } from '../../services/Service_exclusive_content/exclusive-service';
import { ExclusiveContent, ExclusiveContentStatus, ExclusiveContentType, Series } from '../../models/Content';
import { Router } from '@angular/router';
import { ModalPaymentComponent } from '../components/modal-payment/modal-payment.component';

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
  providers: [ModalController],
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
    private modalController: ModalController,
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
    // 1. Récupérer les contenus mis en avant (featured) via le filtre par statut du service
    this.featuredItems$ = this.exclusiveService.getByStatus('featured').pipe(
      catchError(error => {
        console.error('Erreur lors du chargement des contenus vedettes', error);
        return of([]);
      })
    );

    // 2. Récupérer tous les contenus publiés par défaut
    this.allContents$ = this.exclusiveService.getByStatus('published').pipe(
      catchError(error => {
        console.error('Erreur lors du chargement de tous les contenus', error);
        return of([]);
      })
    );

    // 3. Récupérer toutes les séries (Le service gère en interne la ressource 'series')
    this.series$ = this.exclusiveService.getAllSeries().pipe(
      catchError(error => {
        console.error('Erreur lors du chargement des séries', error);
        return of([]);
      })
    );
  }

  // ── Filter ──────────────────────────────────────────────────────────────────

  setFilter(filterId: string): void {
    this.activeFilter = filterId;
    
    if (filterId === 'series') {
      // Afficher uniquement les séries (converties en ExclusiveContent pour l'affichage unifié)
      const unifiedSeries$ = this.exclusiveService.getAllSeries().pipe(
        map(series => series.map(s => this.convertSeriesToContent(s))),
        catchError(() => of([]))
      );
      
      this.featuredItems$ = unifiedSeries$;
      this.allContents$ = unifiedSeries$;
    } else {
      // Filtrer dynamiquement les contenus selon leur type
      if (filterId === 'all') {
        // Retour aux données initiales non filtrées (publiées ou vedettes)
        this.featuredItems$ = this.exclusiveService.getByStatus('archived').pipe(catchError(() => of([])));
        this.allContents$ = this.exclusiveService.getByStatus('published').pipe(catchError(() => of([])));
      } else {
        // Appel aux méthodes natives de filtrage par type exposées par l'ExclusiveService
        this.featuredItems$ = this.exclusiveService.getByType(filterId).pipe(
          map(contents => contents.filter(c => c.status === ExclusiveContentStatus.ARCHIVED)),
          catchError(() => of([]))
        );
        
        this.allContents$ = this.exclusiveService.getByType(filterId).pipe(
          map(contents => contents.filter(c => c.status === ExclusiveContentStatus.PUBLISHED)),
          catchError(() => of([]))
        );
      }
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

  async onBuy(item: ExclusiveContent, event: Event) {
    event.stopPropagation();
    const modal = await this.modalController.create({
      component: ModalPaymentComponent,
      cssClass: 'auto-height',
      componentProps: { OrderAmount: item.currency?.value },
      initialBreakpoint: 0.90,
      breakpoints: [0, 0.90, 1],
      handle: true
    });
                
    await modal.present();
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
      viewCount: series.viewCount || 0,
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
      currency: {type:'coin', value: series.price || 0},
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
      updated_at: series.updated_at
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