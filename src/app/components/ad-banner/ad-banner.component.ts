// ad-banner.component.ts
import { Component, Input, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { AdContent, AdStatus, AdType } from 'src/models/Ads';
import { AdService } from 'src/services/Service_ads/ad-service';
import { MediaUrlPipe } from 'src/app/utils/pipes/mediaUrlPipe/media-url-pipe';
import { Subscription, interval, takeWhile, switchMap, of, catchError, finalize } from 'rxjs';
import { NgIf, NgStyle, AsyncPipe, DatePipe } from '@angular/common';

interface AdHistoryState {
  seenAdIds: string[];
  lastAdId: string | null;
  lastImpressionTime: number;
  adFrequency: Record<string, number>;
  sessionStart: number;
}

@Component({
  selector: 'app-ad-banner',
  templateUrl: './ad-banner.component.html',
  styleUrls: ['./ad-banner.component.scss'],
  imports: [NgIf, MediaUrlPipe, AsyncPipe],
  standalone: true
})
export class AdBannerComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() placement!: 'BANNER' | 'VIDEO_ROLL' | 'INTERSTITIAL' | 'GLOBAL';
  @Input() autoPlay = true;
  @Input() rotationInterval = 5000;
  @Input() maxFrequencyPerSession = 5;
  
  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;

  // État
  currentAd: AdContent | null = null;
  nextAd: AdContent | null = null;
  isVideoPlaying = false;
  isLoading = true;
  error: string | null = null;
  isClosed = false;
  isPaused = false;
  currentIndex = 0;
  progress = 0;
  isTransitioning = false;


  // Privé
  private ads: AdContent[] = [];
  private subscriptions: Subscription[] = [];
  private rotationTimer: Subscription | null = null;
  private isDestroyed = false;
  private autoCloseTimer: any = null;
   private reopenTimer: any = null;
  private readonly AUTO_CLOSE_DELAYS = {
    'BANNER': 8,        // 8 secondes
    'VIDEO_ROLL': 15,   // 15 secondes
    'INTERSTITIAL': 5,  // 5 secondes
    'GLOBAL': 10        // 10 secondes
  };
  private readonly REOPEN_DELAY = 30; // 🔥 30 secondes avant réapparition

  public countdown: number = 0;


  
  
  // Session Storage
  private readonly STORAGE_KEY = 'ad_banner_state';
  private sessionState: AdHistoryState;

  constructor(
    private adService: AdService,
    private cdr: ChangeDetectorRef
  ) {
    this.sessionState = this.loadSessionState();
  }

  ngOnInit(): void {
    setTimeout(()=>{
      this.loadAds();
    }, 300);
  }

  ngAfterViewInit(): void {
    this.setupVideoEvents();
  }

  ngOnDestroy(): void {
  this.isDestroyed = true;
  this.clearAutoCloseTimer();
  this.clearReopenTimer(); // 🔥 AJOUTER
  this.clearAllSubscriptions();
  this.pauseVideo();
  this.saveSessionState();
}

  // ==================== SESSION STORAGE ====================

  private loadSessionState(): AdHistoryState {
    try {
      const stored = sessionStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored);
        const sessionAge = Date.now() - state.sessionStart;
        if (sessionAge < 24 * 60 * 60 * 1000) {
          return state;
        }
      }
    } catch (error) {
      console.warn('Failed to load session state:', error);
    }

    return {
      seenAdIds: [],
      lastAdId: null,
      lastImpressionTime: 0,
      adFrequency: {},
      sessionStart: Date.now()
    };
  }

  private saveSessionState(): void {
    try {
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.sessionState));
    } catch (error) {
      console.warn('Failed to save session state:', error);
    }
  }

  private recordAdImpression(adId: string): void {
    if (!adId) return;

    if (!this.sessionState.seenAdIds.includes(adId)) {
      this.sessionState.seenAdIds.push(adId);
    }
    
    this.sessionState.adFrequency[adId] = (this.sessionState.adFrequency[adId] || 0) + 1;
    this.sessionState.lastAdId = adId;
    this.sessionState.lastImpressionTime = Date.now();
    
    this.saveSessionState();
  }

  private hasAdBeenSeenRecently(adId: string): boolean {
    if (!adId) return false;
    
    const lastSeenIndex = this.sessionState.seenAdIds.lastIndexOf(adId);
    if (lastSeenIndex === -1) return false;
    
    const timeSinceLastSeen = Date.now() - this.sessionState.lastImpressionTime;
    return timeSinceLastSeen < 30 * 60 * 1000;
  }

  private getAdFrequency(adId: string): number {
    return this.sessionState.adFrequency[adId] || 0;
  }

  private isAdExhausted(adId: string): boolean {
    return this.getAdFrequency(adId) >= this.maxFrequencyPerSession;
  }

  // ==================== CHARGEMENT ====================

  private loadAds(): void {
    this.isLoading = true;
    this.error = null;

    const sub = this.adService.getAdsByStatus(AdStatus.ACTIVE)
      .pipe(
        switchMap(ads => {
          console.log('📦 Toutes les annonces reçues:', ads);
          
          // Filtrer les annonces actives (date)
          const active = this.filterActiveAds(ads);
          console.log('📅 Annonces actives (dates):', active);
          
          // Si pas d'annonces actives
          if (active.length === 0) {
            console.log('❌ Aucune annonce active');
            return of([]);
          }
          
          // Filtrer par fréquence (session storage)
          const available = active.filter(ad => {
            const adId = ad.id || '';
            return !this.isAdExhausted(adId);
          });
          
          console.log('🔄 Annonces disponibles (fréquence):', available);
          
          if (available.length === 0 && active.length > 0) {
            this.sessionState.adFrequency = {};
            this.sessionState.seenAdIds = [];
            this.saveSessionState();
            return of(active);
          }

          return of(available.length > 0 ? available : active);
        }),
        catchError(err => {
          console.error('Error loading ads:', err);
          this.error = 'Failed to load ads';
          return of([]);
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (ads) => {
          console.log('🎯 Annonces après tous les filtres:', ads);
          
          this.ads = this.prioritizeAds(this.shuffleArray(ads));
          
          if (this.ads.length > 0) {
            // 🔥 IMPORTANT : Déterminer le placement à partir de la première annonce
            this.determinePlacementFromAd(this.ads[0]);
            this.startAdRotation();
          } else {
            this.currentAd = null;
            this.error = null;
            console.log('Aucune annonce disponible');
          }
        },
        error: (err) => {
          this.error = 'Failed to load ads';
          console.error('Error:', err);
        }
      });

    this.subscriptions.push(sub);
  }

  /**
   * 🔥 Détermine le placement en fonction du type de l'annonce
   */
  private determinePlacementFromAd(ad: AdContent): void {
    // Le placement est déterminé par le type de l'annonce
    switch(ad.type) {
      case AdType.BANNER:
        this.placement = 'BANNER';
        break;
      case AdType.VIDEO_ROLL:
        this.placement = 'VIDEO_ROLL';
        break;
      case AdType.INTERSTITIAL:
        this.placement = 'INTERSTITIAL';
        break;
      default:
        this.placement = 'BANNER'; // Fallback
    }
    
    console.log(`🎯 Placement déterminé: ${this.placement} (basé sur le type: ${ad.type})`);
  }

  private filterAdsByPlacement(ads: AdContent[]): AdContent[] {
    // Convertir le placement en AdType
    const adTypeMap: Record<string, AdType> = {
      'BANNER': AdType.BANNER,
      'VIDEO_ROLL': AdType.VIDEO_ROLL,
      'INTERSTITIAL': AdType.INTERSTITIAL,
      'GLOBAL': AdType.BANNER // Fallback
    };

    const targetType = adTypeMap[this.placement];
    
    return ads.filter(ad => {
      // Si GLOBAL, accepter tous les types
      if (this.placement === 'GLOBAL') return true;
      // Sinon filtrer par type
      return ad.type === targetType;
    });
  }

  private filterActiveAds(ads: AdContent[]): AdContent[] {
    const now = new Date();
    return ads.filter(ad => {
      const startDate = new Date(ad.start_date);
      const endDate = new Date(ad.end_date);
      return startDate <= now && endDate >= now;
    });
  }

  private prioritizeAds(ads: AdContent[]): AdContent[] {
    const unseen: AdContent[] = [];
    const seen: AdContent[] = [];

    ads.forEach(ad => {
      const adId = ad.id || '';
      if (this.sessionState.seenAdIds.includes(adId)) {
        seen.push(ad);
      } else {
        unseen.push(ad);
      }
    });

    return [...unseen, ...seen];
  }

  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // ==================== ROTATION ====================

   private startAdRotation(): void {
    if (this.ads.length === 0 || this.isDestroyed) return;

    this.currentIndex = this.selectNextAdIndex();
    this.currentAd = this.ads[this.currentIndex];
    
    // Déterminer le placement automatiquement
    this.determinePlacementFromAd(this.currentAd);
    
    this.trackImpression(this.currentAd.id || '');
    this.recordAdImpression(this.currentAd.id || '');
    this.preloadNextAd();

    // 🔥 Démarrer le timer de fermeture automatique
    this.startAutoCloseTimer();

    if (this.autoPlay && this.placement !== 'INTERSTITIAL') {
      this.startRotationTimer();
    }

    if (this.isVideoUrl(this.currentAd.media_url)) {
      this.handleVideoAd();
    }
  }

  private startAutoCloseTimer(): void {
  this.clearAutoCloseTimer();

  const delay = (this.AUTO_CLOSE_DELAYS[this.placement] || 8) * 1000;
  this.countdown = Math.ceil(delay / 1000);

  console.log(`⏱️ Fermeture automatique dans ${this.countdown}s`);

  const countdownInterval = setInterval(() => {
    this.countdown--;
    this.cdr.detectChanges();
    if (this.countdown <= 0) {
      clearInterval(countdownInterval);
    }
  }, 1000);

  this.autoCloseTimer = setTimeout(() => {
    this.smartClose(); // 🔥 Au lieu de this.isClosed = true
  }, delay);

  this.subscriptions.push({
    unsubscribe: () => clearInterval(countdownInterval)
  } as any);
}

  private clearAutoCloseTimer(): void {
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = null;
    }
  }

  private selectNextAdIndex(): number {
    if (this.ads.length === 0) return -1;
    if (this.ads.length === 1) return 0;

    const availableIndices = this.ads
      .map((ad, index) => ({ ad, index }))
      .filter(({ ad }) => {
        const adId = ad.id || '';
        if (this.isAdExhausted(adId)) return false;
        if (this.hasAdBeenSeenRecently(adId)) return false;
        return true;
      })
      .map(({ index }) => index);

    if (availableIndices.length === 0) {
      this.sessionState.adFrequency = {};
      this.sessionState.seenAdIds = [];
      this.saveSessionState();
      return this.selectNextAdIndex();
    }

    const filtered = availableIndices.filter(idx => idx !== this.currentIndex);
    const pickFrom = filtered.length > 0 ? filtered : availableIndices;
    
    return pickFrom[Math.floor(Math.random() * pickFrom.length)];
  }

  private preloadNextAd(): void {
    if (this.ads.length <= 1) return;
    
    const nextIndex = this.selectNextAdIndex();
    if (nextIndex !== -1) {
      this.nextAd = this.ads[nextIndex];
      
      // Préchargement
      if (this.nextAd?.media_url) {
        const img = new Image();
        img.src = this.nextAd.media_url;
      }
    }
  }

  private startRotationTimer(): void {
    this.stopRotationTimer();

    const duration = this.rotationInterval;

    this.rotationTimer = interval(100)
      .pipe(
        takeWhile(() => !this.isDestroyed && !this.isPaused)
      )
      .subscribe(() => {
        this.progress = (this.progress + 100 / (duration / 100));
        if (this.progress >= 100) {
          this.progress = 0;
          this.nextAdCycle();
        }
        this.cdr.detectChanges();
      });
  }

  private stopRotationTimer(): void {
    if (this.rotationTimer) {
      this.rotationTimer.unsubscribe();
      this.rotationTimer = null;
    }
  }

  private nextAdCycle(): void {
    if (this.isTransitioning || this.isDestroyed) return;
    
    this.isTransitioning = true;
    
    if (this.nextAd) {
      this.currentAd = this.nextAd;
      this.nextAd = null;
      
      this.trackImpression(this.currentAd.id || '');
      this.recordAdImpression(this.currentAd.id || '');
      this.preloadNextAd();
      
      if (this.isVideoUrl(this.currentAd.media_url)) {
        this.handleVideoAd();
      }
    } else {
      this.currentIndex = this.selectNextAdIndex();
      if (this.currentIndex !== -1) {
        this.currentAd = this.ads[this.currentIndex];
        this.trackImpression(this.currentAd.id || '');
        this.recordAdImpression(this.currentAd.id || '');
      }
    }

    this.isTransitioning = false;
    this.progress = 0;
    this.startRotationTimer();
    this.cdr.detectChanges();
  }

  // ==================== VIDÉO ====================

  private isVideoUrl(url: string): boolean {
    if (!url) return false;
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext));
  }

  private handleVideoAd(): void {
    this.isVideoPlaying = true;
    this.pauseRotation();
  }

  private setupVideoEvents(): void {
    // Les événements sont dans le template
  }

  onVideoEnded(): void {
    this.isVideoPlaying = false;
    this.resumeRotation();
    
    setTimeout(() => {
      if (!this.isDestroyed) {
        this.nextAdCycle();
      }
    }, 1000);
  }

  onVideoError(): void {
    this.isVideoPlaying = false;
    this.resumeRotation();
    setTimeout(() => {
      if (!this.isDestroyed) {
        this.nextAdCycle();
      }
    }, 2000);
  }

  private pauseVideo(): void {
    if (this.videoPlayer?.nativeElement) {
      this.videoPlayer.nativeElement.pause();
    }
  }

  // ==================== CONTROLES ====================

  pauseRotation(): void {
    this.isPaused = true;
    this.stopRotationTimer();
    this.pauseVideo();
  }

  resumeRotation(): void {
    this.isPaused = false;
    if (this.autoPlay && this.placement !== 'INTERSTITIAL') {
      this.startRotationTimer();
    }
  }

  // 🔥 Fermeture intelligente avec réouverture
