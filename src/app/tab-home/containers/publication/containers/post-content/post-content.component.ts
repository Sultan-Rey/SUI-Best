import { Component, OnDestroy, Input, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import {
  ActionSheetController, AlertController,
  LoadingController, ToastController, ModalController
} from '@ionic/angular';
import { CameraService, MediaFile } from 'src/services/CAMERA/camera-service';
import { CreationService } from 'src/services/Service_content/creation-service';
import { Content, ContentSource, ContentStatus, ContentCategory } from 'src/models/Content';
import {
  IonButton, IonChip, IonToggle, IonTextarea, IonIcon,
  IonHeader, IonToolbar, IonTitle, IonButtons,
  IonRadioGroup, IonRadio, IonSpinner
} from '@ionic/angular/standalone';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  camera, arrowBack, close, settings, checkmarkCircle, image, images, closeCircle,
  globe, lockClosed, download, heartOutline, chatbubbleOutline, shareOutline,
  expand, contract, imageOutline, cameraOutline, imagesOutline, videocam,
  phonePortraitOutline, closeCircleOutline, trophyOutline, arrowRedoOutline,
  expandOutline, contractOutline, checkmark
} from 'ionicons/icons';
import { Challenge } from 'src/models/Challenge';
import { Auth } from 'src/services/AUTH/auth';
import { ProfileService } from 'src/services/Service_profile/profile-service';
import { Router } from '@angular/router';
import { ChallengeService } from 'src/services/Service_challenge/challenge-service';
import { UserProfile } from 'src/models/User';
import { isNullOrUndefined } from 'html5-qrcode/esm/core';
import { SystemMessenger } from 'src/services/Service_message/system-messenger';

@Component({
  selector: 'app-post-content',
  templateUrl: './post-content.component.html',
  styleUrls: ['./post-content.component.scss'],
  standalone: true,
  providers: [ModalController],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIf, NgFor, FormsModule, IonToggle, IonTextarea,
    IonIcon, IonRadio, IonRadioGroup,
    IonSpinner
  ]
})
export class PostContentComponent implements OnInit, OnDestroy {

  @Input() CurrentUserProfile!: UserProfile;
  @Input() challenges: Challenge[] = [];
  @Input() isChallenging!: boolean;
  // ─── Challenge ────────────────────────────────────────────────
  private _selectedChallenge: Challenge | null = null;

  get selectedChallenge(): Challenge | null { return this._selectedChallenge; }
  set selectedChallenge(value: Challenge | null) {
    this._selectedChallenge = value;
    if (this.content && value) this.content.challengeId = value.id ?? '';
  }

  // ─── Formulaire ───────────────────────────────────────────────
  content: Partial<Content> = {
    description:    '',
    isPublic:       true,
    allowDownloads: true,
    allowComments:  true,
    likedIds:       [],
    commentIds:     [],
    challengeId:    '',
    status:         ContentStatus.PUBLISHED,
    userId:         this.CurrentUserProfile?.id ?? '',
    source:         ContentSource.CAMERA,
    category:       ContentCategory.POST,
  };

  // ─── Médias + carrousel ───────────────────────────────────────
  selectedMedia: MediaFile[] = [];
  activeIndex   = 0;  // index du média affiché en preview

  get activeMedia(): MediaFile | null { return this.selectedMedia[this.activeIndex] ?? null; }
  get hasMedia(): boolean             { return this.selectedMedia.length > 0; }

  // ─── UI ───────────────────────────────────────────────────────
  currentStep     = 1;
  totalSteps      = 3;
  isPickingMedia  = false;
  isUploading     = false;
  isPublic        = true;
  isLocked        = false;
  isAdvertisement = false;
  advertisementType = 'ads_post';
  
  constructor(
    private cameraService:    CameraService,
    private creationService:  CreationService,
    private challengeService: ChallengeService,
    private profileService:   ProfileService,
    private systemMessenger:  SystemMessenger,
    private loadingCtrl:      LoadingController,
    private alertCtrl:        AlertController,
    private toastCtrl:        ToastController,
    private cdr:              ChangeDetectorRef
  ) {
    addIcons({
      arrowBack, close, image, imageOutline, cameraOutline, imagesOutline, videocam,
      phonePortraitOutline, closeCircleOutline, trophyOutline, heartOutline,
      chatbubbleOutline, arrowRedoOutline, expandOutline, contractOutline,
      settings, checkmarkCircle, checkmark, images, camera, closeCircle,
      shareOutline, expand, contract, globe, lockClosed, download
    });
  }

