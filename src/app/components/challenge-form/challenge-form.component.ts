import { 
  Component, 
  EventEmitter, 
  Input, 
  Output, 
  OnInit, 
  ViewChild, 
  ElementRef,
  OnDestroy 
} from '@angular/core';
import { 
  FormBuilder, 
  FormGroup, 
  Validators, 
  FormArray,
  FormControl 
} from '@angular/forms';
import { 
  addIcons 
} from 'ionicons';
import { 
  calendarOutline, 
  timeOutline, 
  closeCircle, 
  checkmarkCircle, 
  addCircle, 
  trash, 
  camera, 
  image, 
  pencil,
  listOutline,
  rocket,
  optionsOutline,
  flash,
  arrowBack,
  stopCircleOutline,
  playCircleOutline,
  giftOutline,
  infinite,
  thumbsUpOutline,
  person,
  informationCircleOutline
} from 'ionicons/icons';
import { ModalController } from '@ionic/angular';
import { ToastController } from '@ionic/angular';
import { Challenge } from '../../../models/Challenge.js';
import { CreationService } from '../../../services/CREATION/creation-service.js';
import { 
  IonIcon, 
  IonSelect, 
  IonSelectOption, 
  IonButtons, 
  IonHeader, 
  IonToolbar, 
  IonButton, 
  IonTitle, 
  IonSpinner, 
  IonContent, 
  IonInput, 
  IonTextarea, 
  IonDatetimeButton, 
  IonDatetime, 
  IonToggle,
  IonModal as ModalIonModal, 
  IonFabButton 
} from "@ionic/angular/standalone";
import { ReactiveFormsModule } from '@angular/forms';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { firstValueFrom, Subscription } from 'rxjs';
import { ChallengeService } from 'src/services/CHALLENGE_SERVICE/challenge-service.js';

@Component({
  selector: 'app-challenge-form',
  templateUrl: './challenge-form.component.html',
  styleUrls: ['./challenge-form.component.scss'],
  standalone: true,
  imports: [
    IonFabButton, 
    ReactiveFormsModule, 
    NgIf, 
    NgFor, 
    IonContent,
    IonIcon, 
    IonSelect, 
    IonSelectOption, 
    IonToggle, 
    IonDatetime, 
    ModalIonModal,
    IonInput, 
    IonTextarea, 
    IonDatetimeButton, 
    IonButtons, 
    IonHeader, 
    IonToolbar, 
    IonButton, 
    IonTitle, 
    IonSpinner,
    DatePipe
  ]
})
export class ChallengeFormComponent implements OnInit, OnDestroy {
  @Input() challenge?: Challenge;
  @Output() challengeSaved = new EventEmitter<Challenge>();
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  
  isLoading = false;
  challengeForm: FormGroup;
  coverImagePreview: string | ArrayBuffer | null = null;
  coverImageFile: File | null = null;
  isEditMode = false;
  today = new Date().toISOString();
  computedEndDate: Date | null = null;
  
  // Options pour le call to action
  callToActionOptions = [
    'Participer',
    'Voter',
    'Soutenir',
    'Voter l\'artiste',
    'J\'approuve',
    'Soutenir ce talent'
  ];

  private subscriptions: Subscription = new Subscription();

  constructor(
    private fb: FormBuilder,
    private creationService: CreationService,
    private challengeService : ChallengeService,
    private modalCtrl: ModalController,
    private toastCtrl: ToastController
  ) {
    this.challengeForm = this.createForm();
  }

