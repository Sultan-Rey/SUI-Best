import { Component, OnDestroy } from '@angular/core';
import { ActionSheetController, LoadingController, ToastController } from '@ionic/angular';
import { CameraService } from '../../services/CAMERA_SERVICE/camera-service';
import { CreationService } from '../../services/CREATION/creation-service';
import { Content, ContentSource, ContentType } from '../../models/Content';
import { IonButton,  IonToggle, IonTextarea, IonItem, IonContent, IonIcon, IonLabel, IonHeader, IonProgressBar, IonList, IonToolbar, IonTitle, IonRadioGroup, IonButtons, IonListHeader, IonRadio } from "@ionic/angular/standalone";
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { camera, arrowBack, closeCircle, close, image, images, globe, lockClosed, download } from 'ionicons/icons';
import { Challenge } from 'src/models/Challenge';
import { Auth } from 'src/services/AUTH/auth';

@Component({
  selector: 'app-upload',
  templateUrl: './upload.page.html',
  styleUrls: ['./upload.page.scss'],
  standalone: true,
  imports:[NgIf, NgFor, FormsModule,  IonButton, IonToggle, IonTextarea, IonItem, IonContent, IonIcon, IonLabel, IonHeader, IonButtons, IonProgressBar, IonList, IonToolbar, IonTitle,  IonListHeader, IonRadio, IonRadioGroup]
})
export class UploadPage implements OnDestroy {
  // État du formulaire
  content: Partial<Content> = {
    title: '',
    description: '',
    isPublic: true,
    allowDownloads: true,
    allowComments:true,
    source: ContentSource.CAMERA
  };
  challenges: Challenge[] = [];  // Liste des challenges
  selectedChallengeId: string | null = null;  // ID du challenge sélectionné

  selectedFile: File | null = null;
  previewUrl: string | null = null;
  isUploading = false;
  currentStep = 1;
  totalSteps = 4;

  constructor(
    private cameraService: CameraService,
    private creationService: CreationService,
    private authService: Auth,
    private loadingCtrl: LoadingController,
    private actionSheetCtrl: ActionSheetController,
    private toastCtrl: ToastController
  ) {this.loadChallenges();
    addIcons({arrowBack,close,images,closeCircle,camera,image,globe,lockClosed,download});}

 
  async loadChallenges() {
  try {
    // Supprimez le await inutile car on utilise subscribe
    this.creationService.getChallengesByCreator(
      this.authService.getCurrentUser()?.id as string || ''
    ).subscribe({
      next: (challenges: Challenge[]) => {
        this.challenges = challenges;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des challenges:', error);
        this.showError('Impossible de charger les défis');
      }
    });
  } catch (error) {
    console.error('Erreur inattendue lors du chargement des challenges:', error);
    this.showError('Une erreur inattendue est survenue');
  }
}

  isImage(): boolean {
  if (!this.selectedFile) return false;
  return this.selectedFile.type.startsWith('image/');
  }

  isVideo(): boolean {
  if (!this.selectedFile) return false;
  return this.selectedFile.type.startsWith('video/');
}

  // Prendre une photo avec la caméra
  async takePhoto() {
    try {
      const photo = await this.cameraService.takePhoto();
      this.selectedFile = await this.cameraService.convertPhotoToFile(photo);
      this.previewUrl = photo.webPath || null;
      this.content.source = ContentSource.CAMERA;
    } catch (error) {
      console.error('Erreur avec la caméra:', error);
      this.showError('Impossible d\'accéder à la caméra');
    }
  }

  // Choisir depuis la galerie
  async pickFromGallery() {
    try {
      const photo = await this.cameraService.pickFromGallery();
      this.selectedFile = await this.cameraService.convertPhotoToFile(photo);
      this.previewUrl = photo.webPath || null;
      this.content.source = ContentSource.GALLERY;
    } catch (error) {
      console.error('Erreur avec la galerie:', error);
      this.showError('Impossible d\'accéder à la galerie');
    }
  }

  // Méthodes de navigation
canProceed(): boolean {
  switch (this.currentStep) {
    case 1: return !!this.selectedFile;
    case 2: return !!this.content.title?.trim();
    case 3: return true;  // L'étape de sélection du challenge est optionnelle
    default: return true;
  }
}

canSubmit(): boolean {
  return !!this.selectedFile && !!this.content.title?.trim();
}

// Pour fermer le formulaire
close() {
  // Implémentez la logique pour fermer le modal ou revenir en arrière
}

// Pour afficher les options de média
async presentMediaOptions() {
  if (this.selectedFile) return;
  
  const actionSheet = await this.actionSheetCtrl.create({
    header: 'Ajouter des médias',
    buttons: [
      {
        text: 'Prendre une photo',
        icon: 'camera',
        handler: () => this.takePhoto()
      },
      {
        text: 'Choisir depuis la galerie',
        icon: 'images',
        handler: () => this.pickFromGallery()
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

// Mettez à jour removeMedia
removeMedia(event: Event) {
  event.stopPropagation();
  this.selectedFile = null;
  this.previewUrl = null;
}

  // Soumettre le formulaire
  async submit() {
    if (!this.selectedFile) {
      this.showError('Veuillez sélectionner un fichier');
      return;
    }

    if (!this.content.title?.trim()) {
      this.showError('Veuillez ajouter un titre');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Publication en cours...'
    });
    await loading.present();

    try {
      await this.creationService.createContentWithFile(
        this.selectedFile,
        {
          title: this.content.title,
          description: this.content.description,
          isPublic: this.content.isPublic ?? true,
          allowDownloads: this.content.allowDownloads ?? true,
          allowComments: this.content.allowComments ?? false,
          challengeId: this.content.challengeId,
          source: this.content.source || ContentSource.CAMERA
        }
      ).toPromise();

      await loading.dismiss();
      this.showSuccess('Contenu publié avec succès!');
      this.resetForm();
    } catch (error) {
      console.error('Erreur lors de la publication:', error);
      await loading.dismiss();
      this.showError('Erreur lors de la publication');
    }
  }

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

  // Réinitialisation du formulaire
  private resetForm() {
    this.content = {
      title: '',
      description: '',
      isPublic: true,
      allowDownloads: true,
      allowComments: false,
    };
    this.selectedFile = null;
    this.previewUrl = null;
    this.currentStep = 1;
  }

  // Affichage des messages
  private async showError(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color: 'danger'
    });
    await toast.present();
  }

  private async showSuccess(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color: 'success'
    });
    await toast.present();
  }

  // Nettoyage
  ngOnDestroy() {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
    }
  }
}