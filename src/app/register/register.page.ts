import { NgIf, NgFor, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ActionSheetController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { ModalQRscannerComponent } from '../components/modal-qrscanner/modal-qrscanner.component';
import { Plan } from 'src/models/Plan';
import { addIcons } from 'ionicons';  
import { v4 as uuidv4 } from 'uuid';

// Interface sur mesure pour le template de register
interface RegisterModel {
  // Propriétés de base de User
  id: string;
  email: string;
  password_hash: string;
  QR_proof: string;
  password: string;
  confirmPassword: string;
  user_type: string;
  user_status: string;
  status: string;
  readonly: boolean;
  myPlan: Plan;
  registration_date: string;
  // Propriétés de UserInfo
  first_name: string;
  last_name: string;
  gender: string;
  birthDate: Date;
  age: number;
  phone: string;
  address: string;
  website: string;
  bio: string;
  school: { id: string; name: string };
  memberShip?: { date: string; plan: string };
}  
import { 
  arrowBack,
  cloudUpload,
  closeCircle,
  eye,
  eyeOff,
  checkmarkCircle,
  pencilOutline,
  camera,
  mail,
  lockClosed,
  logoGoogle,
  logoFacebook,
  personCircle,
  school,
  book,
  person,
  musicalNotes,
  male,
  female,
  transgender,
  chevronBack,
  arrowForward,
  calendar,
  calendarOutline,
  callOutline,
  locationOutline,
  todayOutline,
  closeOutline,
  mailOutline,
  lockClosedOutline,
  qrCodeOutline,
  heart,
  create,
  trashOutline,
} from 'ionicons/icons';
import { 
  IonHeader, 
  IonToolbar, 
  IonIcon, 
  IonButton, 
  IonLabel,
  IonItem,
  IonInput,
  IonTitle,
  IonButtons,
  IonContent, IonLoading, IonGrid, IonRow, IonCol, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonModal, IonDatetime } from '@ionic/angular/standalone';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
    providers: [ModalController],
   imports: [IonDatetime, IonModal, IonCardContent, IonCardTitle, IonCardHeader, IonCard, IonCol, IonRow, IonGrid, IonLoading, NgIf,NgFor,DatePipe, FormsModule,IonHeader, IonToolbar, IonIcon, IonButton, IonInput, IonTitle, IonButtons, IonContent, IonItem, IonLabel]
})
export class RegisterPage implements OnInit {
  isLoading = false;
  currentStep: number = 1;
  totalSteps: number = 3;
  isDatePickerOpen = false;
  maxDate = new Date().toISOString();
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;
  registrationData: RegisterModel = {
  id: uuidv4().toString(), // Généré côté client avec UUID v4
  password_hash: '', // Will be set before sending to server
  QR_proof: '',
  password: '',
  confirmPassword: '',
  user_type: 'fan', // Default value
  user_status: 'other', // Default value
  status: 'active',
  readonly: false,
  myPlan:{} as Plan,
  registration_date: new Date().toISOString(),
  // Propriétés de UserInfo
  first_name: '',
  last_name: '',
  gender: '',
  birthDate: new Date(),
  age: 0,
  email: '',
  phone: '',
  address: '',
  website: '',
  bio: '',
  school: { id: '', name: '' },
  memberShip: undefined
};

  studentProofName: string = '';
  
  genderOptions = [
    { value: 'male', label: 'Homme', icon: 'male' },
    { value: 'female', label: 'Femme', icon: 'female' },
    { value: 'other', label: 'Autre', icon: 'transgender' }
  ];

  statusOptions:{
  value: 'university' | 'student' | 'other',
  label: string,
  icon: string,
  requiresProof: boolean
}[] = [
    { value: 'university', label: 'Universitaire', icon: 'school', requiresProof: true },
    { value: 'student', label: 'Élève', icon: 'book', requiresProof: true },
    { value: 'other', label: 'Autre', icon: 'person', requiresProof: false }
  ];

  accountTypes: { 
  value: 'fan' | 'artist' | 'admin' | 'creator',
  label: string,
  icon: string,
  description: string
}[] = [
    { 
      value: 'artist', 
      label: 'Artiste', 
      icon: 'musical-notes',
      description: 'Partagez vos performances'
    },
    { 
      value: 'fan', 
      label: 'Fan', 
      icon: 'heart',
      description: 'Suivez vos artistes préférés'
    },
    { 
      value: 'creator', 
      label: 'Créateur', 
      icon: 'create',
      description: 'Créez du contenu exclusif'
    }
  ];

