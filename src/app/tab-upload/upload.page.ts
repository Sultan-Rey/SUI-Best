import { Component, OnDestroy, Input } from '@angular/core';
import { ActionSheetController, AlertController, LoadingController, ToastController } from '@ionic/angular';
import { CameraService } from '../../services/CAMERA_SERVICE/camera-service.js';
import { CreationService } from '../../services/CREATION_SERVICE/creation-service.js';
import { Content, ContentSource, ContentType } from '../../models/Content.js';
import { IonButton,IonChip,  IonToggle, IonTextarea, IonItem, IonContent, IonIcon, IonLabel, IonHeader, IonProgressBar, IonList, IonToolbar, IonTitle, IonRadioGroup, IonButtons, IonListHeader, IonRadio } from "@ionic/angular/standalone";
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { camera, arrowBack, closeCircle, close, image, images, globe, lockClosed, download, heartOutline, chatbubbleOutline, shareOutline, expand, contract } from 'ionicons/icons';
import { Challenge } from '../../models/Challenge.js';
import { Auth } from '../../services/AUTH/auth.js';
import { ProfileService } from '../../services/PROFILE_SERVICE/profile-service.js';
import { Router } from '@angular/router';
import { ChallengeService } from 'src/services/CHALLENGE_SERVICE/challenge-service.js';
import { ModalController } from '@ionic/angular';
import { NotificationService } from 'src/services/NOTIFICATION_SERVICE/notification-service.js';

@Component({
  selector: 'app-upload',
  templateUrl: './upload.page.html',
  styleUrls: ['./upload.page.scss'],
  standalone: true,
  providers: [ModalController],
  imports:[NgIf, NgFor, FormsModule,  IonButton, IonChip, IonToggle, IonTextarea, IonItem, IonContent, IonIcon, IonLabel, IonHeader, IonButtons, IonProgressBar, IonList, IonToolbar, IonTitle,  IonListHeader, IonRadio, IonRadioGroup]
})
export class UploadPage implements OnDestroy {
  @Input() userId?: string;
  @Input() challengeId?: string;
  @Input() isAutomaticAcceptance?: boolean;
  @Input() isModalMode: boolean = false;
  
  private _selectedChallengeId: string | null = null;

  // Getter et setter pour selectedChallengeId
  get selectedChallengeId(): string | null {
    return this._selectedChallengeId;
  }

  set selectedChallengeId(value: string | null) {
    this._selectedChallengeId = value;
    if (this.content) {
      this.content.challengeId = value || '';
    }
  }

  // État du formulaire
  content: Partial<Content> = {
    description: '',
    isPublic: true,
    allowDownloads: true,
    allowComments: true,
    likedIds: [],
    commentIds: [],
    challengeId: '', // Sera mis à jour par le setter
    userId: this.authService.getCurrentUser()?.id?.toString() || '',
    source: ContentSource.CAMERA
  };
  challenges: Challenge[] = [];  // Liste des challenges
  

  selectedFile: File | null = null;
  previewUrl: string | null = null;
  isUploading = false;
  currentStep = 1;
  totalSteps = 4;
  imageFitMode: 'default' | 'fit' = 'default';

  constructor(
    private cameraService: CameraService,
    private creationService: CreationService,
    private challengeService: ChallengeService,
    private authService: Auth,
    private profileService: ProfileService,
    private notificationService: NotificationService,
    private loadingCtrl: LoadingController,
    private actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private routeur: Router,
    private modalCtrl: ModalController
  ) { 
    this.initializeMode();
    addIcons({arrowBack,close,images,closeCircle,camera,image,globe,lockClosed,download,heartOutline,chatbubbleOutline,shareOutline,expand,contract});
  }

 
  private initializeMode() {
    // Vérifier si nous sommes en mode modal
    
    if (this.isModalMode) {
      // Mode modal: utiliser les inputs fournis
      if (this.userId) {
        this.content.userId = this.userId;
      }
      if (this.challengeId) {
        this.selectedChallengeId = this.challengeId;
      }
      // En mode modal, on a 3 étapes: média → description → vérification
      this.totalSteps = 3;
    } else {
      // Mode normal: charger les challenges
      this.loadChallenges();
      this.totalSteps = 4;
    }
  }

