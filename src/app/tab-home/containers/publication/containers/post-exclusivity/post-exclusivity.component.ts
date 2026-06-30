import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ToastController} from '@ionic/angular';
import {
  IonIcon,
  IonInput,
  IonTextarea,
  IonToggle,
  IonSpinner,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonItem,
  IonLabel,
  IonSegment,
  IonSegmentButton
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkmarkOutline,
  videocamOutline,
  imagesOutline,
  starOutline,
  lockClosedOutline,
  cloudUploadOutline,
  imageOutline,
  filmOutline,
  listOutline,
  headsetSharp
} from 'ionicons/icons';
import { ExclusiveContentService } from '../../../../../../services/Service_exclusive_content/exclusive-service';
import { Auth } from '../../../../../../services/AUTH/auth';
import { ExclusiveContent, ExclusiveContentType, ExclusiveContentStatus, Series } from '../../../../../../models/Content';
import { ProfileService } from '../../../../../../services/Service_profile/profile-service';

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
    IonSpinner,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonItem,
    IonLabel,
    IonSegment,
    IonSegmentButton
  ]
})
export class PostExclusivityComponent implements OnInit {
  @Input() contentToEdit?: ExclusiveContent;
  @Output() contentCreated = new EventEmitter<void>();

  createForm!: FormGroup;
  isSubmitting = false;
  creationMode: 'content' | 'series' = 'content'; // Bascule d'affichage sur mobile
  
  availableSeries: Series[] = [];
  selectedVideoFile: File | null = null;
  selectedThumbFile: File | null = null;

  constructor(
    private fb: FormBuilder,
    private exclusiveService: ExclusiveContentService,
    private authService: Auth,
    private profileService: ProfileService,
    private toastController: ToastController
  ) {
    addIcons({
      checkmarkOutline,
      videocamOutline,
      imagesOutline,
      starOutline,
      lockClosedOutline,
      cloudUploadOutline,
      imageOutline,
      filmOutline,
      listOutline
    });
  }

  ngOnInit() {
    this.initForm();
    this.loadSeries();
  }

  private initForm() {
    this.createForm = this.fb.group({
      // Champs Communs / Contenu
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required]],
      type: ['video', [Validators.required]], // video, image, series
      locked: [true],
      price: [0, [Validators.min(0)]],
      
      // Liaison Épisode / Série
      isEpisode: [false],
      seriesId: [''],
      episodeNumber: [null],

      // Structure pour la création de Série seule
      isNewSeries: [false]
    });

    // Écouter les changements pour ajuster dynamiquement les validations sur mobile
    this.createForm.get('isEpisode')?.valueChanges.subscribe((isEp) => {
      const sIdControl = this.createForm.get('seriesId');
      const epNumControl = this.createForm.get('episodeNumber');
      if (isEp) {
        sIdControl?.setValidators([Validators.required]);
        epNumControl?.setValidators([Validators.required, Validators.min(1)]);
      } else {
        sIdControl?.clearValidators();
        epNumControl?.clearValidators();
      }
      sIdControl?.updateValueAndValidity();
      epNumControl?.updateValueAndValidity();
    });
  }

  async loadSeries() {
  try {
    // Correction : utiliser getAllSeries() au lieu de getSeries()
    const res = await firstValueFrom(this.exclusiveService.getAllSeries());
    this.availableSeries = res || [];
  } catch (err) {
    console.error('Erreur chargement des séries', err);
  }
}

  onFileSelected(event: any, target: 'video' | 'thumb') {
    const file = event.target.files?.[0];
    if (!file) return;

    if (target === 'video') {
      this.selectedVideoFile = file;
    } else {
      this.selectedThumbFile = file;
    }
  }

  segmentChanged(event: any) {
    this.creationMode = event.detail.value;
  }

  async presentToast(header: string, message:string, color:"danger"|"success"|"warning"|"dark", duration= 6000){
    const toast = await this.toastController.create({
        header:header,
        message: message,
        color:color,
        duration:duration
      })
      toast.present();
  }
 async onSubmit() {
  if (this.createForm.invalid) {
    this.markFormGroupTouched(this.createForm);
    await this.presentToast("Formulaire invalide", "Veuillez remplir correctement le formulaire", 'danger');
    return;
  }

  this.isSubmitting = true;

  try {
    // 1. Récupération de l'utilisateur connecté
    const userid = this.authService.getCurrentUser()?.id;
    const currentUser = await firstValueFrom(this.profileService.getProfileById(userid || ''));
    if (!currentUser) throw new Error('Utilisateur non connecté');

    // Adapter l'objet author au type attendu par Series
    const authorData = {
      id: currentUser.id,
      name: currentUser.displayName || 'Créateur Anonyme',
      initials: this.getInitials(currentUser.displayName || 'Créateur Anonyme'),
      color: this.getRandomColor(),
      photoURL: currentUser.avatar || '',
      displayName: currentUser.displayName || 'Créateur Anonyme'
    };

    const formValue = this.createForm.value;

    if (this.creationMode === 'series') {
      // --- MODE CREATION DE SERIE ---
      const seriesPayload = {
        title: formValue.title,
        description: formValue.description,
        author: authorData,
        created_at: new Date().toISOString()
      };
      await firstValueFrom(this.exclusiveService.createSeries(seriesPayload));
      await this.presentToast('Succès', 'Série exclusive créée avec succès !', 'success');
    } else {
      // ... reste du code pour les contenus
    }

    // Reset du formulaire
    this.createForm.reset({ type: 'video', locked: true, price: 0, isEpisode: false });
    this.selectedVideoFile = null;
    this.selectedThumbFile = null;
    this.contentCreated.emit();

  } catch (error) {
    console.error('Erreur lors de la soumission :', error);
    await this.presentToast('Erreur', 'Une erreur est survenue lors de la création', 'danger');
  } finally {
    this.isSubmitting = false;
  }
}

// Helper pour générer les initiales
private getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

// Helper pour générer une couleur aléatoire
private getRandomColor(): string {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7B731'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Helper pour obtenir la durée d'une vidéo
private getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => {
      reject(new Error('Cannot get video duration'));
    };
    video.src = URL.createObjectURL(file);
  });
}

private fileToBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const blob = new Blob([e.target?.result as ArrayBuffer], { type: file.type });
      resolve(blob);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) this.markFormGroupTouched(control);
    });
  }
}