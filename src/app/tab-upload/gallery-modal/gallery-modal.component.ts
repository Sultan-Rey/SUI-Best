import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular/standalone';
import { UserPhoto } from '../../../services/CAMERA_SERVICE/camera-service';
import { IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent } from "@ionic/angular/standalone";
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-gallery-modal',
  templateUrl: './gallery-modal.component.html',
  styleUrls: ['./gallery-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent]
})
export class GalleryModalComponent implements OnInit {
  @Input() photos: UserPhoto[] = [];
  selectedPhoto: UserPhoto | null = null;

  constructor(private modalCtrl: ModalController) {}

  ngOnInit() {}

  selectPhoto(photo: UserPhoto) {
    this.selectedPhoto = photo;
    this.modalCtrl.dismiss({
      selectedPhoto: photo
    });
  }

  close() {
    this.modalCtrl.dismiss();
  }
}