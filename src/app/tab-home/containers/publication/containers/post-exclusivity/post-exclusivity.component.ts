import { Component, OnInit, Output, EventEmitter, Input, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  IonIcon,
  IonInput,
  IonTextarea,
  IonToggle,
  IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkmarkOutline,
  videocamOutline,
  imagesOutline,
  starOutline,
  playOutline,
  lockClosedOutline,
  cloudUploadOutline,
  imageOutline,
} from 'ionicons/icons';
import { ExclusiveService } from 'src/services/Service_exclusive_content/exclusive-service';
import { ExclusiveContent, ExclusiveContentType, ExclusiveContentStatus, Author, SeriesInfo, MediaInfo } from 'src/models/Content';

export type CreateExclusiveContentData = Omit<ExclusiveContent, 'id' | 'created_at' | 'updatedAt'> & {
  videoFile?: File;
};

@Component({
  selector: 'app-post-exclusivity',
  templateUrl: './post-exclusivity.component.html',
  styleUrls: ['./post-exclusivity.component.scss'],
  standalone: true,
  imports: [ 
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonIcon,
    IonInput,
    IonTextarea,
    IonToggle,
    IonSpinner
  ],
})
export class PostExclusivityComponent implements OnInit {

  @Input() editMode = false;
  @Input() existingContent?: ExclusiveContent;
  @Output() contentCreated = new EventEmitter<CreateExclusiveContentData>();
  @Output() contentUpdated = new EventEmitter<CreateExclusiveContentData>();

  createForm: FormGroup;
  isSubmitting = false;
  thumbnailPreview: string | null = null;
  videoFileName: string | null = null;

  @ViewChild('thumbnailInput') thumbnailInput!: ElementRef<HTMLInputElement>;
  @ViewChild('videoInput') videoInput!: ElementRef<HTMLInputElement>;

  contentTypes = [
    { value: 'video',       label: 'Vidéo',      icon: 'videocam-outline',      color: '#FF6B6B' },
    { value: 'behind',      label: 'Coulisses',  icon: 'images-outline',        color: '#4ECDC4' },
    { value: 'masterclass', label: 'Masterclass',icon: 'star-outline',          color: '#FFD93D' },
    { value: 'series',      label: 'Série',      icon: 'play-outline',          color: '#6C63FF' },
  ];

