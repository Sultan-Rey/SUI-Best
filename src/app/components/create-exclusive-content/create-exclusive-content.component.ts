import { Component, OnInit, Output, EventEmitter, Input, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonToggle,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip,
  IonNote,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  closeOutline,
  checkmarkOutline,
  videocamOutline,
  imagesOutline,
  starOutline,
  playOutline,
  lockClosedOutline,
  lockOpenOutline,
  cloudUploadOutline,
  imageOutline,
} from 'ionicons/icons';
import { ExclusiveService } from '../../../services/Service_exclusive_content/exclusive-service';
import { ExclusiveContent, Series, Author } from '../../../models/Content';

// Type pour la création/édition de contenu (exclut les propriétés générées par le backend)
export type CreateExclusiveContentData = Omit<ExclusiveContent, 'id' | 'created_at' | 'updatedAt'> & {
  videoFile?: File;
};

@Component({
  selector: 'app-create-exclusive-content',
  templateUrl: './create-exclusive-content.component.html',
  styleUrls: ['./create-exclusive-content.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonCardHeader,
    IonInput,
    IonToggle,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle
  ],
})
export class CreateExclusiveContentComponent implements OnInit {

  @Input() editMode = false;
  @Input() existingContent?: ExclusiveContent;
  @Output() contentCreated = new EventEmitter<CreateExclusiveContentData>();
  @Output() contentUpdated = new EventEmitter<CreateExclusiveContentData>();

  createForm: FormGroup;
  isSubmitting = false;
  thumbnailPreview: string | null = null;
  videoFileName: string | null = null;

  // Template references for file inputs
  @ViewChild('thumbnailInput') thumbnailInput!: ElementRef<HTMLInputElement>;
  @ViewChild('videoInput') videoInput!: ElementRef<HTMLInputElement>;

  // Types de contenu avec icônes et couleurs
  contentTypes = [
    { value: 'video', label: 'Vidéo', icon: 'videocam-outline', color: '#FF6B6B' },
    { value: 'behind', label: 'Coulisses', icon: 'images-outline', color: '#4ECDC4' },
    { value: 'masterclass', label: 'Masterclass', icon: 'star-outline', color: '#FFD93D' },
    { value: 'series', label: 'Série', icon: 'play-outline', color: '#6C63FF' },
  ];

