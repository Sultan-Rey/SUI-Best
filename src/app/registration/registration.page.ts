import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, LoadingController, AlertController } from '@ionic/angular'; 
import { firstValueFrom } from 'rxjs';
import { Html5Qrcode } from 'html5-qrcode';
import { addIcons } from 'ionicons'; 
import { Plan } from 'src/models/Plan'; 
import { 
  businessOutline, 
  schoolOutline, 
  personOutline, 
  calendarOutline, 
  idCardOutline, 
  qrCodeOutline, 
  timeOutline, 
  lockClosedOutline, 
  mailOutline,
  sparklesOutline,
  micOutline,
  heartOutline
} from 'ionicons/icons';
import { Router } from '@angular/router';
import { SubscriptionService } from 'src/services/Service_subscription/subscription-service';

@Component({
  selector: 'app-registration',
  templateUrl: './registration.page.html',
  styleUrls: ['./registration.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class RegistrationPage implements OnInit, OnDestroy {
  step: number = 1;
  isScanning: boolean = false;
  html5Qrcode?: Html5Qrcode;

 
minBirthDate: string = '';
maxBirthDate: string = '';

  // Modèle d'inscription étendu selon notre brainstorming
  form = {
    status: '', // 'student' | 'university'
    first_name: '',
    last_name: '',
    gender: '',
    birthDate: '',
    age: 0,
    email: '',
    type:'',
    password: '',
    follows:[],
    qr_proof: '', // contiendra la chaîne brute décodée du QR code
    myPlan: {} as Plan,
    school: {
      id: '',
      name: '',
      level: '' // Classe de l'élève (ex: 'Seconde B')
    },
    confidence_level: 0, // Initialisé à 0, augmentera avec le parrainage P2P
    registration_date: new Date().toISOString()
  };
  
  institutionCode: string = ''; // Pour le parcours Institution uniquement
  isCodeError!: boolean;

  constructor(private router: Router, private loadingCtrl: LoadingController,
             private subscribed:SubscriptionService, private alertController: AlertController){}
  
  async ngOnInit() {
    // Enregistrement de toutes les icônes nécessaires pour la nouvelle UI
    addIcons({
      businessOutline, 
      schoolOutline, 
      personOutline, 
      calendarOutline, 
      idCardOutline, 
      qrCodeOutline, 
      timeOutline, 
      lockClosedOutline, 
      mailOutline,
      sparklesOutline,
      heartOutline, 
      micOutline,
    });
    this.calculateBirthDateLimits();
  }

 selectStatus(status: 'student' | 'university') {
  this.form.status = status;
  this.isCodeError = false;
  // Sécurité : On nettoie l'objet pour éviter les données croisées/parasites
  if (status === 'university') {
   this.form.type = 'creator';
    // Si on bascule sur Institution, on efface les données de l'élève
    this.form.first_name = '';
    this.form.last_name = '';
    this.form.birthDate = '';
    this.form.age = 0;
    this.form.qr_proof = '';
    this.form.school = {
      id: '',
      name: '',
      level: ''
    };
    this.form.confidence_level = 1; 
    // Réinitialiser aussi les sélecteurs de puces UI si utilisés
    this.selectedLevel = '';
    this.selectedSubSection = '';
  } else if (status === 'student') {
    this.form.type = '';
    // Si on bascule sur Élève, on efface le code brut de l'institution
    this.institutionCode = '';
    this.form.qr_proof = '';
    this.form.school = {
      id: '',
      name: '',
      level: ''
    };
  }
}

calculateBirthDateLimits() {
  const today = new Date();
  const currentYear = today.getFullYear(); // Renvoie automatiquement 2026

  // Calcul dynamique des années limites
  const maxAgeYear = currentYear - 25; // 2001
  const minAgeYear = currentYear - 10; // 2016

  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  // Dates au format standard HTML 'YYYY-MM-DD'
  this.minBirthDate = `${maxAgeYear}-${month}-${day}`; // "2001-05-26"
  this.maxBirthDate = `${minAgeYear}-${month}-${day}`; // "2016-05-26"
}
  // Calcul automatique de l'âge lors du changement de la date de naissance
  onBirthDateChange() {
    if (!this.form.birthDate) return;
    const birth = new Date(this.form.birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    this.form.age = age;
  }

  // Cette méthode se déclenche à chaque fois que l'utilisateur tape ou efface un caractère
onCodeChange() {
  if (this.isCodeError) {
    this.isCodeError = false;
  }
}

  next() {
    
    // Étape 1 -> Étape suivante selon profil
    if (this.step === 1) {
      if (this.form.status === 'student') {
        this.step = 2; // Informations d'identité de l'élève
      } else if (this.form.status === 'university') {
        // On passe à l'étape suivante seulement si l'école est valide
          this.step = 3; 
}
      return;
    }

    // Étape 2 (Infos Élève) -> Étape 3 (Scan QR Code Élève)
    if (this.step === 2 && this.form.status === 'student') {
      this.step = 3;
      setTimeout(() => { this.startScanner(); }, 300);
      return;
    }

    // Étape 3 (Scan / Code) -> Étape 4 (Création de compte finale)
    if (this.step === 3) {
      if(this.form.status === 'university'){
        if (this.institutionCode !== '') {
    
    // 1. On passe le code en paramètre
    this.subscribed.getSchoolByCode(this.institutionCode).subscribe({
      next: (school) => {
        // 2. On vérifie si une école a bien été trouvée avec ce code
        if (school) {
          this.form.first_name = school.name; // "nom du school"
          this.form.last_name = 'Ecole';
          this.form.school = {
            id: school.id || 'unknown', // "id du school"
            name: school.name,
            level: ''
          };
       this.step = 4;   
        } else {
          this.isCodeError = true;
          // Optionnel : Gérer le cas où le code est invalide
          console.error("Aucune école correspondante ou accès invalide.");
          // Vous pouvez afficher un message d'erreur à l'utilisateur ici
        }
      },
      error: (err) => {
        console.error("Erreur lors de la récupération de l'école :", err);
      }
    });

  }
  return;
      }
      this.step = 4;
      return;
    }
  }

  prev() {
    if (this.step === 3 && this.form.status === 'student') {
      this.stopScanner();
      this.step = 2;
    } else if (this.step === 3 && this.form.status === 'university') {
      this.step = 1;
    } else {
      this.step--;
    }
  }

startScanner() {
  this.isScanning = true;
  this.isCodeError = false; // On reset l'affichage d'une éventuelle erreur précédente
  this.html5Qrcode = new Html5Qrcode("reader");
  
  this.html5Qrcode.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    (decodedText) => {
      // 1. ARRÊT IMMÉDIAT DU SCANNER dès qu'on lit un code (Sécurité UX et Caméra)
      if (this.html5Qrcode && this.html5Qrcode.isScanning) {
        this.html5Qrcode.stop().then(() => {
          this.isScanning = false;
          // Procéder à la vérification en base de données une fois la caméra coupée
          this.verifierInstitutionApresScan(decodedText);
        }).catch(err => {
          console.error("Erreur lors de l'arrêt du scanner :", err);
          this.isScanning = false;
          this.verifierInstitutionApresScan(decodedText);
        });
      } else {
        this.isScanning = false;
        this.verifierInstitutionApresScan(decodedText);
      }
    },
    (errorMessage) => { /* Recherche silencieuse */ }
  ).catch(err => {
    console.error("Erreur initialisation caméra :", err);
    this.isScanning = false;
  });
}

// Nouvelle méthode d'assistance pour valider la donnée de manière asynchrone
private verifierInstitutionApresScan(decodedText: string) {
  let scannedId = 'ID_INCONNU';
  
  try {
    // Tentative de décodage si le QR est un JSON
    const institutionData = JSON.parse(decodedText);
    scannedId = institutionData.id || decodedText;
  } catch (e) {
    // Si c'est une simple chaîne de caractères (l'ID brut)
    scannedId = decodedText;
  }
  // 2. VÉRIFICATION EN BASE DE DONNÉES
  this.subscribed.getSchoolById(scannedId.trim()).subscribe({
    next: (school) => {
      if (school) {
        // L'institution existe bien ET son accès est valide
        this.form.qr_proof = decodedText;
        this.form.school.id = 'INS_'+school.access_code || '';
        this.form.school.name = school.name;
        this.next(); // Changement d'étape sécurisé, les données sont injectées !
      } else {
        this.presentAlert(
          'Vérification échouée', 
          'Ce code QR ne correspond à aucun établissement partenaire actif ou ses accès ont expiré.'
        );
        // 4. L'alerte est fermée, on relance proprement la caméra pour un nouvel essai
        //this.stopScanner();
        // Cas où l'ID n'existe pas ou l'accès est expiré/invalide
        //console.error("QR Code invalide : Institution introuvable ou accès expiré.");
        // Optionnel : Vous pouvez réinitialiser le scanner ici si vous voulez lui donner une autre chance
      }
    },
    error: (err) => {
      this.presentAlert(
        'Erreur de connexion', 
        'Impossible de joindre le serveur pour valider l\'établissement. Veuillez vérifier votre connexion internet.'
      );
      console.error("Erreur lors de la vérification de l'établissement :", err);
    }
  });
}

  stopScanner() {
    if (this.html5Qrcode && this.html5Qrcode.isScanning) {
      this.html5Qrcode.stop().then(() => {
        this.isScanning = false;
      }).catch(err => console.error(err));
    }
  }

/**
 * Affiche une alerte et attend sa fermeture complète
 */
async presentAlert(title: string, message: string): Promise<void> {
  const alert = await this.alertController.create({
    header: title,
    message: message,
    buttons: ['OK'],
    cssClass: 'premium-alert'
  });

  await alert.present();
  
  // Cette ligne cruciale "bloque" l'exécution jusqu'à ce que l'utilisateur clique sur OK
  await alert.onDidDismiss().then(()=>{
    this.html5Qrcode?.clear();
    this.startScanner();
  });
}

// Listes standardisées pour l'indexation
availableLevels: string[] = ['6ème','7ème','8ème', '9ème', 'Troisième(NS1)','Seconde(NS2)', 'Première(NS3)', 'Terminale(NS4)'];
availableSubSections: string[] = ['A', 'B', 'C', 'D', 'E', 'G', 'S'];

// Variables temporaires pour assembler la classe proprement
selectedLevel: string = '';
selectedSubSection: string = '';

// Modifiez votre méthode onBirthDateChange ou ajoutez une méthode de mise à jour du niveau
updateSchoolLevel() {
  if (this.selectedLevel) {
    // On assemble de manière stricte : "Seconde B" ou juste "Seconde" s'il n'y a pas de sous-section
    this.form.school.level = this.selectedSubSection 
      ? `${this.selectedLevel} ${this.selectedSubSection}` 
      : this.selectedLevel;
  }
}

isStep1Valid(): boolean {
    if (!this.form.status) return false;
    // Si c'est un élève, il doit avoir choisi son type (qui ne peut être que fan ou artist dans le HTML)
    if (this.form.status === 'student' && !this.form.type) return false; 
    return true;
  }

// Mettre à jour la validation de l'étape 2
isIdentityValid(): boolean {
  const isAgeLogical = this.form.age >= 10 && this.form.age <= 25;

  return !!(
    this.form.first_name && 
    this.form.last_name && 
    this.form.birthDate && 
    isAgeLogical && // <-- ICI : Si l'âge calculé est 0 an (né en 2026), ceci vaut FALSE
    this.selectedLevel
  );
}

 async submit() {
  // 1️⃣ Création et affichage du Loading
  const loading = await this.loadingCtrl.create({
    message: 'Configuration de votre profil...',
    spinner: 'crescent',
    cssClass: 'custom-loading' // Optionnel : si tu veux le styliser en CSS plus tard
  });
  await loading.present();


  
  // 4️⃣ Construction du Payload enrichi prêt pour le backend
  const payload = {
    id: '',
    email: this.form.email,
    password: this.form.password,
    user_status: this.form.status,
    status: 'pending', 
    confidence_level: this.form.confidence_level,
    type: this.form.type,
    follows: this.form.status === 'student' ? [this.form.school.id] : [],
    userInfo: {
      first_name: this.form.first_name,
      last_name: this.form.last_name,
      birthDate: this.form.birthDate,
      age: this.form.age,
      school: {
        id: this.form.status === 'student' ? this.form.school.id : this.institutionCode,
        name: this.form.status === 'student' ? this.form.school.name : 'Institution Certifiée',
        level: this.form.status === 'student' ? this.form.school.level : undefined
      }
    }
  };
  try {
    // 5️⃣ Redirection vers la page d'abonnement en passant le payload mis à jour
    // ATTENTION : On envoie 'payload' au lieu de 'this.form' pour que l'étape suivante ait accès aux follows
    await this.router.navigate(['/subscription'], {
      state: { registrationData: payload }
    });
  } catch (navError) {
    console.error("Erreur lors de la navigation :", navError);
  } finally {
    // 6️⃣ Quoi qu'il arrive, on détruit le loading pour libérer l'écran
    await loading.dismiss();
  }
}

    goToLogin() {
    // Redirige vers la route de ta page de connexion (ex: '/login')
    this.router.navigate(['/login']); 
  }

  ngOnDestroy() {
    this.stopScanner();
  }
}