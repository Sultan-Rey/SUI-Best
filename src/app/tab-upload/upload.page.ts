import { Component, OnInit } from '@angular/core';
import { CameraService, UserPhoto } from '../../services/CAMERA_SERVICE/camera-service';
import { ActionSheetController, ToastController } from '@ionic/angular/standalone';
import {  IonContent, IonButton, IonIcon, IonLabel, IonSpinner, IonTextarea,  IonItem, IonList, IonListHeader, IonToggle, IonSkeletonText } from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Content, ContentStatus, ContentType } from 'src/models/Content';
import { CreationService } from '../../services/CREATION/creation-service';
import { Challenge } from 'src/models/Challenge';
import { Observable } from 'rxjs';
import { addIcons } from 'ionicons';
import { 
  close,
  camera,
  images,
  videocam,
  checkmarkCircle,
  cloudUploadOutline, trashOutline, send } from 'ionicons/icons';
@Component({
  selector: 'app-upload',
  templateUrl: 'upload.page.html',
  styleUrls: ['upload.page.scss'],
  standalone: true,
  imports: [IonSpinner,  IonToggle,IonListHeader, IonList, IonItem, IonContent, IonButton, IonIcon, IonLabel, IonTextarea, FormsModule, CommonModule]
})
export class UploadPage implements OnInit {

 visibility: 'public' | 'private' = 'public';
 currentStep: number = 1;
  totalSteps: number = 3;
  title: string = '';
  description: string = '';
   galleryPhotos: UserPhoto[] = [];
  selectedPhoto: UserPhoto | null = null;
selectedFiles: Array<{ type: 'photo' | 'video', url: string, file?: File }> = [];
  newContent: Content = {
    title: '',
    description: '',
    contentType: ContentType.IMAGE, // Par défaut
    fileName: '',
    fileSize: 0,
    mimeType: '',
    isPublic: true,
    allowComments: true,
    allowDownloads: false,
    status: ContentStatus.DRAFT,
    userId: 'current-user-id', // À remplacer par l'ID de l'utilisateur connecté
    tags: [],
    categories: [],
    createdAt: new Date(),
    contentUrl: '',
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    downloadCount: 0,
    isChallengeEntry: false
  };
   availableChallenges$!: Observable<Challenge[]>;
  isLoadingChallenges = true;

  constructor(
    private cameraService: CameraService,
    private toastController: ToastController,
    private actionSheetCtrl: ActionSheetController,
    private creationService: CreationService
  ) {addIcons({
  trashOutline,
  cloudUploadOutline,
  checkmarkCircle,
  send,
  'images': images,
  'image':images,
  'videocam': videocam,
  'camera': camera,
  'close': close
});}

  // Les défis sont maintenant chargés via le service CreationService
  // et sont accessibles via l'observable availableChallenges$

  // Navigation entre les étapes
  nextStep() {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  ngOnInit() {
    this.loadChallenges();
  }

  private loadChallenges() {
    this.isLoadingChallenges = true;
    this.availableChallenges$ = this.creationService.getActiveChallenges();
    this.availableChallenges$.subscribe({
      next: () => {
        this.isLoadingChallenges = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des défis', error);
        this.isLoadingChallenges = false;
        // Afficher un message d'erreur à l'utilisateur
        this.presentToast('vous n\'avez aucun défis en cours', 'warning');
      }
    });
  }

  private async presentToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      color: color,
      position: 'bottom'
    });
    await toast.present();
  }

 // Ajoutez ces méthodes à votre classe UploadPage

async presentActionSheet() {
  const actionSheet = await this.actionSheetCtrl.create({
    header: 'Sélectionner un média',
    buttons: [
      {
        text: 'Prendre une photo',
        icon: 'camera',
        handler: () => {
          this.takePhoto();
        }
      },
      {
        text: 'Choisir depuis la galerie',
        icon: 'images',
        handler: () => {
          this.pickFromGallery();
        }
      },
      {
        text: 'Annuler',
        icon: 'close',
        role: 'cancel'
      }
    ]
  });
  await actionSheet.present();
}