  ngOnInit() {
    addIcons({ 
      calendarOutline, 
      timeOutline, 
      closeCircle, 
      checkmarkCircle, 
      addCircle, 
      trash, 
      camera, 
      image, 
      pencil,
      listOutline,
      rocket,
      optionsOutline,
      flash,
      arrowBack,
      stopCircleOutline,
      playCircleOutline,
      giftOutline,
      infinite,
      thumbsUpOutline,
      person,
      informationCircleOutline
    });

    if (this.challenge) {
      this.isEditMode = true;
      this.patchFormValues();
    }
    
    // Calculer la date de fin quand start_date ou duration_days change
    this.subscriptions.add(
      this.challengeForm.get('start_date')?.valueChanges.subscribe(() => {
        this.calculateEndDate();
      })
    );
    
    this.subscriptions.add(
      this.challengeForm.get('duration_days')?.valueChanges.subscribe(() => {
        this.calculateEndDate();
      })
    );

    // Calculer la date de fin initiale
    this.calculateEndDate();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  /**
   * Crée le formulaire - SANS end_date comme champ requis
   */
  createForm(): FormGroup {
    return this.fb.group({
      // Informations de base
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', [Validators.required, Validators.maxLength(1000)]],
      
      // Configuration
      duration_days: [7, [Validators.required, Validators.min(1), Validators.max(365)]],
      vote_rule: ['one_vote_per_user', Validators.required],
      call_to_action: ['Participer', Validators.required],
      
      // Date de début uniquement (end_date sera calculée)
      start_date: [this.today, Validators.required],
      
      // Récompense
      prize: [''],
      
      // Règles
      rules: this.fb.array([this.fb.control('')]),
      
      // Statut
      is_active: [true]
    });
  }

  /**
   * Calcule automatiquement la date de fin
   */
  calculateEndDate() {
    const startDate = this.challengeForm.get('start_date')?.value;
    const durationDays = this.challengeForm.get('duration_days')?.value;
    
    if (startDate && durationDays && durationDays > 0) {
      const start = new Date(startDate);
      const end = new Date(start);
      end.setDate(end.getDate() + parseInt(durationDays));
      this.computedEndDate = end;
    } else {
      this.computedEndDate = null;
    }
  }

  /**
   * Getter pour les règles (FormArray)
   */
  get rules(): FormArray {
    return this.challengeForm.get('rules') as FormArray;
  }

  /**
   * Ajoute une nouvelle règle vide
   */
  addRule() {
    this.rules.push(this.fb.control(''));
  }

  /**
   * Supprime une règle
   */
  removeRule(index: number) {
    if (this.rules.length > 1) {
      this.rules.removeAt(index);
    }
  }

  /**
   * Remplit le formulaire avec les valeurs du challenge existant
   */
  patchFormValues() {
    if (!this.challenge) return;

    // Réinitialiser les règles
    while (this.rules.length) {
      this.rules.removeAt(0);
    }

    // Ajouter les règles existantes
    if (this.challenge.rules && this.challenge.rules.length > 0) {
      this.challenge.rules.forEach(rule => {
        this.rules.push(this.fb.control(rule));
      });
    } else {
      this.rules.push(this.fb.control(''));
    }

    // Mettre à jour les autres champs
    this.challengeForm.patchValue({
      name: this.challenge.name,
      description: this.challenge.description,
      duration_days: this.challenge.duration_days,
      vote_rule: this.challenge.vote_rule,
      call_to_action: this.challenge.call_to_action,
      prize: this.challenge.prize || '',
      start_date: this.challenge.start_date 
        ? new Date(this.challenge.start_date).toISOString() 
        : this.today,
      is_active: this.challenge.is_active !== false
    });

    // Mettre à jour l'aperçu de l'image si elle existe
    if (this.challenge.cover_image_url) {
      this.coverImagePreview = this.challenge.cover_image_url;
    }
  }

  /**
   * Gère le changement de l'image de couverture
   */
  onCoverImageChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      // Vérifier le type de fichier
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        this.showError('Veuillez sélectionner une image valide (JPEG, PNG, GIF, WebP)');
        return;
      }
      
