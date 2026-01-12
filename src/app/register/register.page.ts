import { Auth } from '../../services/AUTH/auth';
import { UserProfile } from '../../models/User';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { Component, OnInit, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController, ActionSheetController,  } from '@ionic/angular';
import { Dialog } from '@capacitor/dialog';
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';  
import * as bcrypt from 'bcryptjs';
import { 
  arrowBack,
  cloudUpload,
  closeCircle,
  eye,
  eyeOff,
  checkmarkCircle,
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
  mailOutline,
  lockClosedOutline,
  heart,
  create
} from 'ionicons/icons';
import { 
  IonHeader, 
  IonToolbar, 
  IonIcon, 
  IonButton, 
  IonLabel,
  IonItem,
  IonDatetime,
  IonModal,
  IonInput,
  IonTitle,
  IonButtons,
  IonContent, IonLoading } from '@ionic/angular/standalone';
import { User } from 'src/models/User';
import { UserService } from 'src/services/USER_SERVICE/user-service';
import { ProfileService } from 'src/services/PROFILE_SERVICE/profile-service';
import { Plan } from 'src/models/Plan';


@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
   imports: [IonLoading, NgIf,NgFor,DatePipe, FormsModule,IonHeader, IonDatetime, IonModal, IonToolbar, IonIcon, IonButton, IonInput, IonTitle, IonButtons, IonContent, IonItem, IonLabel]
})
export class RegisterPage implements OnInit {
  isLoading = false;
  currentStep: number = 1;
  totalSteps: number = 2;
isDatePickerOpen = false;
maxDate = new Date().toISOString();
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;
  
  registrationData: User = {
  id: 0, // Will be set by the server
  first_name: '',
  last_name: '',
  gender: '',
  birthDate: new Date(),
  myPlan: {} as Plan,
  readonly:false,
  age: 0,
  email: '',
  password: '',
  password_hash: '', // Will be set before sending to server
  QR_proof: '',
  user_type: 'fan', // Default value
  user_status: 'other', // Default value
  status: 'active',
  registration_date: new Date().toISOString()
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
    private userService: UserService,
    private profileService: ProfileService,
    private auth: Auth,
  ) {
    addIcons({
    'arrow-back': arrowBack,
    'cloud-upload': cloudUpload,
    'close-circle': closeCircle,
    'eye': eye,
    'eye-off': eyeOff,
    'checkmark-circle': checkmarkCircle,
    'mail': mail,
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
    'mail-outline': mailOutline,
    'lock-closed-outline': lockClosedOutline,
    'transgender': transgender,
    'chevron-back': chevronBack,
    'arrow-forward': arrowForward,
    'calendar': calendar,
    'create': create
  });
  }

  ngOnInit() {}

  // Navigation entre les étapes
  nextStep() {
    if (this.currentStep === 1 && this.validateStep1()) {
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



  // Validation de l'étape 2
  validateStep2(): boolean {
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


// Dans la classe RegisterPage
async scanQRCode() {
  try {
    // Demander la permission de la caméra
    const status = await BarcodeScanner.checkPermission({ force: true });
    
    if (status.granted) {
      // Masquer le contenu de l'application
      document.querySelector('body')?.classList.add('scanner-active');
      
      // Démarrer le scan
      const result = await BarcodeScanner.startScan();
      
      if (result.hasContent) {
        // Stocker le contenu du QR code
        this.registrationData.QR_proof = result.content;
        this.studentProofName = 'QR Code scanné ✓';
      }
    } else {
      await this.showAlert('Permission refusée', 'L\'accès à la caméra est nécessaire pour scanner un QR code');
    }
  } catch (error) {
    console.error('Erreur lors du scan:', error);
    await this.showAlert('Erreur', 'Impossible de lancer le scan du QR code');
  } finally {
    // Réafficher le contenu de l'application
    document.querySelector('body')?.classList.remove('scanner-active');
  }
}

// Méthode pour arrêter le scan
stopScan() {
  BarcodeScanner.showBackground();
  BarcodeScanner.stopScan();
  document.querySelector('body')?.classList.remove('scanner-active');
}

  needsProof(): boolean {
  return (this.registrationData.user_status === 'university' || 
          this.registrationData.user_status === 'student') && 
         !this.registrationData.QR_proof;
}

  // Social Login
  async loginWithGoogle() {
   this.isLoading = true;

    // Intégrez votre logique Google Sign-In
    setTimeout(async () => {
      this.isLoading = false
      // Pré-remplir les données depuis Google
      this.registrationData.email = 'user@gmail.com';
      this.registrationData.first_name = 'John';
      this.registrationData.last_name = 'Doe';
      this.showAlert('Succès', 'Informations Google récupérées!');
    }, 2000);
  }

  async loginWithFacebook() {
    this.isLoading = true;

    // Intégrez votre logique Facebook Login
    setTimeout(async () => {
      this.isLoading = false;
      this.registrationData.email = 'user@facebook.com';
      this.registrationData.first_name = 'Jane';
      this.registrationData.last_name = 'Smith';
      this.showAlert('Succès', 'Informations Facebook récupérées!');
    }, 2000);
  }



async PrepareRegister() {
  // 1️⃣ Valider le formulaire
  if (!this.validateStep1() || !this.validateStep2()) {
    return;
  }

  // 2️⃣ Préparer les données d'inscription
  this.registrationData.registration_date = new Date().toISOString();

  try {
    // 3️⃣ Hacher le mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(this.registrationData.password as string, salt);
    
    // 4️⃣ Créer l'objet utilisateur
    const userData = {
      ...this.registrationData,
      password_hash: hashedPassword,
      password: undefined // Ne pas envoyer le mot de passe en clair
    };

    // 5️⃣ Nettoyer les données
    delete (userData as any).id;
    delete userData.password;
    
    console.log('Redirection vers la page d\'abonnement avec les données :', userData);

    // 6️⃣ Rediriger vers la page d'abonnement avec les données
    await this.router.navigate(['/subscription'], {
      state: { registrationData: userData }
    });

  } catch (error) {
    console.error('Erreur lors de la préparation des données:', error);
    await Dialog.alert({
      title: 'Erreur',
      message: 'Une erreur est survenue lors de la préparation des données d\'inscription',
      buttonTitle: 'OK'
    });
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
    await Dialog.alert({
    title: header,
    message
  }); 
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
