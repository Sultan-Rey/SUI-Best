import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { MediaUrlPipe } from 'src/app/utils/pipes/mediaUrlPipe/media-url-pipe';

@Component({
  selector: 'app-media-lightbox',
  standalone: true,
  imports: [CommonModule, IonicModule, MediaUrlPipe],
  template: `
    <ion-content class="lightbox-content">
      <button class="close-lightbox-btn" (click)="close()" aria-label="Fermer">
        <ion-icon name="close-outline"></ion-icon>
      </button>

      <div class="media-container">
        <video 
          *ngIf="isVideo; else isImage" 
          [src]="content.fileUrl | mediaUrl | async" 
          controls 
          autoplay 
          playsinline
          class="lightbox-media">
        </video>

        <ng-template #isImage>
          <img [src]="content.fileUrl | mediaUrl | async" alt="Aperçu du média" class="lightbox-media" />
        </ng-template>
        
        <p class="lightbox-caption" *ngIf="content.description">« {{ content.description }} »</p>
      </div>
    </ion-content>
  `,
  styles: [`
    .lightbox-content {
      --background: rgba(0, 0, 0, 0.92);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .media-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      padding: 20px;
    }
    .lightbox-media {
      max-width: 100%;
      max-height: 80vh;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      object-fit: contain;
    }
    .close-lightbox-btn {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.15);
      border: none;
      color: #fff;
      border-radius: 50%;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      backdrop-filter: blur(8px);
      z-index: 10;
      cursor: pointer;
      transition: background 0.2s;
      &:active { background: rgba(255, 255, 255, 0.3); }
    }
    .lightbox-caption {
      color: #fff;
      margin-top: 16px;
      font-style: italic;
      text-align: center;
      font-size: 1.1rem;
      max-width: 80%;
    }
  `]
})
export class MediaLightboxComponent implements OnInit {
  @Input() content: any;
  isVideo = false;

  constructor(private modalCtrl: ModalController) {
    addIcons({ closeOutline });
  }

  ngOnInit() {
    if (this.content?.fileUrl) {
      const url: string = this.content.fileUrl.toLowerCase();
      // Détection basique basée sur les extensions courantes de vidéo
      this.isVideo = url.endsWith('.mp4') || url.endsWith('.mov') || url.endsWith('.webm') || url.endsWith('.m4v');
    }
  }

  close() {
    this.modalCtrl.dismiss();
  }
}