async takePhoto() {
  try {
    const photo = await this.cameraService.addNewToGallery();
    if (photo) {
      this.updateMediaPreview(photo);
    }
  } catch (error) {
    console.error('Erreur lors de la prise de photo:', error);
   
  }
}

async pickFromGallery() {
  try {
    const photo = await this.cameraService.getGalleryPhotos();
    this.updateMediaPreview(photo);
  } catch (e) { console.warn('Galerie fermée'); }
}

updateMediaPreview(photo: UserPhoto) {
  this.newContent.contentUrl = photo.webviewPath as string;
  this.newContent.mimeType = 'image/jpeg'; // À adapter selon le type de média
  this.newContent.fileName = photo.filepath;
}

removeMedia(event: Event) {
  event.stopPropagation();
  this.newContent.contentUrl = '';
  this.newContent.mimeType = '';
  this.newContent.fileName = '';
}

isImage(mimeType: string): boolean {
  return mimeType?.startsWith('image/');
}

isVideo(mimeType: string): boolean {
  return mimeType?.startsWith('video/');
}

  browseFiles() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.multiple = true;
    input.onchange = (event: any) => {
      const files = event.target.files;
      for (let file of files) {
        const url = URL.createObjectURL(file);
        const type = file.type.startsWith('video/') ? 'video' : 'photo';
        this.selectedFiles.push({
          type: type,
          url: url,
          file: file
        });
      }
    };
    input.click();
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
  }

  setVisibility(visibility: 'public' | 'private') {
    this.visibility = visibility;
  }

  onVisibilityChange() {
    // Si la publication devient publique, on réinitialise la sélection de défi
    if (this.newContent.isPublic) {
      this.newContent.challengeId = undefined;
      this.newContent.challengeName = undefined;
      this.newContent.isChallengeEntry = false;
    } else {
      this.newContent.isChallengeEntry = true;
    }
  }

  selectChallenge(challenge: any) {
    if (this.newContent.challengeId === challenge.id) {
      // Désélectionner le défi
      this.newContent.challengeId = undefined;
      this.newContent.challengeName = undefined;
    } else {
      // Sélectionner le nouveau défi
      this.newContent.challengeId = challenge.id;
      this.newContent.challengeName = challenge.name;
    }
  }

  canProceedToNextStep(): boolean {
  switch (this.currentStep) {
    case 1:
      return !!this.newContent.contentUrl;  // Vérifie si un média a été sélectionné
    case 2:
      return true;
    default:
      return true;
  }
}

  canSubmit(): boolean {
    // Si la publication est publique, on peut publier directement
    if (this.newContent.isPublic) return true;
    
    // Si la publication est privée, on vérifie qu'un défi est sélectionné
    return !!this.newContent.challengeId;
  }

  async submitPost() {
    try {
      // Mettre à jour les propriétés du contenu
      this.newContent.createdAt = new Date();
      this.newContent.status = ContentStatus.PUBLISHED;
      
      // Logique de soumission...
      console.log('Nouvelle publication:', this.newContent);
      
      // Afficher un message de succès
      const toast = await this.toastController.create({
        message: 'Publication partagée avec succès!',
        duration: 3000,
        position: 'bottom',
        color: 'success'
      });
      await toast.present();
      
      // Réinitialiser le formulaire
      this.resetForm();
      
    } catch (error) {
      console.error('Erreur lors de la publication:', error);
      const toast = await this.toastController.create({
        message: 'Une erreur est survenue lors de la publication',
        duration: 3000,
        position: 'bottom',
        color: 'danger'
      });
      await toast.present();
    }
  }

  private resetForm() {
    this.currentStep = 1;
    this.selectedFiles = [];
    this.newContent = {
      title: '',
      description: '',
      contentType: ContentType.IMAGE,
      fileName: '',
      fileSize: 0,
      mimeType: '',
      isPublic: true,
      isChallengeEntry: false,
      allowComments: true,
      allowDownloads: false,
      status: ContentStatus.DRAFT,
      userId: 'current-user-id',
      tags: [],
      categories: [],
      createdAt: new Date(),
      contentUrl: '',
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      downloadCount: 0
    };
  }

  

}