  constructor(
    private router: Router,
    private modalController: ModalController,
    private alertController: AlertController,
    private actionSheetController: ActionSheetController,
  
  ) {
    addIcons({
    'arrow-back': arrowBack,
    'cloud-upload': cloudUpload,
    'close-circle': closeCircle,
    'eye': eye,
    'eye-off': eyeOff,
    'checkmark-circle': checkmarkCircle,
    'mail': mail,
    'pencil-outline': pencilOutline,
    'camera-off': camera,
    'lock-closed': lockClosed,
    'logo-google': logoGoogle,
    'logo-facebook': logoFacebook,
    'person-circle': personCircle,
    'school': school,
    'book': book,
    'person': person,
    'musical-notes': musicalNotes,
    'heart': heart,
    'male': male,
    'female': female,
    'location-outline': locationOutline,
    'call-outline': callOutline,
    'trash-outline': trashOutline,
    'transgender': transgender,
    'chevron-back': chevronBack,
    'arrow-forward': arrowForward,
    'calendar': calendar,
    'calendar-outline': calendarOutline,
    'today-outline': todayOutline,
    'close-outline': closeOutline,
    'mail-outline': mailOutline,
    'lock-closed-outline': lockClosedOutline,
    'qr-code-outline': qrCodeOutline,
    'create': create
  });
  }

  ngOnInit() {}
  ngOnDestroy() {
    // Nettoyage si nécessaire
  }
  // Navigation entre les étapes
  nextStep() {
  if ((this.currentStep === 1 && this.validateStep1()) || 
      (this.currentStep === 2 && this.validateStep2())) {
    this.currentStep++;
  }
}

  previousStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }
// Dans votre RegisterPage
openDatePicker() {
  this.isDatePickerOpen = true;
}

onDateSelected(event: any) {
  this.registrationData.birthDate = new Date(event.detail.value);
  this.isDatePickerOpen = false;
  this.confirmDateSelection(); // Calcule automatiquement l'âge
}

confirmDateSelection() {
  if (this.registrationData.birthDate) {
    const birthDate = new Date(this.registrationData.birthDate);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    // Vérifie si l'anniversaire de cette année est déjà passé
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    this.registrationData.age = age;
  }
}

