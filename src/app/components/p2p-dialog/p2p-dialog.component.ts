import { Component, Input, OnInit } from '@angular/core';
import { IonIcon, IonContent, IonSpinner } from "@ionic/angular/standalone";
import { ModalController, AlertController } from '@ionic/angular';
import { peopleCircleOutline, schoolOutline, peopleOutline, businessOutline, helpCircleOutline, closeOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { ProfileService } from 'src/services/Service_profile/profile-service';
import { P2p } from 'src/services/P2PIdentification/p2p';
import { NgIf, NgFor } from '@angular/common';
import { catchError, map, of } from 'rxjs';
@Component({
  selector: 'app-p2p-dialog',
  templateUrl: './p2p-dialog.component.html',
  styleUrls: ['./p2p-dialog.component.scss'],
  providers:[ModalController],
  imports: [NgIf, IonContent,IonIcon, IonContent, IonSpinner]
})
export class P2pDialogComponent implements OnInit {
  @Input() userName: string = '';
  @Input() userAvatar?: string;
  @Input() className: string = '';
  @Input() schoolName: string = '';
  @Input() userId!: string;
  @Input() confidence_level!: number;
  
  isLoading: boolean = false;

  constructor(private alertController: AlertController, private p2p: P2p, private modalController: ModalController, private profileService:ProfileService) {}

  ngOnInit() {
    addIcons({peopleCircleOutline, schoolOutline, peopleOutline, businessOutline, helpCircleOutline, closeOutline });
    // Validation des données requises
    if (!this.userId) {
      console.warn('P2PDialog: userName is required');
    }
  }

  /**
   * Confirme que l'utilisateur connaît la personne
   */
// Version plus légère de l'alert
async onConfirm(): Promise<void> {
  if (this.isLoading) return;

  const alert = await this.alertController.create({
    header: 'Confirmer',
    subHeader: `Connaissez-vous ${this.userName} ?`,
    message: 'En confirmant, vous pourrez échanger des messages et participer ensemble aux défis.',
    buttons: [
      {
        text: 'Annuler',
        role: 'cancel',
        cssClass: 'alert-button-cancel'
      },
      {
        text: 'Confirmer',
        cssClass: 'alert-button-confirm',
        handler: async () => {
          await this.processConfirm();
        }
      }
    ]
  });

  await alert.present();
}

 /**
   * Traite la confirmation après l'alert
   */
  private async processConfirm(): Promise<void> {
    this.isLoading = true;
    
    try {

      this.confidence_level = this.confidence_level + 1;
      this.profileService.updateProfile(this.userId, {confidence_level: this.confidence_level}).pipe(
        map((profile) => {
          this.p2p.markProfileAsConfirmed(profile.id, profile.username);
        }),
        catchError((error) => {
          console.error('Error updating profile:', error);
          return of(null);
        })
      ).subscribe();

      await this.delay(300);
      
      await this.modalController.dismiss({
        action: 'confirm',
        userId: this.userId,
        userName: this.userName
      });
    } catch (error) {
      console.error('Erreur lors de la confirmation P2P:', error);
      this.isLoading = false;
      
      // Afficher une alert d'erreur
      const errorAlert = await this.alertController.create({
        header: 'Erreur',
        message: 'Impossible de confirmer la relation. Veuillez réessayer.',
        buttons: ['OK'],
        cssClass: 'error-alert'
      });
      await errorAlert.present();
    }
  }

async onDecline(): Promise<void> {
  if (this.isLoading) return;

  const alert = await this.alertController.create({
    header: 'Décliner',
    subHeader: `Ne connaissez-vous pas ${this.userName} ?`,
    message: 'Vous pourrez toujours le reconnaître plus tard dans vos paramètres.',
    buttons: [
      {
        text: 'Annuler',
        role: 'cancel'
      },
      {
        text: 'Décliner',
        cssClass: 'alert-button-decline',
        handler: async () => {
          await this.processDecline();
        }
      }
    ]
  });

  await alert.present();
}


/**
   * Traite le déclin après l'alert
   */
  private async processDecline(): Promise<void> {
    this.isLoading = true;
    
    try {
      this.confidence_level = this.confidence_level - 1;
      this.profileService.updateProfile(this.userId, {confidence_level: this.confidence_level}).pipe(
        map((profile) => {
          this.p2p.markProfileAsConfirmed(profile.id, profile.username);
        }),
        catchError((error) => {
          console.error('Error updating profile:', error);
          return of(null);
        })
      ).subscribe();
      
      await this.delay(200);
      
      await this.modalController.dismiss({
        action: 'decline',
        userId: this.userId
      });
    } catch (error) {
      console.error('Erreur lors du refus P2P:', error);
      this.isLoading = false;
      
      const errorAlert = await this.alertController.create({
        header: 'Erreur',
        message: 'Impossible de traiter votre demande. Veuillez réessayer.',
        buttons: ['OK']
      });
      await errorAlert.present();
    }
  }
  
  /**
   * Utilitaire pour créer un petit délai (effet smooth)
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
