import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonImg, IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { CreationService } from 'src/services/Service_content/creation-service';
import { Content, ContentCategory } from 'src/models/Content';
import { MediaUrlPipe } from '../../../utils/pipes/mediaUrlPipe/media-url-pipe';
import { addIcons } from 'ionicons';
import { close, refreshOutline, chevronBack, chevronForward, alertCircleOutline } from 'ionicons/icons';
import { Subject, takeUntil, interval } from 'rxjs';

@Component({
  selector: 'app-banner-ads',
  templateUrl: './banner-ads.component.html',
  styleUrls: ['./banner-ads.component.scss'],
  standalone: true,
  imports: [CommonModule, IonImg, IonIcon, IonSpinner, MediaUrlPipe]
})
export class BannerAdsComponent implements OnInit, OnDestroy {
  bannerAds: Content[] = [];
  isLoading = true;
  hasError = false;
  currentIndex = 0;
  private destroy$ = new Subject<void>();
  private slideInterval: any;

  constructor(private creationService: CreationService) {
    addIcons({ close, refreshOutline, chevronBack, chevronForward, alertCircleOutline });
  }

  ngOnInit() {
    this.loadBannerAds();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.slideInterval) {
      clearInterval(this.slideInterval);
    }
  }

  loadBannerAds() {
    this.isLoading = true;
    this.hasError = false;

    this.creationService.getBannerAdsContents(1, 10).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (ads) => {
        this.bannerAds = ads;
        this.isLoading = false;
        this.startAutoSlide();
      },
      error: (error) => {
        console.error('Erreur lors du chargement des bannières:', error);
        this.hasError = true;
        this.isLoading = false;
      }
    });
  }

  startAutoSlide() {
    if (this.bannerAds.length <= 1) return;

    this.slideInterval = setInterval(() => {
      this.currentIndex = (this.currentIndex + 1) % this.bannerAds.length;
    }, 5000); // Change toutes les 5 secondes
  }

  onBannerClick(banner: Content) {
    // Ouvrir le lien de la publicité ou effectuer une action
    console.log('Banner clicked:', banner);
    // TODO: Implémenter l'action de clic sur la bannière
  }

  nextBanner() {
    if (this.bannerAds.length > 0) {
      this.currentIndex = (this.currentIndex + 1) % this.bannerAds.length;
    }
  }

  previousBanner() {
    if (this.bannerAds.length > 0) {
      this.currentIndex = (this.currentIndex - 1 + this.bannerAds.length) % this.bannerAds.length;
    }
  }

  closeBanner() {
    // Masquer la bannière actuelle
    this.bannerAds.splice(this.currentIndex, 1);
    
    // Réinitialiser l'index si nécessaire
    if (this.currentIndex >= this.bannerAds.length && this.bannerAds.length > 0) {
      this.currentIndex = 0;
    }
  }

  retry() {
    this.loadBannerAds();
  }

  get currentBanner(): Content | null {
    return this.bannerAds[this.currentIndex] || null;
  }

  trackByBannerId(index: number, banner: Content): string {
    return banner.id as string;
  }
}
