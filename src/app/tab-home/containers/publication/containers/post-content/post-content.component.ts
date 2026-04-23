import { Component, OnDestroy, Input, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import {
  ActionSheetController, AlertController,
  LoadingController, ToastController, ModalController
} from '@ionic/angular';
import { CameraService, MediaFile } from 'src/services/CAMERA/camera-service';
import { CreationService } from 'src/services/Service_content/creation-service';
import { Content, ContentSource, ContentStatus, ContentCategory } from 'src/models/Content';
import { IonToggle, IonTextarea, IonIcon, IonRadioGroup, IonRadio, IonSpinner, IonProgressBar } from '@ionic/angular/standalone';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  camera, arrowBack, close, settings, checkmarkCircle, image, images, closeCircle,
  globe, lockClosed, download, heartOutline, chatbubbleOutline, shareOutline,
  expand, contract, imageOutline, cameraOutline, imagesOutline, videocam,
  phonePortraitOutline, closeCircleOutline, trophyOutline, arrowRedoOutline,
  expandOutline, contractOutline, checkmark, timeOutline } from 'ionicons/icons';
import { Challenge } from 'src/models/Challenge';
import { ProfileService } from 'src/services/Service_profile/profile-service';
import { ChallengeService } from 'src/services/Service_challenge/challenge-service';
import { UserProfile } from 'src/models/User';
import { isNullOrUndefined } from 'html5-qrcode/esm/core';
import { SystemMessenger } from 'src/services/Service_message/system-messenger';
import { lastValueFrom, Observable } from 'rxjs';

