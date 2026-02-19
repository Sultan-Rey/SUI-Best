import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MediaUrlPipe } from 'src/app/utils/pipes/mediaUrlPipe/media-url-pipe';
import { 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonButtons, 
  IonButton, 
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonIcon,
  IonAvatar,
  IonImg,
  IonSpinner
} from '@ionic/angular/standalone';
import { User, UserProfile } from 'src/models/User.js';
import { ProfileService } from 'src/services/PROFILE_SERVICE/profile-service.js';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { addIcons } from 'ionicons';
import { camera, close, checkmark, closeOutline, checkmarkOutline, cameraOutline, createOutline, alertCircleOutline, mailOutline, informationCircleOutline } from 'ionicons/icons';
import { CameraService } from 'src/services/CAMERA_SERVICE/camera-service';

@Component({
  selector: 'app-modal-edit-profile',
  templateUrl: './modal-edit-profile.component.html',
  styleUrls: ['./modal-edit-profile.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
    IonIcon,
    IonAvatar,
    IonImg,
    IonSpinner,
    MediaUrlPipe
  ]
})
export class ModalEditProfileComponent implements OnInit {
  @Input() profile!: UserProfile;

  editForm!: FormGroup;
  isSubmitting = false;
  avatarPreview: string | null = null;
  uploadProgress: number = 0;
  selectedFile: File | null = null;
  constructor(
    private modalController: ModalController,
    private formBuilder: FormBuilder,
    private profileService: ProfileService,
    private cameraService: CameraService,
    private toastController: ToastController
  ) {
    addIcons({closeOutline,checkmarkOutline,cameraOutline,createOutline,alertCircleOutline,mailOutline,informationCircleOutline,camera,close,checkmark});
  }

  ngOnInit() {
    this.initializeForm();
    this.avatarPreview = this.profile.avatar;
  }

  private initializeForm() {
    this.editForm = this.formBuilder.group({
      displayName: [this.profile.displayName, [Validators.required, Validators.maxLength(50)]],
      bio: [this.profile.bio, [Validators.maxLength(500)]],
      contact: [this.profile.contact, [Validators.email]]
    });
  }

  async selectAvatar() {
     try {
          const photo = await this.cameraService.pickFromGallery();
          this.selectedFile = await this.cameraService.convertPhotoToFile(photo);
          this.avatarPreview = photo.webPath || null;
          
        } catch (error) {
          console.error('Erreur avec la galerie:', error);
        }
  }

  async onSubmit() {
    if (this.editForm.invalid || this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;
      const formValue = this.editForm.value;
  
      let updatedProfile = {
        avatar: this.profile.avatar,
        displayName: formValue.displayName,
        bio: formValue.bio,
        contact: formValue.contact,
        isAvatarChange: false
      };

      // Vérifier si l'avatar a été modifié
      if (this.avatarPreview !== this.profile.avatar){
          const updates =  this.profileService.updateProfileWithAvatar(
              this.selectedFile as File,
              this.profile.id,
              updatedProfile 
            ).toPromise();
      
      updates.then((updatedProfile)=>{
        this.modalController.dismiss({
          success: true,
          profile: updatedProfile
        });
      })
    }else{
      const updates = this.profileService.updateProfile(this.profile.id, updatedProfile).toPromise(); 
     updates.then((updatedProfile)=>{
        this.modalController.dismiss({
          success: true,
          profile: updatedProfile
        });
      })
    }
     /* if (updates) {
        setTimeout(async ()=>{
          await this.modalController.dismiss({
          success: true,
          profile: updates
        });
        },500);
        
        
      }*/
    
  }

  async dismiss() {
    await this.modalController.dismiss();
  }

  private async presentToast(message: string, color: 'success' | 'danger' | 'warning' = 'success', duration: number = 2000) {
    const toast = await this.toastController.create({
      message,
      duration,
      position: 'bottom',
      color
    });
    await toast.present();
  }

  get displayNameControl() {
    return this.editForm.get('displayName');
  }

  get bioControl() {
    return this.editForm.get('bio');
  }

  get contactControl() {
    return this.editForm.get('contact');
  }

  onImageAvatarError(event: any) {
    const imgElement = event.target as HTMLImageElement;
    imgElement.onerror = null;
    imgElement.src = 'assets/avatar-default.png';
    imgElement.classList.add('is-default');
  }
}