  ngOnInit(): void { 
    // Initialiser le userId avec l'utilisateur courant
    this.content.userId = this.CurrentUserProfile?.id ?? '';
  
    if(!isNullOrUndefined(this.isChallenging) )
      this.selectedChallenge = this.challenges[0];
    else
       this.loadChallenges(); 
     
    if(this.CurrentUserProfile.type == 'admin'){
      this.isPublic = true;
      this.content.isPublic = true;
    }else{
      this.isPublic = false;
      this.content.isPublic = false;
      this.isLocked        = true;
    }
  }

  ngOnDestroy(): void {
    this.selectedMedia.forEach(m => URL.revokeObjectURL(m.previewUrl));
  }

  loadChallenges(): void {
    const creatorIds = [
      this.CurrentUserProfile?.['id'] || '',
      ...(this.CurrentUserProfile?.['myFollows'] || [])
    ];
    this.challengeService.getChallengesByCreator(creatorIds).subscribe({
      next: challenges => {
        this.challenges = challenges.filter(c =>
          c.end_date && new Date(c.end_date) >= new Date()
        );
        this.cdr.markForCheck();
      },
      error: () => this.showError('Tableau des défis vide')
    });
  }

  async takePhoto(): Promise<void> {
    this.isPickingMedia = true;
    this.cdr.markForCheck();
    try {
      const media = await this.cameraService.takePhoto();
      this.setMedia([media]);
      this.content.source = ContentSource.CAMERA;
    } catch {
      this.showError('Impossible d\'accéder à la caméra');
    } finally {
      this.isPickingMedia = false;
      this.cdr.markForCheck();
    }
  }

  async pickFromGallery(): Promise<void> {
    this.isPickingMedia = true;
    this.cdr.markForCheck();
    try {
      const mediaFiles = await this.cameraService.pickMultiple();
      if (mediaFiles.length) {
        this.setMedia(mediaFiles);
        this.content.source = ContentSource.GALLERY;
      }
    } catch {
      this.showError('Interruption du chargement de la galerie');
    } finally {
      this.isPickingMedia = false;
      this.cdr.markForCheck();
    }
  }

  removeMedia(event: Event): void {
    event.stopPropagation();
    this.selectedMedia.forEach(m => URL.revokeObjectURL(m.previewUrl));
    this.selectedMedia = [];
    this.activeIndex   = 0;
    this.cdr.markForCheck();
  }

  selectMedia(index: number): void {
    if (index < 0 || index >= this.selectedMedia.length) return;
    this.activeIndex = index;
    this.cdr.markForCheck();
  }

  private setMedia(mediaFiles: MediaFile[]): void {
    this.selectedMedia.forEach(m => URL.revokeObjectURL(m.previewUrl));
    this.selectedMedia = mediaFiles;
    this.activeIndex   = 0;

    // Vérifier les dimensions si c'est une bannière publicitaire
    if (this.isAdvertisement && this.advertisementType === 'ads_banner' && mediaFiles.length > 0) {
      this.validateBannerDimensions(mediaFiles[0]);
    }

    this.cdr.markForCheck();
  }

  private async validateBannerDimensions(mediaFile: MediaFile): Promise<void> {
    if (!mediaFile.isImage) return;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const width = img.width;
        const height = img.height;
        
        if (width > 300 || height > 250) {
          this.showError(`Les dimensions de la bannière publicitaire doivent être de 300x250px maximum. Actuel: ${width}x${height}px`);
          // Réinitialiser le média
          this.selectedMedia = [];
          this.activeIndex = 0;
        }
        resolve();
      };
      