  constructor(
    private fb: FormBuilder,
    private exclusiveService: ExclusiveService,
    private modalController: ModalController
  ) {
    addIcons({
      closeOutline,
      checkmarkOutline,
      videocamOutline,
      imagesOutline,
      starOutline,
      playOutline,
      lockClosedOutline,
      lockOpenOutline,
      cloudUploadOutline,
      imageOutline,
    });

    this.createForm = this.fb.group({
      // Propriétés de base Content
      userId: ['', Validators.required],
      challengeId: [''],
      commentIds: [[]],
      likedIds: [[]],
      giftIds: [[]],
      description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]],
      username: [''],
      tags: [[]],
      cadrage: ['default'],
      isPublic: [true],
      allowDownloads: [true],
      allowComments: [true],
      source: ['gallery'],
      status: ['published'],
      fileUrl: ['', Validators.required],
      thumbnailUrl: [''],
      mimeType: ['video/mp4'],
      fileSize: [0],
      duration: [0],
      width: [0],
      height: [0],
      safeUrl: [''],
      
      // Propriétés ExclusiveContent
      title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      author: this.fb.group({
        name: ['', Validators.required],
        initials: ['', Validators.required],
        color: ['linear-gradient(135deg,#6366f1,#4f46e5)']
      }),
      thumbnail: [null],
      locked: [false],
      price: [0, [Validators.min(0), Validators.max(999)]],
      isLive: [false],
      type: ['video', Validators.required],
      
      // Propriétés de série
      seriesId: [''],
      seriesTitle: [''],
      episodeNumber: [1, [Validators.min(1), Validators.max(999)]],
      season: [null],
      totalEpisodes: [null],
      isSeries: [false],
      nextEpisodeId: [''],
      previousEpisodeId: [''],
      
      // Propriété pour le fichier vidéo
      videoFile: [null]
    });
  }

  ngOnInit() {
    if (this.editMode && this.existingContent) {
      this.populateForm();
    }

    // Watch for type changes to show/hide series fields
    this.createForm.get('type')?.valueChanges.subscribe(type => {
      this.onTypeChange(type);
    });

    // Watch for isSeries toggle
    this.createForm.get('isSeries')?.valueChanges.subscribe(isSeries => {
      this.onSeriesToggle(isSeries);
    });
  }

  // ─── Form Methods ─────────────────────────────────────────────────────────────

  private populateForm(): void {
    if (!this.existingContent) return;

    this.createForm.patchValue({
      title: this.existingContent.title,
      description: this.existingContent.description || '',
      type: this.existingContent.type,
      price: this.existingContent.price || 0,
      locked: this.existingContent.locked,
      isSeries: this.existingContent.isSeries || false,
      seriesTitle: this.existingContent.seriesTitle || '',
      episodeNumber: this.existingContent.episodeNumber || 1,
      totalEpisodes: this.existingContent.totalEpisodes || null,
    });

    if (this.existingContent.thumbnail) {
      this.thumbnailPreview = this.existingContent.thumbnail;
    }
  }

  onTypeChange(type: string): void {
    // Reset series-related fields when type changes
    if (type !== 'series') {
      this.createForm.patchValue({
        isSeries: false,
        seriesTitle: '',
        episodeNumber: 1,
        totalEpisodes: null,
      });
    }
  }

  onSeriesToggle(isSeries: boolean): void {
    if (isSeries) {
      this.createForm.patchValue({
        type: 'series',
        locked: false, // Les séries sont généralement gratuites
      });
      this.createForm.get('seriesTitle')?.setValidators([Validators.required]);
      this.createForm.get('totalEpisodes')?.setValidators([Validators.required, Validators.min(1)]);
    } else {
      this.createForm.get('seriesTitle')?.clearValidators();
      this.createForm.get('totalEpisodes')?.clearValidators();
    }
    this.createForm.get('seriesTitle')?.updateValueAndValidity();
    this.createForm.get('totalEpisodes')?.updateValueAndValidity();
  }

  // ─── File Handlers ────────────────────────────────────────────────────────────

  onThumbnailSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.thumbnailPreview = e.target?.result as string;
        this.createForm.patchValue({ thumbnail: file });
      };
      reader.readAsDataURL(file);
    }
  }

  onVideoSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file && file.type.startsWith('video/')) {
      this.videoFileName = file.name;
      this.createForm.patchValue({ videoFile: file });
    }
  }

  // ─── File Input Triggers ─────────────────────────────────────────────────────

  triggerThumbnailUpload(): void {
    this.thumbnailInput?.nativeElement?.click();
  }

  triggerVideoUpload(): void {
    this.videoInput?.nativeElement?.click();
  }

  // ─── Actions ─────────────────────────────────────────────────────────────────

  async onSubmit(): Promise<void> {
    if (this.createForm.invalid || this.isSubmitting) {
      this.markFormGroupTouched(this.createForm);
      return;
    }

    this.isSubmitting = true;

    try {
      const formData = this.createForm.value;
      
      // Préparer les données pour l'API
      const contentData: CreateExclusiveContentData = {
        // Propriétés de base Content
        userId: formData.userId || 'current-user', // TODO: Get from auth service
        challengeId: formData.challengeId || '',
        commentIds: formData.commentIds || [],
        likedIds: formData.likedIds || [],
        giftIds: formData.giftIds || [],
        description: formData.description,
        username: formData.username || '',
        tags: formData.tags || [],
        cadrage: formData.cadrage || 'default',
        isPublic: formData.isPublic ?? true,
        allowDownloads: formData.allowDownloads ?? true,
        allowComments: formData.allowComments ?? true,
        source: formData.source || 'gallery',
        status: formData.status || 'published',
        fileUrl: formData.fileUrl || '',
        thumbnailUrl: formData.thumbnailUrl || '',
        mimeType: formData.mimeType || 'video/mp4',
        fileSize: formData.fileSize || 0,
        duration: formData.duration || 0,
        width: formData.width || 0,
        height: formData.height || 0,
        safeUrl: formData.safeUrl || '',
        
        // Propriétés ExclusiveContent
        title: formData.title,
        author: formData.author,
        thumbnail: formData.thumbnail,
        locked: formData.locked,
        price: formData.price > 0 ? formData.price : undefined,
        isLive: formData.isLive || false,
        type: formData.type,
        
        // Propriétés de série
        seriesId: formData.seriesId || '',
        seriesTitle: formData.seriesTitle || undefined,
        episodeNumber: formData.episodeNumber || undefined,
        season: formData.season || undefined,
        totalEpisodes: formData.totalEpisodes || undefined,
        isSeries: formData.isSeries,
        nextEpisodeId: formData.nextEpisodeId || '',
        previousEpisodeId: formData.previousEpisodeId || '',
        
        // Fichier vidéo
        videoFile: formData.videoFile
      };

      let createdContent: ExclusiveContent;

      if (this.editMode && this.existingContent) {
        // Mode édition : mettre à jour le contenu existant
        createdContent = await firstValueFrom(
          this.exclusiveService.updateExclusiveContent(
            this.existingContent.id, 
            contentData
          )
        );
        this.contentUpdated.emit(contentData);
      } else {
        // Mode création : créer un nouveau contenu
        if (contentData.isSeries && contentData.seriesTitle) {
          // Créer une série si c'est une série
          const seriesData: Omit<Series, 'id' | 'created_at' | 'updated_at'> = {
            title: contentData.seriesTitle,
            description: contentData.description || '',
            author: contentData.author,
            thumbnail: contentData.thumbnail || '',
            type: contentData.type as 'masterclass' | 'behind' | 'series',
            totalEpisodes: contentData.totalEpisodes || 1,
            episodeIds: [], // Sera mis à jour après la création du premier épisode
            price: contentData.price,
            isCompleted: false,
            viewCount: 0,
            likeCount: 0,
            duration: contentData.duration
          };

          const createdSeries = await firstValueFrom(
            this.exclusiveService.createSeries(seriesData)
          );
          
          // Mettre à jour le contenu avec l'ID de la série
          contentData.seriesId = createdSeries.id;
        }

        // Créer le contenu exclusif
        createdContent = await firstValueFrom(
          this.exclusiveService.createExclusiveContent(contentData)
        );
        
        // Si c'est un épisode de série, mettre à jour la série
        if (contentData.isSeries && contentData.seriesId) {
          await firstValueFrom(
            this.exclusiveService.updateSeriesEpisodes(contentData.seriesId)
          );
        }

        this.contentCreated.emit(contentData);
      }

      console.log('✅ Contenu exclusif créé/mis à jour:', createdContent);
      await this.modalController.dismiss({ success: true, content: createdContent });
      
      await this.modalController.dismiss();
    } catch (error) {
      console.error('Error creating/updating content:', error);
      // TODO: Show error toast
    } finally {
      this.isSubmitting = false;
    }
  }

  async dismiss(): Promise<void> {
    await this.modalController.dismiss();
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  get currentType() {
    return this.contentTypes.find(type => type.value === this.createForm.get('type')?.value);
  }

  get isPremiumContent(): boolean {
    return this.createForm.get('locked')?.value && (this.createForm.get('price')?.value || 0) > 0;
  }

  get formErrors() {
    const errors: any = {};
    
    if (this.createForm.get('title')?.errors?.['required']) {
      errors.title = 'Le titre est requis';
    } else if (this.createForm.get('title')?.errors?.['minlength']) {
      errors.title = 'Le titre doit contenir au moins 3 caractères';
    }
    
    if (this.createForm.get('description')?.errors?.['required']) {
      errors.description = 'La description est requise';
    } else if (this.createForm.get('description')?.errors?.['minlength']) {
      errors.description = 'La description doit contenir au moins 10 caractères';
    }
    
    if (this.createForm.get('seriesTitle')?.errors?.['required']) {
      errors.seriesTitle = 'Le titre de la série est requis';
    }
    
    if (this.createForm.get('totalEpisodes')?.errors?.['required']) {
      errors.totalEpisodes = 'Le nombre total d\'épisodes est requis';
    }
    
    return errors;
  }
}