private smartClose(): void {
  if (this.isDestroyed) return;

  console.log(`🔚 Fermeture de l'annonce ${this.placement}`);
  
  this.isClosed = true;
  this.clearAutoCloseTimer();
  this.pauseRotation();
  this.pauseVideo();
  this.cdr.detectChanges();

  // Planifier la réouverture (sauf pour interstitiel)
  if (this.placement !== 'INTERSTITIAL') {
    this.scheduleReopen();
  }
}

// 🔥 Réouverture programmée - VERSION SIMPLE QUI MARCHE
private scheduleReopen(): void {
  this.clearReopenTimer();

  console.log(`🔄 Réouverture dans ${this.REOPEN_DELAY}s`);

  this.reopenTimer = setTimeout(() => {
    if (!this.isDestroyed) {
      console.log('🔄 Réouverture de l\'annonce');
      
      // Réinitialiser l'état
      this.isClosed = false;
      this.isLoading = true;
      this.currentAd = null;
      this.cdr.detectChanges();
      
      // Recharger complètement
      this.loadAds();
    }
  }, this.REOPEN_DELAY * 1000);
}

// 🔥 Nettoyer le timer de réouverture
private clearReopenTimer(): void {
  if (this.reopenTimer) {
    clearTimeout(this.reopenTimer);
    this.reopenTimer = null;
  }
}

  // ==================== INTERACTIONS ====================

  onAdClick(): void {
  if (!this.currentAd?.id) return;

  this.adService.trackClick(this.currentAd.id).subscribe({
    error: (err) => console.error('Error tracking click:', err)
  });

  if (this.currentAd.target_url) {
    window.open(this.currentAd.target_url, '_blank');
  }

  // 🔥 Après clic, fermer l'annonce avec réouverture (sauf interstitiel)
  if (this.placement !== 'INTERSTITIAL') {
    this.smartClose();
  }
}

  onAdHover(): void {
    if (this.placement === 'BANNER') {
      this.pauseRotation();
    }
  }

  onAdLeave(): void {
    if (this.placement === 'BANNER') {
      this.resumeRotation();
    }
  }

  onClose(): void {
  this.smartClose(); // 🔥 Utiliser smartClose au lieu de fermeture définitive
}

  // ==================== TRACKING ====================

  private trackImpression(adId: string): void {
    if (!adId) return;
    this.adService.trackImpression(adId).subscribe({
      error: (err) => console.error('Error tracking impression:', err)
    });
  }

  // ==================== NETTOYAGE ====================

  private clearAllSubscriptions(): void {
    this.stopRotationTimer();
    this.subscriptions.forEach(sub => {
      if (sub && !sub.closed) {
        sub.unsubscribe();
      }
    });
    this.subscriptions = [];
  }

  // ==================== GETTERS ====================

  get isVideo(): boolean {
    return this.currentAd ? this.isVideoUrl(this.currentAd.media_url) : false;
  }

  get shouldShow(): boolean {
    return !this.isClosed && !this.isLoading && !!this.currentAd && !this.error;
  }

  get displayTitle(): string {
    return this.currentAd?.title || 'Advertisement';
  }

  get displayAdvertiser(): string {
    return this.currentAd?.advertiser_name || '';
  }

  get mediaUrl(): string {
    return this.currentAd?.media_url || '';
  }
}