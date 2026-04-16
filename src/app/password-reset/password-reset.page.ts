import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, 
  IonHeader, 
  IonTitle, 
  IonToolbar,
  IonInput,
  IonButton,
  IonIcon,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItem,
  IonLabel,
  IonSpinner,
  IonToast
} from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { Auth } from 'src/services/AUTH/auth';
import { eyeOutline, eyeOffOutline, checkmarkCircle, lockClosedOutline, warningOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { AlertController } from '@ionic/angular';

@Component({
  selector: 'app-password-reset',
  templateUrl: './password-reset.page.html',
  styleUrls: ['./password-reset.page.scss'],
  standalone: true,
  imports: [
    IonContent, 
    IonInput,
    IonButton,
    IonIcon,
    IonItem,
    IonSpinner,
    CommonModule, 
    FormsModule
  ]
})
export class PasswordResetPage implements OnInit {
  token: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;
  isLoading: boolean = false;
  resetSuccess: boolean = false;
  errorMessage: string = '';

  passwordStrength: {
    score: number;
    message: string;
    color: string;
  } = {
    score: 0,
    message: '',
    color: 'danger'
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: Auth,
    private alertController: AlertController
  ) {
    addIcons({checkmarkCircle,lockClosedOutline,warningOutline,checkmarkCircleOutline,eyeOutline,eyeOffOutline});
  }

  ngOnInit() {
    // Récupérer le token depuis les paramètres de route
    this.token = this.route.snapshot.paramMap.get('id') || '';
    
    if (!this.token) {
      this.errorMessage = 'Token de réinitialisation manquant ou invalide';
    }
  }

  // Calcul de la force du mot de passe
  calculatePasswordStrength(password: string) {
    if (!password) {
      this.passwordStrength = { score: 0, message: '', color: 'danger' };
      return;
    }

    let score = 0;
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };

    score = Object.values(checks).filter(Boolean).length;

    if (score <= 2) {
      this.passwordStrength = { score, message: 'Faible', color: 'danger' };
    } else if (score <= 3) {
      this.passwordStrength = { score, message: 'Moyen', color: 'warning' };
    } else if (score <= 4) {
      this.passwordStrength = { score, message: 'Fort', color: 'success' };
    } else {
      this.passwordStrength = { score, message: 'Très fort', color: 'success' };
    }
  }

  onPasswordChange() {
    this.calculatePasswordStrength(this.newPassword);
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  async resetPassword() {
    // Validation
    if (!this.token) {
      this.errorMessage = 'Token de réinitialisation manquant';
      return;
    }

    if (!this.newPassword || !this.confirmPassword) {
      this.errorMessage = 'Veuillez remplir tous les champs';
      return;
    }

    if (this.newPassword.length < 8) {
      this.errorMessage = 'Le mot de passe doit contenir au moins 8 caractères';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Les mots de passe ne correspondent pas';
      return;
    }

    if (this.passwordStrength.score < 3) {
      this.errorMessage = 'Veuillez choisir un mot de passe plus fort';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      const response = await this.auth.confirmReset(this.token, this.newPassword).toPromise();
      
      // Vérifier explicitement le succès de la réponse
      if (response && response.success) {
        this.resetSuccess = true;
        
        // Afficher une alerte de succès
        const alert = await this.alertController.create({
          header: 'Succès',
          message: response.message || 'Votre mot de passe a été réinitialisé avec succès. Vous allez être redirigé vers la page de connexion.',
          buttons: ['OK']
        });
        await alert.present();

        // Redirection automatique après 2 secondes
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      } else {
        // Si le backend retourne success: false
        this.errorMessage = response?.message || 'La réinitialisation du mot de passe a échoué';
      }

    } catch (error: any) {
      // Gérer les erreurs réseau ou autres erreurs techniques
      console.error('Password reset error:', error);
      this.errorMessage = error.message || 'Une erreur technique est survenue. Veuillez réessayer plus tard.';
    } finally {
      this.isLoading = false;
    }
  }

  getPasswordStrengthColor() {
    return this.passwordStrength.color;
  }

  getPasswordStrengthWidth() {
    return `${(this.passwordStrength.score / 5) * 100}%`;
  }

  hasUpperCase() {
    return /[A-Z]/.test(this.newPassword);
  }

  hasLowerCase() {
    return /[a-z]/.test(this.newPassword);
  }

  hasNumber() {
    return /\d/.test(this.newPassword);
  }

  hasSpecialChar() {
    return /[!@#$%^&*(),.?":{}|<>]/.test(this.newPassword);
  }

  hasMinLength() {
    return this.newPassword.length >= 8;
  }
}
