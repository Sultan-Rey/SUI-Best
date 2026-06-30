import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon, IonButton, IonItem, IonLabel, IonInput } from '@ionic/angular/standalone';
import { checkmarkCircle, mailUnread, lockClosed, closeCircle, alertCircle } from 'ionicons/icons';
import { Auth } from 'src/services/AUTH/auth';

@Component({
  selector: 'app-default',
  templateUrl: './default.page.html',
  styleUrls: ['./default.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, IonButton, CommonModule, FormsModule]
})
export class DefaultPage implements OnInit, OnDestroy {

  constructor(private route: ActivatedRoute, private router: Router, private auth: Auth) { }

  isReady = false;

ngOnInit() {
  this.route.paramMap.subscribe(params => {
    this.arg = params.get('arg');
    this.isReady = true;
  });

  const navigation = this.router.getCurrentNavigation();
  this.extras = navigation?.extras?.state || null;
}

  arg: string | null = null;
  extras: any = null;

  // Icons
  checkmarkCircle = checkmarkCircle;
  mailUnread = mailUnread;
  lockClosed = lockClosed;
  closeCircle = closeCircle;
  alertCircle = alertCircle;

  errorReason: string = '';
errorMessage: string = '';

 isPaymentFailed = false;
paymentError: string | null = null;

  get isAccountSuccess(): boolean {
    return this.arg === 'account-success';
  }

  get isAccountError(): boolean {
  return this.arg === 'account-error' || this.arg === 'payment-failed' || this.arg === 'creation-failed';
}

  get isPasswordReset(): boolean {
    return this.arg === 'password-reset';
  }

  get isPasswordChange(): boolean {
    return this.arg === 'password-change';
  }

// 3. Ajoutez la méthode pour réessayer le paiement (à adapter selon votre logique de routage)
retryPayment(): void {
  // Option A : Re-naviguer vers la page de checkout / tarification
  this.router.navigate(['/home']); 
}

  // Accès aux données des extras
  get userName(): string {
    return this.extras?.name || '';
  }

  get userEmail(): string {
    return this.extras?.email || '';
  }

  get hasAccountData(): boolean {
    return !!(this.extras?.name && this.extras?.email);
  }

  // Gestion du bouton de renvoi d'email
  canResendEmail: boolean = true;
  resendCountdown: number = 0;
  private resendTimer: any = null;

  // Formulaire de reset de mot de passe
  resetEmail: string = '';
  resetEmailSent: boolean = false;
  resetError: string = '';
  resetSuccess: string = '';
  canResendResetEmail: boolean = true;
  resendResetCountdown: number = 0;
  private resendResetTimer: any = null;

  resendEmail(): void {
    if (!this.canResendEmail) return;
    
    // CORRECTION: Utiliser la méthode resend() du service Auth
    const emailToSend = this.userEmail;
    if (!emailToSend) {
      console.error('Aucune adresse email disponible pour le renvoi');
      return;
    }
    
    this.auth.resend(emailToSend).subscribe({
      next: (response) => {
        console.log('Email renvoyé avec succès:', response);
        // Optionnel: afficher un toast de succès
      },
      error: (error) => {
        console.error('Erreur lors du renvoi d\'email:', error);
        // Optionnel: afficher un message d'erreur
      }
    });
    
    // Désactiver le bouton et lancer le compte à rebours
    this.canResendEmail = false;
    this.resendCountdown = 90;
    
    this.resendTimer = setInterval(() => {
      this.resendCountdown--;
      if (this.resendCountdown <= 0) {
        this.canResendEmail = true;
        clearInterval(this.resendTimer);
      }
    }, 1000);
  }

  sendResetLink(): void {
    if (!this.resetEmail || !this.resetEmail.trim()) {
      this.resetError = 'Veuillez saisir une adresse email';
      return;
    }
    
    // Réinitialiser les messages
    this.resetError = '';
    this.resetSuccess = '';
    
    // CORRECTION: Utiliser la méthode reset() du service Auth
    this.auth.reset(this.resetEmail).subscribe({
      next: (response) => {
        console.log('Lien de reset envoyé avec succès:', response);
        this.resetSuccess = response?.message || 'Lien de réinitialisation envoyé avec succès';
        this.resetEmailSent = true;
      },
      error: (error) => {
        console.error('Erreur lors de l\'envoi du lien de reset:', error);
        this.resetError = error?.error?.message || error?.message || 'Erreur lors de l\'envoi du lien de réinitialisation';
      }
    });
    this.resetEmail = "";
  }

  resendResetEmail(): void {
    if (!this.canResendResetEmail) return;
    
    // CORRECTION: Utiliser la méthode reset() du service Auth pour renvoyer
    if (!this.resetEmail) return;
    
    // Réinitialiser les messages d'erreur mais garder le succès
    this.resetError = '';
    
    this.auth.reset(this.resetEmail).subscribe({
      next: (response) => {
        console.log('Lien de reset renvoyé avec succès:', response);
        this.resetSuccess = response?.message || 'Lien de réinitialisation renvoyé avec succès';
      },
      error: (error) => {
        console.error('Erreur lors du renvoi du lien de reset:', error);
        this.resetError = error?.error?.message || error?.message || 'Erreur lors du renvoi du lien de réinitialisation';
      }
    });
    
    // Désactiver le bouton et lancer le compte à rebours
    this.canResendResetEmail = false;
    this.resendResetCountdown = 90;
    
    this.resendResetTimer = setInterval(() => {
      this.resendResetCountdown--;
      if (this.resendResetCountdown <= 0) {
        this.canResendResetEmail = true;
        clearInterval(this.resendResetTimer);
      }
    }, 1000);
  }

  goToLogin(): void {
 
    this.router.navigate(['/login']);
  }

  retryCreation(): void {
  this.router.navigate(['/register'], { state: { email: this.userEmail } });
}

goToHome(): void {
  this.router.navigate(['/home']);
}

contactSupport(): void {
  // Rediriger vers le support ou ouvrir un modal
  this.router.navigate(['/support']);
}

  ngOnDestroy(): void {
    if (this.resendTimer) {
      clearInterval(this.resendTimer);
    }
    if (this.resendResetTimer) {
      clearInterval(this.resendResetTimer);
    }
  }

}