      img.onerror = () => resolve();
      img.src = mediaFile.previewUrl;
    });
  }

  onAdvertisementTypeChange(): void {
    // Si on passe à bannière publicitaire et qu'il y a déjà une image, valider les dimensions
    if (this.advertisementType === 'ads_banner' && this.selectedMedia.length > 0) {
      this.validateBannerDimensions(this.selectedMedia[0]);
    }
  }

  isImage(): boolean { return this.activeMedia?.isImage ?? false; }
  isVideo(): boolean { return this.activeMedia?.isVideo ?? false; }

  canProceed(): boolean {
    switch (this.currentStep) {
      case 1:  return this.hasMedia;
      case 2:  return !!this.content.description?.trim();
      default: return true;
    }
  }

  canSubmit(): boolean {
    return this.hasMedia && !!this.content.description?.trim() ;
  }

  isAuthorized(): boolean {
  // AUTORISÉ SI : est vérifié OU (si pas vérifié, alors possède un challenge)
  if (this.CurrentUserProfile?.isVerified) {
    return true; 
  }
  return !!this.selectedChallenge;
}

  nextStep(): void {
    if (this.currentStep >= this.totalSteps) return;
    this.currentStep++;
    this.cdr.markForCheck();
  }

  prevStep(): void {
    if (this.currentStep <= 1) return;
    this.currentStep = this.currentStep - 1;
    this.cdr.markForCheck();
  }

  async submit(): Promise<void> {
    if (!this.hasMedia)                    { this.showError('Veuillez sélectionner un fichier'); return; }
    if (!this.content.description?.trim()) { this.showError('Veuillez ajouter un titre'); return; }

    if(!this.isAuthorized()) {this.showError('Vous n\'avez choisit aucun défi pour ce post'); return;}
    
    this.isUploading = true;
    this.cdr.markForCheck();

    const loading = await this.loadingCtrl.create({ message: 'Publication en cours...' });
    await loading.present();

    try {
      const challengeId = this.selectedChallenge?.creator_id !== this.CurrentUserProfile.id &&
                          !this.selectedChallenge?.is_acceptance_automatic ? '' : this.content.challengeId;
      const newContent = await this.creationService.createContentWithFile(
        this.activeMedia!.file,
        {
          userId:         this.content.userId ?? '',
          description:    this.content.description,
          isPublic:       this.content.isPublic ?? true,
          allowDownloads: this.content.allowDownloads ?? true,
          allowComments:  this.content.allowComments ?? false,
          challengeId:    challengeId ,
          cadrage:        'default' as const,
          status:         this.content.status as ContentStatus,
          likedIds:       [],
          commentIds:     [],
          source:         this.content.source ?? ContentSource.CAMERA,
          category:       this.isAdvertisement 
            ? (this.advertisementType === 'ads_banner' ? ContentCategory.ADS_BANNER : ContentCategory.ADS_POST)
            : ContentCategory.POST,
        }
      ).toPromise();

      if (newContent && this.content.userId) {
        try {
          const profile = await this.profileService.getProfileById(this.content.userId).toPromise();
          if (profile) {
            const stats = profile.stats ?? { posts: 0, fans: 0, votes: 0, stars: 0 };
            await this.profileService.updateProfile(profile.id, {
              stats: { ...stats, posts: (stats.posts ?? 0) + 1 }
            }).toPromise();
          }
        } catch { /* non bloquant */ }
      }

      await loading.dismiss();
     
      if(this.isChallenging && this.selectedChallenge && this.selectedChallenge.participants_count){
        this.selectedChallenge.participants_count +=1;
        this.challengeService.updateChallenge(this.selectedChallenge.id, this.selectedChallenge)
       
        if(!this.selectedChallenge.is_acceptance_automatic)
        this.systemMessenger.sendParticipationRequired_msg(`${this.CurrentUserProfile.displayName} souhaite participer a ${this.selectedChallenge.name} cliquer pour plus d'options`, this.CurrentUserProfile.id, this.CurrentUserProfile.username);
        const alert = await this.alertCtrl.create({
          header:    'Participation au défi',
          subHeader: 'Acceptation en cours de traitement',
          message:   'Attendez de recevoir votre ticket d\'acceptation.',
          buttons:   ['Merci !']
        });
        await alert.present();

    } else {
        this.showSuccess('Contenu publié avec succès !');
      }

      this.resetForm();

    } catch {
      await loading.dismiss();
      this.showError('Erreur lors de la publication');
    } finally {
      this.isUploading = false;
      this.cdr.markForCheck();
    }
  }

  private resetForm(): void {
    this.selectedMedia.forEach(m => URL.revokeObjectURL(m.previewUrl));
    this.selectedMedia = [];
    this.activeIndex   = 0;
    this.content       = { description: '', isPublic: true, allowDownloads: true, allowComments: false };
    this.currentStep   = 1;
    this.cdr.markForCheck();
  }

  private async showError(message: string): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 3000, color: 'danger' });
    await t.present();
  }

  private async showSuccess(message: string): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 3000, color: 'success' });
    await t.present();
  }
}
