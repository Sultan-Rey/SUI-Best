// secure-image.component.ts
import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { MediaService } from 'src/services/MEDIA/media';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-secure-image',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
    <div class="image-container">
      <img 
        *ngIf="imageUrl" 
        [src]="imageUrl" 
        [alt]="alt"
        [class]="imageClass"
        (load)="onImageLoad()"
        (error)="onImageError()"
      />
      <ion-skeleton-text 
        *ngIf="!imageLoaded && !imageError" 
        [class]="skeletonClass" 
        animated>
      </ion-skeleton-text>
      <div *ngIf="imageError" class="image-error">
        <ion-icon name="image-outline"></ion-icon>
      </div>
    </div>
  `,
  styles: [`
    .image-container {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    img.loaded {
      opacity: 1;
    }
    .image-error {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      color: #ccc;
    }
  `]
})
export class SecureImageComponent implements OnChanges, OnDestroy {
  @Input() imagePath: string = '';
  @Input() alt: string = 'Image';
  @Input() imageClass: string = '';
  @Input() skeletonClass: string = '';

  imageUrl: string | null = null;
  imageLoaded = false;
  imageError = false;
  private imageSubscription?: Subscription;

  constructor(private mediaService: MediaService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['imagePath'] && this.imagePath) {
      this.loadImage(this.imagePath);
    }
  }

  private loadImage(path: string): void {
    this.resetState();
    
    this.imageSubscription = this.mediaService.getImageURL(path).subscribe({
      next: (url: string) => {
        this.imageUrl = url;
      },
      error: (error: any) => {
        console.error('Error loading image:', error);
        this.imageError = true;
      }
    });
  }

  onImageLoad(): void {
    this.imageLoaded = true;
    this.imageError = false;
  }

  onImageError(): void {
    this.imageError = true;
    this.imageLoaded = false;
    if (this.imageUrl) {
      this.mediaService.revokeImageURL(this.imageUrl);
      this.imageUrl = null;
    }
  }

  private resetState(): void {
    this.imageLoaded = false;
    this.imageError = false;
    this.imageUrl = null;
    
    if (this.imageSubscription) {
      this.imageSubscription.unsubscribe();
    }
  }

  ngOnDestroy(): void {
    if (this.imageSubscription) {
      this.imageSubscription.unsubscribe();
    }
    
    if (this.imageUrl) {
      this.mediaService.revokeImageURL(this.imageUrl);
    }
  }
}