  constructor(
    private fb: FormBuilder,
    private exclusiveService: ExclusiveService,
  ) {
    addIcons({
      checkmarkOutline,
      videocamOutline,
      imagesOutline,
      starOutline,
      playOutline,
      lockClosedOutline,
      cloudUploadOutline,
      imageOutline,
    });

    this.createForm = this.fb.group({
      // Champs réellement utilisés
      title:             ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description:       ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]],
      authorName:        ['', Validators.required],
      authorInitials:    ['', Validators.required],
      authorColor:       ['linear-gradient(135deg,#6366f1,#4f46e5)'],
      type:              [ExclusiveContentType.VIDEO, Validators.required],
      locked:            [false],
      price:             [0, [Validators.min(0), Validators.max(999)]],
      isLive:            [false],
      
      // Média
      videoFile:         [null],
      thumbnail:         [null],
      mimeType:          ['video/mp4'],
      fileSize:          [0],
      duration:          [0],
      
      // Série (optionnel)
      isSeries:          [false],
      seriesTitle:       [''],
      episodeNumber:     [1, [Validators.min(1), Validators.max(999)]],
      totalEpisodes:     [null],
      season:            [null],
      
      // Système
      userId:            ['current-user', Validators.required],
      status:            [ExclusiveContentStatus.PUBLISHED]
    });
  }

  ngOnInit() {
    if (this.editMode && this.existingContent) {
      this.populateForm();
    }

    this.createForm.get('type')?.valueChanges.subscribe(type => this.onTypeChange(type));
    this.createForm.get('isSeries')?.valueChanges.subscribe(isSeries => this.onSeriesToggle(isSeries));
  }

  private populateForm(): void {
    if (!this.existingContent) return;
    this.createForm.patchValue({
      title:         this.existingContent.title,
      description:   this.existingContent.description || '',
      type:          this.existingContent.type,
      price:         this.existingContent.price || 0,
      locked:        this.existingContent.locked,
      authorName:    this.existingContent.author.name,
      authorInitials: this.existingContent.author.initials,
      authorColor:   this.existingContent.author.color,
      videoFile:     this.existingContent.media.videoFile,
      thumbnail:     this.existingContent.media.thumbnail,
      mimeType:      this.existingContent.media.mimeType,
      fileSize:      this.existingContent.media.fileSize,
      duration:      this.existingContent.media.duration,
      status:        this.existingContent.status
    });
    
    if (this.existingContent.series) {
      this.createForm.patchValue({
        isSeries:      this.existingContent.series.isSeries,
        seriesTitle:   this.existingContent.series.seriesTitle || '',
        episodeNumber: this.existingContent.series.episodeNumber || 1,
        totalEpisodes: this.existingContent.series.totalEpisodes || null,
        season:        this.existingContent.series.season || null
      });
    }
    
    if (this.existingContent.media.thumbnail) {
      this.thumbnailPreview = this.existingContent.media.thumbnail;
    }
  }

  onTypeChange(type: string): void {
    if (type !== 'series') {
      this.createForm.patchValue({ isSeries: false, seriesTitle: '', episodeNumber: 1, totalEpisodes: null });
    }
  }

  onSeriesToggle(isSeries: boolean): void {
    if (isSeries) {
      this.createForm.patchValue({ type: 'series', locked: false });
      this.createForm.get('seriesTitle')?.setValidators([Validators.required]);
      this.createForm.get('totalEpisodes')?.setValidators([Validators.required, Validators.min(1)]);
    } else {
      this.createForm.get('seriesTitle')?.clearValidators();
      this.createForm.get('totalEpisodes')?.clearValidators();
    }
    this.createForm.get('seriesTitle')?.updateValueAndValidity();
    this.createForm.get('totalEpisodes')?.updateValueAndValidity();
  }

  onThumbnailSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file?.type.startsWith('image/')) {
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
    if (file?.type.startsWith('video/')) {
      this.videoFileName = file.name;
      this.createForm.patchValue({ videoFile: file });
    }
  }

  triggerThumbnailUpload(): void { this.thumbnailInput?.nativeElement?.click(); }
  triggerVideoUpload(): void     { this.videoInput?.nativeElement?.click(); }

  async onSubmit(): Promise<void> {
    if (this.createForm.invalid || this.isSubmitting) {
      this.markFormGroupTouched(this.createForm);
      return;
    }

    this.isSubmitting = true;

    try {
      const formData = this.createForm.value;

      // Construire l'objet MediaInfo
      const mediaInfo: MediaInfo = {
        videoFile: formData.videoFile,
        thumbnail: formData.thumbnail,
        mimeType: formData.mimeType,
        fileSize: formData.fileSize,
        duration: formData.duration
      };

      // Construire l'objet Author
      const author: Author = {
        name: formData.authorName,
        initials: formData.authorInitials,
        color: formData.authorColor
      };

      // Construire l'objet SeriesInfo si c'est une série
      let seriesInfo: SeriesInfo | undefined;
      if (formData.isSeries) {
        seriesInfo = {
          isSeries: formData.isSeries,
          seriesTitle: formData.seriesTitle || undefined,
          episodeNumber: formData.episodeNumber || undefined,
          totalEpisodes: formData.totalEpisodes || undefined,
          season: formData.season || undefined
        };
      }

      const contentData: CreateExclusiveContentData = {
        userId: formData.userId || 'current-user',
        title: formData.title,
        description: formData.description,
        author: author,
        type: formData.type,
        status: formData.status,
        media: mediaInfo,
        locked: formData.locked,
        price: formData.price > 0 ? formData.price : undefined,
        isLive: formData.isLive,
        series: seriesInfo
      };

      let createdContent: ExclusiveContent;

      if (this.editMode && this.existingContent) {
        createdContent = await firstValueFrom(
          this.exclusiveService.updateExclusiveContent(this.existingContent.id as string, contentData)
        );
        this.contentUpdated.emit(contentData);
      } else {
        createdContent = await firstValueFrom(this.exclusiveService.createExclusiveContent(contentData));
        this.contentCreated.emit(contentData);
      }

      console.log('✅ Contenu exclusif créé/mis à jour:', createdContent);
      this.createForm.reset();

    } catch (error) {
      console.error('Error creating/updating content:', error);
    } finally {
      this.isSubmitting = false;
    }
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) this.markFormGroupTouched(control);
    });
  }

  get currentType() {
    return this.contentTypes.find(t => t.value === this.createForm.get('type')?.value);
  }

  get isPremiumContent(): boolean {
    return this.createForm.get('locked')?.value && (this.createForm.get('price')?.value || 0) > 0;
  }

  get formErrors() {
    const errors: any = {};
    const title = this.createForm.get('title');
    const desc  = this.createForm.get('description');

    if (title?.errors?.['required'])   errors.title = 'Requis';
    else if (title?.errors?.['minlength']) errors.title = '3 caractères min.';

    if (desc?.errors?.['required'])    errors.description = 'Requise';
    else if (desc?.errors?.['minlength'])  errors.description = '10 caractères min.';

    if (this.createForm.get('seriesTitle')?.errors?.['required'])
      errors.seriesTitle = 'Requis';

    if (this.createForm.get('totalEpisodes')?.errors?.['required'])
      errors.totalEpisodes = 'Requis';

    return errors;
  }
}