async openDateActionSheet() {
  const actionSheet = await this.actionSheetController.create({
    header: 'Sélectionner la date de naissance',
    buttons: [
      {
        text: 'Choisir une date',
        icon: 'calendar-outline',
        handler: () => {
          this.isDatePickerOpen = true;
        }
      },
      {
        text: 'Aujourd\'hui',
        icon: 'today-outline',
        handler: () => {
          this.registrationData.birthDate = new Date();
          this.confirmDateSelection();
        }
      },
      {
        text: 'Annuler',
        icon: 'close-outline',
        role: 'cancel'
      }
    ]
  });

  await actionSheet.present();
}

  // Nettoyer le formulaire
  resetForm() {
    this.registrationData = {
      id: uuidv4(), // Nouvel UUID pour la prochaine inscription
      password_hash: '',
      QR_proof: '',
      password: '',
      confirmPassword: '',
      user_type: 'fan',
      user_status: 'other',
      status: 'active',
      readonly: false,
      myPlan: {} as Plan,
      registration_date: new Date().toISOString(),
      // Propriétés de UserInfo
      first_name: '',
      last_name: '',
      gender: '',
      birthDate: new Date(),
      age: 0,
      email: '',
      phone: '',
      address: '',
      website: '',
      bio: '',
      school: { id: '', name: '' },
      memberShip: undefined
    };
    this.currentStep = 1;
    this.showPassword = false;
    this.showConfirmPassword = false;
  }

  // Validation de l'étape 1
  validateStep1(): boolean {
    const { first_name, last_name, gender, age, user_status, QR_proof, user_type } = this.registrationData;

    if (!first_name || !last_name) {
      this.showAlert('Erreur Nom', 'Veuillez remplir votre nom et prénom');
      return false;
    }

    if (!gender) {
      this.showAlert('Erreur Sexe', 'Veuillez sélectionner votre sexe');
      return false;
    }

    if (!age || age < 13 || age > 80) {
      this.showAlert('Erreur Âge', 'Veuillez entrer un âge valide (13-80 ans)');
      return false;
    }

    

    if ((user_status === 'university' || user_status === 'student') && !QR_proof) {
      this.showAlert('Erreur Justification', 'Veuillez fournir une justification');
      return false;
    }

    if (!user_type) {
      this.showAlert('Erreur Type de compte', 'Veuillez choisir un type de compte');
      return false;
    }

    return true;
  }
  validateStep2(): boolean{
    const { phone} = this.registrationData;
    if(!this.registrationData.phone){
       this.showAlert('Erreur phone invalide', 'Veuillez fournir un numero de telephone valide');
      return false;
    }
    if (!phone) {
      this.showAlert('Aucun numero de contact', 'Veuillez fournir un numero de telephone');
      return false;
    }

    // Validation du numéro de téléphone avec regex précise
    const phoneRegex = /^\+?[0-9\s\-]{8,20}$/;
    if(!phone || !phoneRegex.test(phone)){
        this.showAlert('Erreur téléphone', 'Veuillez fournir un numéro de téléphone valide (ex: +33612345678 ou 0612345678)');
       return false;
    }
    
    return true;
  }
  // Validation de l'étape 2
  validateStep3(): boolean {
    const { email, password, confirmPassword } = this.registrationData;

    if (!this.registrationData.user_status) {
      this.showAlert('Erreur Statut', 'Veuillez sélectionner votre statut');
      return false;
    }
    
    if (!email) {
      this.showAlert('Erreur Email', 'Veuillez entrer votre email');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.showAlert('Erreur Email', 'Veuillez entrer un email valide');
      return false;
    }

    if (!password) {
      this.showAlert('Erreur Mot de passe', 'Veuillez entrer un mot de passe');
      return false;
    }

    if (password.length < 6) {
      this.showAlert('Erreur Mot de passe', 'Le mot de passe doit contenir au moins 6 caractères');
      return false;
    }

   

    return true;
  }

  // Gestion proof

 async startScan() {
    const modal = await this.modalController.create({
      component: ModalQRscannerComponent,
      cssClass: 'qr-scanner-modal',
      backdropDismiss: false
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    
    if (data && data.success) {

      this.registrationData.QR_proof = data.result;
      if(this.registrationData.QR_proof && data.result.name){
        const name = data.result.name;
        const id = data.result.id;
      this.registrationData.school.name = name;
      this.registrationData.school.id = id
      }
      this.studentProofName = 'QR Code scanné ✓';
    }
  }

   showManualInput() {
    const input = prompt('Le scan automatique a échoué. Veuillez entrer le code QR manuellement :');
    if (input) {
      this.registrationData.QR_proof = input;
      this.studentProofName = 'Code saisi manuellement';
    }
  }

  clearQRCode() {
  this.registrationData.QR_proof = '';
  this.studentProofName = '';
}

  needsProof(): boolean {
  
  return (this.registrationData.user_status === 'university' || 
          this.registrationData.user_status === 'student') && 
         !this.registrationData.QR_proof;
}



async PrepareRegister() {
  // 1️⃣ Valider le formulaire
  if (!this.validateStep1() || !this.validateStep2() || !this.validateStep3()) {
    return;
  }

  // 2️⃣ Préparer les données d'inscription
  this.registrationData.registration_date = new Date().toISOString();

  try {
    // 3️⃣ Hacher le mot de passe
    //const salt = await bcrypt.genSalt(10);
    //const hashedPassword = await bcrypt.hash(this.registrationData.password as string, salt);
    
    // 4️⃣ Créer l'objet utilisateur
    //const userData = {
     // ...this.registrationData,
      //password_hash: hashedPassword,
      //password: undefined // Ne pas envoyer le mot de passe en clair
   // };

    // 5️⃣ Nettoyer les données
   // delete (userData as any).password;
    
    this.currentStep = 1;

    // 6️⃣ Rediriger vers la page d'abonnement avec les données
    await this.router.navigate(['/subscription'], {
      state: { registrationData: this.registrationData }
    }).then(()=>{
      // Nettoyer le formulaire après redirection
      this.resetForm();
    });

  } catch (error) {
    console.error('Erreur lors de la préparation des données:', error);
    const alert = await this.alertController.create({
      header: 'Erreur',
      message: 'Une erreur est survenue lors de la préparation des données d\'inscription',
      buttons: ['OK']
    });
    await alert.present();
  }
}

  togglePasswordVisibility(field: string) {
    if (field === 'password') {
      this.showPassword = !this.showPassword;
    } else {
      this.showConfirmPassword = !this.showConfirmPassword;
    }
  }

  async showAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header: header,
      message: message,
      buttons: ['OK']
    });
    await alert.present();
  }

  goBack() {
    if (this.currentStep > 1) {
      this.previousStep();
    } else {
      this.router.navigate(['/login']);
    }
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