  async loadChallenges() {
  try {
    // Supprimez le await inutile car on utilise subscribe
    this.challengeService.getChallengesByCreator(
      this.authService.getCurrentUser()?.id as string || ''
    ).subscribe({
      next: (challenges: Challenge[]) => {
        this.challenges = challenges;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des challenges:', error);
        this.showError('Tableau des défis vide');
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
      this.showError('Interruption du chargement de la galerie');
    }
  }

  // Méthodes de navigation
canProceed(): boolean {
    switch (this.currentStep) {
      case 1: return !!this.selectedFile;
      case 2: return !!this.content.description?.trim();
      case 3: return true;  // L'étape de sélection du challenge (mode normal)
      default: return true;
    }
  }

canSubmit(): boolean {
  return !!this.selectedFile && !!this.content.description?.trim();
}

// Pour fermer le formulaire
async close() {
  if (this.isModalMode) {
    await this.modalCtrl.dismiss();
  } else {
    this.routeur.navigate(['/tabs/tabs/home']);
  }
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

  // Méthode pour changer le mode de cadrage de l'image
  setImageFitMode(mode: 'default' | 'fit') {
    this.imageFitMode = mode;
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

  if (!this.content.description?.trim()) {
    this.showError('Veuillez ajouter un titre');
    return;
  }

  const loading = await this.loadingCtrl.create({
    message: 'Publication en cours...'
  });
  await loading.present();
 
  try {
    let finalChallengeId: string;

    // Cas 1: Mode normal - on utilise le challengeId sélectionné
    if (!this.isModalMode) {
      finalChallengeId = this.content.challengeId || '';
    } 
    // Cas 2: Mode modal
    else {
      if (this.isAutomaticAcceptance) {
        // Acceptation automatique : on utilise le challengeId de l'input
        finalChallengeId = this.challengeId || '';
      } else {
        // Pas d'acceptation automatique : on publie d'abord, puis on informe
        finalChallengeId = ''; // Publier sans challenge initialement
      }
    }

    // Création du contenu
    const newContent = await this.creationService.createContentWithFile(
      this.selectedFile,
      {
        userId: this.content.userId || '',
        description: this.content.description,
        isPublic: this.content.isPublic ?? true,
        allowDownloads: this.content.allowDownloads ?? true,
        allowComments: this.content.allowComments ?? false,
        challengeId: finalChallengeId,
        cadrage: this.imageFitMode,
        likedIds: [],
        commentIds: [],
        source: this.content.source || ContentSource.CAMERA
      }
    ).toPromise();

    // Mise à jour des statistiques du profil utilisateur
    if (newContent && this.content.userId) {
      try {
        // Récupérer le profil utilisateur
const userProfile = await this.profileService.getProfileById(this.content.userId).toPromise();

if (userProfile) {
  // Initialiser les stats si elles n'existent pas
  const currentStats = userProfile.stats || { 
    posts: 0, 
    fans: 0, 
    votes: 0, 
    stars: 0 
  };
  
  // Créer l'objet de mise à jour avec les nouvelles stats
  const updates = {
    stats: {
      ...currentStats,
      posts: (currentStats.posts || 0) + 1
    }
  };
  
  // Mettre à jour le profil utilisateur avec la nouvelle signature
  await this.profileService.updateProfile(userProfile.id, updates).toPromise();
}
      } catch (error) {
        console.error('Erreur lors de la mise à jour du profil:', error);
        // Ne pas bloquer le flux en cas d'échec de la mise à jour des stats
      }
    }

    await loading.dismiss();
    
    // Message de succès selon le cas
    if (this.isModalMode && !this.isAutomaticAcceptance) {
      
      this.alertCtrl.create({
          header:'Participation au défis',
          subHeader:'Acceptation en cours de traitement',
          message:'Attendez de recevoir votre ticket d\'acceptance.',
          buttons: ['Merci !']
        }).then((alert) => {
          alert.present();
        });
    } else {
      this.showSuccess('Contenu publié avec succès!');
    }
    
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
      // En mode modal, sauter l'étape 3 (challenge)
      if (this.isModalMode && this.currentStep === 2) {
        this.currentStep = 3; // Passer directement à la vérification
        this.totalSteps = 3
      } else {
        this.currentStep++;
      }
    
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      // En mode modal, si on revient depuis l'étape 3, retourner à l'étape 2
      if (this.isModalMode && this.currentStep === 3) {
        this.currentStep = 2;
      } else {
        this.currentStep--;
      }
    }
  }

  // Réinitialisation du formulaire
  private resetForm() {
    this.content = {
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