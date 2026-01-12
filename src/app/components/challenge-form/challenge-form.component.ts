import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { Challenge, VoteRule } from '../../../models/Challenge';
import { CreationService } from '../../../services/CREATION/creation-service';
import { IonIcon, IonSelect, IonSelectOption, IonButtons, IonHeader, IonToolbar, IonButton, IonTitle, IonSpinner, IonContent, IonItem, IonLabel, IonInput, IonNote, IonTextarea, IonItemGroup, IonDatetimeButton, IonModal, IonDatetime, IonToggle } from "@ionic/angular/standalone";
import { ReactiveFormsModule } from '@angular/forms';
import { NgIf, NgFor } from '@angular/common';
@Component({
  selector: 'app-challenge-form',
  templateUrl: './challenge-form.component.html',
  styleUrls: ['./challenge-form.component.scss'],
  standalone: true,
  imports:[ReactiveFormsModule, NgIf, NgFor, IonIcon, IonItem, IonLabel, IonSelect, IonSelectOption, IonToggle, IonDatetime, IonModal, IonInput, IonTextarea, IonNote, IonDatetimeButton, IonButtons, IonHeader, IonToolbar, IonButton, IonTitle, IonSpinner, IonItemGroup, IonContent]
})
export class ChallengeFormComponent implements OnInit {
  @Input() challenge: Challenge | null = null;
  @Output() formSubmitted = new EventEmitter<Challenge>();
  
  challengeForm!: FormGroup;
  isEditMode = false;
  isLoading = false;
  
  voteRules = [
    { value: 'one_vote_per_user', label: 'Un vote par utilisateur' },
    { value: 'unlimited_votes', label: 'Votes illimités' }
  ];

  callToActionOptions = [
    { value: 'Participer', label: 'Participer' },
    { value: 'Voter', label: 'Voter' },
    { value: 'Soutenir', label: 'Soutenir' },
    { value: 'Voter l\'artiste', label: 'Voter l\'artiste' },
    { value: 'J\'approuve', label: 'J\'approuve' },
    { value: 'Soutenir ce talent', label: 'Soutenir ce talent' }
  ];

  constructor(
    private fb: FormBuilder,
    private creationService: CreationService,
    private modalCtrl: ModalController
  ) {
    this.initForm();
  }

  ngOnInit() {
    if (this.challenge) {
      this.isEditMode = true;
      this.patchFormValues();
    }
  }

  private initForm() {
    this.challengeForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      duration_days: [7, [Validators.required, Validators.min(1)]],
      vote_rule: ['one_vote_per_user', Validators.required],
      call_to_action: ['Participer', Validators.required],
      prize: [''],
      rules: this.fb.array(['']),
      start_date: [new Date().toISOString()],
      end_date: [this.getDefaultEndDate()],
      cover_image_url: [''],
      is_active: [true]
    });
  }

  private patchFormValues() {
    if (!this.challenge) return;

    // Réinitialiser le tableau des règles
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
      start_date: this.challenge.start_date ? 
        new Date(this.challenge.start_date).toISOString() : 
        new Date().toISOString(),
      end_date: this.challenge.end_date ? 
        new Date(this.challenge.end_date).toISOString() : 
        this.getDefaultEndDate(),
      cover_image_url: this.challenge.cover_image_url || '',
      is_active: this.challenge.is_active !== false
    });
  }

  get rules() {
    return this.challengeForm.get('rules') as FormArray;
  }

  addRule() {
    this.rules.push(this.fb.control(''));
  }

  removeRule(index: number) {
    if (this.rules.length > 1) {
      this.rules.removeAt(index);
    }
  }

  private getDefaultEndDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 7); // 7 jours par défaut
    return date.toISOString();
  }

  onCoverImageChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      // Implémentez ici la logique de téléchargement
      // this.uploadService.upload(file).subscribe(url => {
      //   this.challengeForm.patchValue({ cover_image_url: url });
      // });
    }
  }

  async onSubmit() {
    if (this.challengeForm.invalid || this.isLoading) {
      return;
    }

    this.isLoading = true;
    const formValue = this.prepareFormData();

    try {
      let result: Challenge;
      
      if (this.isEditMode && this.challenge) {
        result = await this.creationService.updateChallenge(this.challenge.id, formValue).toPromise() as Challenge;
      } else {
        result = await this.creationService.createChallenge(formValue).toPromise() as Challenge;
      }

      this.modalCtrl.dismiss({ 
        success: true, 
        challenge: result,
        isEdit: this.isEditMode
      });
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du défi', error);
      // Afficher une alerte d'erreur
    } finally {
      this.isLoading = false;
    }
  }

  private prepareFormData() {
    const formValue = {
      ...this.challengeForm.value,
      rules: this.challengeForm.value.rules.filter((r: string) => r.trim() !== ''),
      start_date: new Date(this.challengeForm.value.start_date),
      end_date: new Date(this.challengeForm.value.end_date)
    };

    // Si c'est une édition, on garde l'ID existant
    if (this.isEditMode && this.challenge) {
      return { ...formValue, id: this.challenge.id };
    }

    return formValue;
  }

  onCancel() {
    this.modalCtrl.dismiss();
  }
}