      // Vérifier la taille du fichier (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.showError('L\'image ne doit pas dépasser 5MB');
        return;
      }
      
      this.coverImageFile = file;
      
      // Aperçu de l'image
      const reader = new FileReader();
      reader.onload = () => {
        this.coverImagePreview = reader.result;
      };
      reader.readAsDataURL(file);
    }
  }

  /**
   * Supprime l'image de couverture
   */
  removeCoverImage() {
    this.coverImageFile = null;
    this.coverImagePreview = null;
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  /**
   * Soumet le formulaire
   */
 async onSubmit() {
  if (this.challengeForm.invalid) {
    this.markFormGroupTouched(this.challengeForm);
    await this.showError('Veuillez corriger les erreurs dans le formulaire');
    return;
  }

  try {
    this.isLoading = true;
    const formData = this.prepareFormData();
    
    let result: Challenge;
    
    if (this.isEditMode && this.challenge) {
      // Mise à jour du défi existant
      if (this.coverImageFile) {
        result = await firstValueFrom(
          this.challengeService.createChallengeWithCoverImage(
            this.coverImageFile,
            formData as Omit<Challenge, 'id' | 'created_at' | 'is_active' | 'cover_image_url'>,
            (progress) => {
              console.log(`Progression de l'upload: ${progress}%`);
            }
          )
        );
      } else {
        const updateData = { 
          ...formData,
          id: this.challenge.id 
        };
        result = await this.updateChallenge(updateData);
      }
    } else {
      // Création d'un nouveau défi
      if (this.coverImageFile) {
        result = await firstValueFrom(
          this.challengeService.createChallengeWithCoverImage(
            this.coverImageFile,
            formData as Omit<Challenge, 'id' | 'created_at' | 'is_active' | 'cover_image_url'>,
            (progress) => {
              console.log(`Progression de l'upload: ${progress}%`);
            }
          )
        );
      } else {
        result = await firstValueFrom(
          this.challengeService.createChallenge(
            formData as Omit<Challenge, 'id' | 'created_at' | 'is_active'>
          )
        );
      }
    }

    this.challengeSaved.emit(result);
    
    await this.modalCtrl.dismiss({ 
      success: true, 
      challenge: result,
      isEdit: this.isEditMode
    });

    await this.showSuccess(
      this.isEditMode 
        ? 'Défi mis à jour avec succès !' 
        : 'Défi créé avec succès !'
    );

  } catch (error: any) {
    console.error('Erreur lors de la sauvegarde du défi', error);
    
    let errorMessage = 'Erreur lors de la sauvegarde du défi';
    if (error.message?.includes('Échec de l\'upload')) {
      errorMessage = 'Échec de l\'upload de l\'image. Veuillez réessayer.';
    }
    
    await this.showError(errorMessage);
  } finally {
    this.isLoading = false;
  }
}

  /**
   * Met à jour un challenge existant
   */
  private async updateChallenge(challengeData: Partial<Challenge>): Promise<Challenge> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (this.challenge) {
          const updatedChallenge: Challenge = {
            ...this.challenge,
            ...challengeData
          };
          resolve(updatedChallenge);
        } else {
          reject(new Error('Challenge non défini'));
        }
      }, 500);
    });
  }

  /**
   * Prépare les données du formulaire pour l'API
   */
  prepareFormData(): Partial<Challenge> {
  const formValue = this.challengeForm.value;
  
  // Filtrer les règles vides
  const filteredRules = formValue.rules
    .filter((rule: string) => rule && rule.trim() !== '')
    .map((rule: string) => rule.trim());
  
  // Calculer la date de fin automatiquement
  let endDate: Date | undefined;
  if (formValue.start_date && formValue.duration_days) {
    const startDate = new Date(formValue.start_date);
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + formValue.duration_days);
  }

  // Créer l'objet de données avec tous les champs
  const formData: any = {
    name: formValue.name?.trim(),
    description: formValue.description?.trim(),
    duration_days: formValue.duration_days,
    vote_rule: formValue.vote_rule,
    call_to_action: formValue.call_to_action,
    start_date: formValue.start_date ? new Date(formValue.start_date) : undefined,
    end_date: endDate,
    is_active: formValue.is_active
  };

  // Ajouter les champs optionnels s'ils ont une valeur
  if (formValue.prize?.trim()) {
    formData.prize = formValue.prize.trim();
  }

  if (filteredRules.length > 0) {
    formData.rules = filteredRules;
  }

  return formData;
}

  /**
   * Annule et ferme le modal
   */
  onCancel() {
    this.modalCtrl.dismiss({ 
      cancelled: true 
    });
  }

  /**
   * Marque tous les champs comme "touched" pour afficher les erreurs
   */
  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      } else if (control instanceof FormArray) {
        control.controls.forEach(arrayControl => {
          arrayControl.markAsTouched();
        });
      }
    });
  }

  /**
   * Affiche un message d'erreur
   */
  private async showError(message: string) {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 3000,
      color: 'danger',
      position: 'top',
      buttons: [
        {
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }

  /**
   * Affiche un message de succès
   */
  private async showSuccess(message: string) {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 2000,
      color: 'success',
      position: 'top'
    });
    await toast.present();
  }
}