@Component({
  selector: 'app-post-content',
  templateUrl: './post-content.component.html',
  styleUrls: ['./post-content.component.scss'],
  standalone: true,
  providers: [ModalController],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonProgressBar, 
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
  uploadProgress  = 0;
  isPickingMedia  = false;
  isUploading     = false;
  isPublic        = true;
  isLocked        = false;
  isAdvertisement = false;
  advertisementType = 'ads_post';
  
  // Optimistic upload
  backgroundUploadUuid = '';
  isBackgroundUploadActive = false;
  backgroundUploadProgress = 0;
  uploadedThumbnailUrl = '';
  uploadedVideoUrl = '';
  
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
    addIcons({arrowBack,imageOutline,close,videocam,checkmark,cameraOutline,imagesOutline,timeOutline,closeCircleOutline,trophyOutline,image,phonePortraitOutline,heartOutline,chatbubbleOutline,arrowRedoOutline,expandOutline,contractOutline,settings,checkmarkCircle,images,camera,closeCircle,shareOutline,expand,contract,globe,lockClosed,download});
  }

  ngOnInit(): void { 
    // Initialiser le userId avec l'utilisateur courant
    this.content.userId = this.CurrentUserProfile?.id ?? '';
  
    if(!isNullOrUndefined(this.isChallenging) )
      this.selectedChallenge = this.challenges[0];
    else
       this.loadChallenges(); 
     
    if(this.CurrentUserProfile.type == 'admin' || this.isChallenging){
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
    this.stopOptimisticUpload();
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

  /**
   * Démarre l'upload optimiste (sans métadonnées)
   */
  async startOptimisticUpload(): Promise<void> {
    if (!this.activeMedia?.isVideo) return;
    
    const file = this.activeMedia.file;
    const thumbBlob = await this.cameraService.generateThumbnail(file);
    
    // Démarrer l'upload optimiste
    this.backgroundUploadUuid = crypto.randomUUID();
    this.isBackgroundUploadActive = true;
    
    //console.log('[PostContent] Starting optimistic upload:', this.backgroundUploadUuid);
    
    // S'abonner à la progression
    this.creationService.uploadVideoFilesOnly(file, thumbBlob).subscribe({
      next: (result) => {
        this.backgroundUploadProgress = result.progress;
        
        if (result.thumbnailUrl) {
          this.uploadedThumbnailUrl = result.thumbnailUrl;
        }
        
        if (result.videoUrl) {
          this.uploadedVideoUrl = result.videoUrl;
        }
        
       // console.log('[PostContent] Upload progress:', result.progress + '%');
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('[PostContent] Optimistic upload error:', err);
        this.stopOptimisticUpload();
      },
      complete: () => {
        console.log('[PostContent] Optimistic upload completed');
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Arrête l'upload optimiste
   */
  stopOptimisticUpload(): void {
    this.isBackgroundUploadActive = false;
    this.backgroundUploadUuid = '';
    this.backgroundUploadProgress = 0;
    this.uploadedThumbnailUrl = '';
    this.uploadedVideoUrl = '';
    this.cdr.markForCheck();
  }

  /**
   * Vérifie si un upload optimiste est en cours et terminé
   */
  isOptimisticUploadCompleted(): boolean {
    return this.isBackgroundUploadActive && 
           this.backgroundUploadProgress === 100 && 
           !!this.uploadedThumbnailUrl && 
           !!this.uploadedVideoUrl;
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
      // Utiliser la nouvelle méthode pickMedias qui supporte les vidéos ET les images
      const mediaFiles = await this.cameraService.pickMultiple();
      
      if (mediaFiles.length > 0) {
        // Prendre le premier média pour l'instant
        this.setMedia(mediaFiles);
        this.content.source = ContentSource.GALLERY;
      }
    } catch (error: any) {
      if (error?.message?.includes('User cancelled')) {
        return; // Annulation silencieuse
      }
      this.showError('Interruption du chargement de la galerie');
    } finally {
      this.isPickingMedia = false;
      this.cdr.markForCheck();
    }
  }

  async pickFromRecentGallery(): Promise<void> {
    this.isPickingMedia = true;
    this.cdr.markForCheck();
    
    try {
      // Utiliser getRecentGalleryItems pour scanner la galerie
      const recentItems = await this.cameraService.getRecentGalleryItems(50);
      
      if (recentItems.length === 0) {
        this.showError('Aucun média récent trouvé');
        return;
      }
      
      // Créer une modale pour choisir parmi les médias récents
      const selectedMedia = await this.showRecentMediaSelector(recentItems);
      
      if (selectedMedia) {
        // Convertir l'item sélectionné en MediaFile
        const mediaFile = await this.convertRecentItemToMediaFile(selectedMedia);
        this.setMedia([mediaFile]);
        this.content.source = ContentSource.GALLERY;
      }
    } catch (error: any) {
      if (error?.message?.includes('User cancelled')) {
        return; // Annulation silencieuse
      }
      console.error('[PostContent] Erreur galerie récente:', error);
      this.showError('Impossible d\'accéder à la galerie récente');
    } finally {
      this.isPickingMedia = false;
      this.cdr.markForCheck();
    }
  }

  private async showRecentMediaSelector(items: any[]): Promise<any> {
    return new Promise((resolve) => {
      // Créer une modale simple pour choisir un média
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 20px;
        overflow-y: auto;
      `;
      
      const content = document.createElement('div');
      content.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 20px;
        max-width: 90%;
        max-height: 80%;
        overflow-y: auto;
      `;
      
      const title = document.createElement('h3');
      title.textContent = 'Médias récents';
      title.style.cssText = 'margin: 0 0 15px 0; color: #333; text-align: center;';
      
      const grid = document.createElement('div');
      grid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
        gap: 10px;
        margin-bottom: 20px;
      `;
      
      items.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.style.cssText = `
          cursor: pointer;
          border: 2px solid transparent;
          border-radius: 8px;
          overflow: hidden;
          aspect-ratio: 1;
          position: relative;
        `;
        
        const img = document.createElement('img');
        img.src = item.preview;
        img.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: cover;
        `;
        
        const typeIcon = document.createElement('div');
        typeIcon.style.cssText = `
          position: absolute;
          bottom: 5px;
          right: 5px;
          background: ${item.type === 'video' ? '#FF3B30' : '#007AFF'};
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: bold;
        `;
        typeIcon.textContent = item.type === 'video' ? '▶' : '📷';
        
        itemDiv.appendChild(img);
        itemDiv.appendChild(typeIcon);
        
        itemDiv.addEventListener('click', () => {
          document.body.removeChild(modal);
          resolve(item);
        });
        
        itemDiv.addEventListener('mouseenter', () => {
          itemDiv.style.borderColor = '#007AFF';
        });
        
        itemDiv.addEventListener('mouseleave', () => {
          itemDiv.style.borderColor = 'transparent';
        });
        
        grid.appendChild(itemDiv);
      });
      
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Annuler';
      cancelBtn.style.cssText = `
        padding: 12px 24px;
        background: #8E8E93;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 16px;
        width: 100%;
      `;
      
      cancelBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(null);
      });
      
      content.appendChild(title);
      content.appendChild(grid);
      content.appendChild(cancelBtn);
      modal.appendChild(content);
      document.body.appendChild(modal);
      
      // Fermer en cliquant en dehors
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          document.body.removeChild(modal);
          resolve(null);
        }
      });
    });
  }

  private async convertRecentItemToMediaFile(item: any): Promise<MediaFile> {
    // Télécharger le média depuis le chemin natif
    const response = await fetch(item.preview);
    const blob = await response.blob();
    const file = new File([blob], `media_${Date.now()}.${this.getExtensionFromType(item.type)}`, { 
      type: item.type === 'video' ? 'video/mp4' : 'image/jpeg' 
    });
    
    return await this.cameraService['buildMediaFile'](file, item.preview);
  }

  private getExtensionFromType(type: string): string {
    return type === 'video' ? 'mp4' : 'jpg';
  }

  removeMedia(event: Event): void {
    event.stopPropagation();
    this.selectedMedia.forEach(m => URL.revokeObjectURL(m.previewUrl));
    this.selectedMedia = [];
    this.activeIndex   = 0;
    this.stopOptimisticUpload(); // Arrêter l'upload en cours
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
    
    // Arrêter l'upload optimiste précédent
    this.stopOptimisticUpload();

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
        
        if (width > 400 || height > 210) {
          this.showError(`Les dimensions de la bannière publicitaire doivent être de 400x250px maximum. Actuel: ${width}x${height}px`);
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
  if (this.CurrentUserProfile?.isVerified || this.CurrentUserProfile?.type === 'admin') {
    return true; 
  }
  return !!this.selectedChallenge;
}

  nextStep(): void {
    if (this.currentStep >= this.totalSteps) return;
    this.currentStep++;
    
    // Étape 2 : Démarrer l'optimistic upload pour les vidéos
    if (this.currentStep === 2 && this.activeMedia?.isVideo) {
      this.startOptimisticUpload();
    }
    
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
    if(!this.isAuthorized()){
      this.alertCtrl.create({
        header:"Publication non autorisé",
        subHeader:"Votre compte n'est pas verifié",
        message:"Vous ne pouvez pas publier de contenu hors challenge si votre compte n'est pas verifié",
        buttons: ['J\'ai compris']
      }).then((alert)=>alert.present());
      return;
    }
  this.isUploading = true;
  this.uploadProgress = 0;
  this.cdr.markForCheck();

  try {
    const metadata = {
      userId:         this.content.userId ?? '',
      description:    this.content.description,
      isPublic:       this.isPublic,
      allowDownloads: this.content.allowDownloads ?? true,
      allowComments:  this.content.allowComments ?? false,
      challengeId:    this.selectedChallenge?.id ?? '',
      cadrage:        'default',
      width:          this.activeMedia?.width,
      height:         this.activeMedia?.height,
      duration:       this.activeMedia?.duration,
      username:       this.CurrentUserProfile.displayName,
      publishedAt:    new Date(Date.now()),
      status:         this.content.status,
      fileSize:       this.activeMedia!.file.size ?? 0,
      source:         this.content.source,
      category:       this.isAdvertisement ? 'ADS_POST' : 'POST'
    };

    if (this.activeMedia?.isVideo) {
      // VIDÉO : gérer l'optimistic upload
      
      if (this.isOptimisticUploadCompleted()) {
        // Upload déjà terminé : créer le Content avec les URLs
        //console.log('[PostContent] Using uploaded files:', this.uploadedThumbnailUrl, this.uploadedVideoUrl);
        
        this.creationService.createContentWithUploadedFiles(
          this.uploadedThumbnailUrl,
          this.uploadedVideoUrl,
          metadata
        ).subscribe({
          next: (content) => {
            this.uploadProgress = 100;
            this.handleSuccess(content);
          },
          error: (err) => {
            this.isUploading = false;
            this.showError('Erreur de publication');
            this.cdr.markForCheck();
          }
        });
        
      } else if (this.isBackgroundUploadActive) {
        // Upload en cours : attendre la fin
        console.log('[PostContent] Waiting for upload completion...');
        
        // Surveiller la progression jusqu'à 100%
        const checkInterval = setInterval(() => {
          this.uploadProgress = this.backgroundUploadProgress;
          this.cdr.markForCheck();
          
          if (this.isOptimisticUploadCompleted()) {
            clearInterval(checkInterval);
            
            // Créer le Content avec les URLs
            this.creationService.createContentWithUploadedFiles(
              this.uploadedThumbnailUrl,
              this.uploadedVideoUrl,
              metadata
            ).subscribe({
              next: (content) => {
                this.uploadProgress = 100;
                this.handleSuccess(content);
              },
              error: (err) => {
                this.isUploading = false;
                this.showError('Erreur de publication');
                this.cdr.markForCheck();
              }
            });
          }
        }, 500);
        
      } else {
        // Pas d'upload en cours : upload normal
        let file = this.activeMedia!.file;
        if (file.size > 3 * 1024 * 1024) {
          file = await this.cameraService.compressImage(file, 2048, 0.85);
        }
        
        const thumbBlob = await this.cameraService.generateThumbnail(file);
        this.creationService.createVideoWithThumbnail(file, thumbBlob, metadata).subscribe({
          next: (val) => {
            this.uploadProgress = val.progress;
            this.cdr.markForCheck();

            if (val.content) this.handleSuccess(val.content);
          },
          error: (err) => {
            this.isUploading = false;
            this.showError('Erreur de publication');
            this.cdr.markForCheck();
          }
        });
      }
      
    } else {
      // IMAGE : upload normal
      let file = this.activeMedia!.file;
      if (file.size > 3 * 1024 * 1024) {
        file = await this.cameraService.compressImage(file, 2048, 0.85);
      }
      
      this.creationService.createContentWithFile(file, metadata).subscribe({
        next: (val) => {
          this.uploadProgress = val.progress;
          this.cdr.markForCheck();

          if (val.content) this.handleSuccess(val.content);
        },
        error: (err) => {
          this.isUploading = false;
          this.showError('Erreur de publication');
          this.cdr.markForCheck();
        }
      });
    }

  } catch (error) {
    this.isUploading = false;
    this.showError('Erreur technique');
  }
}

 

  // post-content-deriver.ts

/**
 * Gère les actions à effectuer après une publication réussie
 * @param content Le contenu créé retourné par le backend
 */
private async handleSuccess(content: Content): Promise<void> {
  // 1. Mise à jour des statistiques du profil (incrémentation du nombre de posts)
  // Utilise le profileService injecté dans le constructeur
  await this.updateProfileStats(content.userId);

  // 2. Gestion spécifique si c'est une participation à un challenge
  // Utilise la logique de notification et de compteur de participants
  await this.manageChallengeContent();

  // 3. Réinitialisation complète de l'interface
  this.resetForm();

  // 4. Notification visuelle à l'utilisateur
  // Si ce n'est pas un challenge (déjà géré dans manageChallengeContent), on affiche un succès simple
  if (!this.isChallenging) {
    this.showSuccess('Contenu publié avec succès !');
  }

  // 5. Fin de l'état d'upload
  this.isUploading = false;
  this.uploadProgress = 100;
  
  // Force la détection de changement pour mettre à jour l'UI (barre de progression, spinner)
  this.cdr.markForCheck();
}

  private async updateProfileStats(profileId: string){
try {
          const profile = await this.profileService.getProfileById(profileId).toPromise();
          if (profile) {
            const stats = profile.stats ?? { posts: 0, fans: 0, votes: 0, stars: 0 };
            await this.profileService.updateProfile(profile.id, {
              stats: { ...stats, posts: (stats.posts ?? 0) + 1 }
            }).toPromise();
          }
        } catch { /* non bloquant */ }
  }

  private async manageChallengeContent(){
if(this.isChallenging && this.selectedChallenge && this.selectedChallenge.participants_count){
        this.selectedChallenge.participants_count +=1;
        this.challengeService.updateChallenge(this.selectedChallenge.id, this.selectedChallenge)
       
        if(!this.selectedChallenge.is_acceptance_automatic)
        this.systemMessenger.sendParticipationRequired_msg(`${this.CurrentUserProfile.displayName} souhaite participer a ${this.selectedChallenge.name} cliquer pour plus d'options`, this.selectedChallenge.creator_id, this.CurrentUserProfile.username);
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
  }

  private resetForm(): void {
    this.selectedMedia.forEach(m => URL.revokeObjectURL(m.previewUrl));
    this.selectedMedia = [];
    this.activeIndex   = 0;
    this.content       = { description: '', isPublic: true, allowDownloads: true, allowComments: false };
    this.currentStep   = 1;
    this.stopOptimisticUpload(); // Arrêter l'upload en cours
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
