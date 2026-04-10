import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon, IonButton, IonItem, IonLabel, IonInput } from '@ionic/angular/standalone';
import { checkmarkCircle, mailUnread, lockClosed } from 'ionicons/icons';
import { Auth } from 'src/services/AUTH/auth';

@Component({
  selector: 'app-default',
  templateUrl: './default.page.html',
  styleUrls: ['./default.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon, IonButton, IonItem, IonLabel, IonInput, CommonModule, FormsModule]
})
export class DefaultPage implements OnInit, OnDestroy {

  constructor(private route: ActivatedRoute, private router: Router, private auth: Auth) { }

  ngOnInit() {
    // Récupérer le paramètre d'URL pour la route default/:arg
    this.route.paramMap.subscribe(params => {
      this.arg = params.get('arg');
    });
    
    // Récupérer les extras de la navigation
    const navigation = this.router.getCurrentNavigation();
    this.extras = navigation?.extras?.state || null;
  }

  arg: string | null = null;
  extras: any = null;

  // Icons
  checkmarkCircle = checkmarkCircle;
  mailUnread = mailUnread;
  lockClosed = lockClosed;

  get isAccountSuccess(): boolean {
    return this.arg === 'account-success';
  }

  get isPasswordReset(): boolean {
    return this.arg === 'password-reset';
  }

  get isPasswordChange(): boolean {
    return this.arg === 'password-change';
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

  ngOnDestroy(): void {
    if (this.resendTimer) {
      clearInterval(this.resendTimer);
    }
    if (this.resendResetTimer) {
      clearInterval(this.resendResetTimer);
    }
  }

}