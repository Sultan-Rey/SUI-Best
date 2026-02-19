import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonList, IonItem, IonLabel, IonAvatar, IonButton, IonIcon, IonLoading, IonAlert } from '@ionic/angular/standalone';
import { ProfileService } from '../../services/PROFILE_SERVICE/profile-service';
import { UserProfile } from '../../models/User';
import { ActivatedRoute } from '@angular/router';
import { addIcons } from 'ionicons';
import { personRemoveOutline, personOutline } from 'ionicons/icons';

@Component({
  selector: 'app-blacklist',
  templateUrl: './blacklist.page.html',
  styleUrls: ['./blacklist.page.scss'],
  standalone: true,
  providers: [ProfileService],
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonList, IonItem, IonLabel, IonAvatar, IonButton, IonIcon, IonLoading, IonAlert, CommonModule, FormsModule]
})
export class BlacklistPage implements OnInit {
  blacklistedProfiles: UserProfile[] = [];
  isLoading = false;
  blackListIds: string[] = [];
  selectedProfileId: string = '';
  showAlert = false;
  
  alertButtons = [
    {
      text: 'Annuler',
      role: 'cancel',
      handler: () => this.cancelUnblacklist()
    },
    {
      text: 'Retirer',
      role: 'destructive',
      handler: () => this.confirmUnblacklist()
    }
  ];

  constructor(
    private profileService: ProfileService,
    private route: ActivatedRoute
  ) {
    addIcons({
      'person-outline': personOutline,
      'person-remove-outline': personRemoveOutline
    });
  }

  ngOnInit() {
    // Récupérer myBlackList depuis les extras
    this.blackListIds = this.route.snapshot.data['myBlackList'] || [];
    if (this.blackListIds.length > 0) {
      this.loadBlacklistedProfiles();
    }
  }

  async loadBlacklistedProfiles() {
    this.isLoading = true;
    try {
      this.blacklistedProfiles = [];
      for (const profileId of this.blackListIds) {
        try {
          const profile = await this.profileService.getProfileById(profileId).toPromise();
          if (profile) {
            this.blacklistedProfiles.push(profile);
          }
        } catch (error) {
          console.error(`Erreur lors du chargement du profil ${profileId}:`, error);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des profils blacklistés:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async unblacklistProfile(profileId: string) {
    this.selectedProfileId = profileId;
    this.showAlert = true;
  }

  async confirmUnblacklist() {
    try {
      // Mettre à jour la liste locale
      this.blackListIds = this.blackListIds.filter(id => id !== this.selectedProfileId);
      this.blacklistedProfiles = this.blacklistedProfiles.filter(p => p.id !== this.selectedProfileId);
      
      // TODO: Appeler le service pour mettre à jour côté serveur si nécessaire
      // await this.profileService.unblackListProfile(userId, this.selectedProfileId);
    } catch (error) {
      console.error('Erreur lors du retrait de la blacklist:', error);
    } finally {
      this.showAlert = false;
      this.selectedProfileId = '';
    }
  }

  cancelUnblacklist() {
    this.showAlert = false;
    this.selectedProfileId = '';
  }
}
