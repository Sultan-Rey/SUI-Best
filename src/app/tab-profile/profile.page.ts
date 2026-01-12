import { Component, OnInit } from '@angular/core';
import { NgIf, CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { ChallengeFormComponent } from '../components/challenge-form/challenge-form.component';
import { addIcons } from 'ionicons';

import { 
  shareSocialOutline, 
  ellipsisVertical, 
  addCircle, 
  checkmarkCircle, 
  star, 
  linkOutline, 
  calendarOutline, 
  openOutline,
  flag,
  ban,
  close,
  heart,
  createOutline,
  settingsOutline,
  trophyOutline,
  schoolOutline,
  flameOutline,
  peopleOutline,
  timeOutline,
  add, musicalNotesOutline, chatbubble, chevronBack, 
  create} from 'ionicons/icons';
import { 
  IonContent, 
  IonHeader,
  IonToolbar, 
  IonModal,
  IonButtons, 
  IonButton, 
  IonIcon, 
  IonBadge,
  IonFab,
  IonFabButton, IonSpinner, IonTitle }  from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { ActionSheetController, AlertController, ToastController } from '@ionic/angular';
import { UserProfile } from 'src/models/User';
import { Observable } from 'rxjs';
import { Challenge } from 'src/models/Challenge';
import { ProfileService } from 'src/services/PROFILE_SERVICE/profile-service';
import { Auth } from 'src/services/AUTH/auth';
import { CreationService } from 'src/services/CREATION/creation-service';
import { UserService } from 'src/services/USER_SERVICE/user-service';
import { Content } from 'src/models/Content';


interface Post {
  id: number;
  imageUrl: string;
  title: string;
  votes: number;
  category: string;
}



@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  providers: [ModalController],
  imports: [ NgIf,IonTitle, IonSpinner, 
    IonContent, IonHeader, IonToolbar, IonButtons, IonButton, 
    IonIcon, IonBadge, IonFab, IonFabButton,
    CommonModule, FormsModule
  ] 
})
export class ProfilePage implements OnInit {

  
  selectedTab: 'posts' | 'success' | 'info' = 'posts';
  isOwnProfile: boolean = false; // Détermine si c'est le profil de l'utilisateur connecté
  isLoading : boolean =false;
  userProfile!:UserProfile; 
  currentUserId: string | null = null;
  activeChallenges$!: Observable<Challenge[]>;
  hasActiveChallenges = true;
  activeChallengesCount : number = 0;
  userContents: Content[] = [];
  isLoadingContents = false; 
  isWrite_toRight = false;
  successPosts: Post[] = [];
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private profileService : ProfileService,
    private authservice: Auth,
    private creationService: CreationService,
    private alertController: AlertController,
    private toastController: ToastController,
    private actionSheetController: ActionSheetController,
    private modalCtrl: ModalController
  ) {
    this.userProfile = {} as UserProfile;
    this.userProfile.stats = {} as {
      posts: 0;
      fans: 0;
      votes: 0;
      stars: 0;
    };
    
    addIcons({ flag, ban, close, createOutline, settingsOutline, chevronBack,shareSocialOutline,star, ellipsisVertical,addCircle,checkmarkCircle,schoolOutline,linkOutline,calendarOutline,openOutline,trophyOutline,flameOutline,peopleOutline,musicalNotesOutline,timeOutline,add,heart,chatbubble});
  }

  ngOnInit() {
    const userId = this.route.snapshot.paramMap.get('id');
    this.currentUserId = this.authservice.getCurrentUser()?.id?.toString() || null;
    this.isWrite_toRight = this.authservice.getCurrentUser()?.readonly?.valueOf() || false;
    if (userId) {
       this.isOwnProfile = userId === this.currentUserId;
      this.loadUserProfile(userId);
    }else{
      
      this.loadUserProfile(this.currentUserId || '');
    }
  }

 

  toggleFollow() {
    if (!this.currentUserId || !this.userProfile) return;

    const action$ = this.userProfile.isFollowing
      ? this.profileService.unfollowProfile(this.currentUserId, this.userProfile.id)
      : this.profileService.followProfile(this.currentUserId, this.userProfile.id);

    action$.subscribe({
      next: () => {
        // Mise à jour locale de l'état de suivi
        if (this.userProfile) {
          this.userProfile.isFollowing = !this.userProfile.isFollowing;
          // Mise à jour du compteur
          //this.userProfile.stats.fans += this.userProfile.isFollowing ? 1 : -1;
        }
      },
      error: err => console.error('Erreur lors de la mise à jour du suivi', err)
    });
  }

  // Dans votre composant (profile.page.ts)
getFullFileUrl(relativePath: string): string {
  // Remplacez par l'URL de votre API
  const apiUrl = 'http://localhost:3000'; 
  // Supprime le slash initial s'il existe pour éviter les doubles slashes
  const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
  return `${apiUrl}/${cleanPath}`;
}
 
   loadUserProfile(userId: string) {
    this.isLoading = true;
    this.profileService.getProfileById(userId)
      .subscribe({
        next: (profile) => {
          this.userProfile = profile;
          this.loadUserContents(userId); // Charger les contenus après le chargement du profil
          this.isLoading = false;
          this.isOwnProfile = true;
        },
        error: (err) => {
          console.error('Erreur lors du chargement du profil', err);
          this.isLoading = false;
        }
      });
  }

  loadUserContents(userId: string) {
    this.isLoadingContents = true;
    this.creationService.getUserContents(userId).subscribe({
      next: (contents) => {
        this.userContents = contents;
        this.isLoadingContents = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des contenus', err);
        this.isLoadingContents = false;
      }
    });
  }


  loadActiveChallenges(UerId: string){
    this.activeChallenges$ = this.creationService.getChallengesByCreator(UerId);
    this.activeChallenges$.subscribe((challenges: Challenge[]) => {
      this.activeChallengesCount = challenges.length;
    });
    
  }

  selectTab(tab: 'posts' | 'success' | 'info') {
    this.selectedTab = tab;
  }

  

  // Gestion des challenges
  async createChallenge() {
     const modal = await this.modalCtrl.create({
      component: ChallengeFormComponent,
      componentProps: {
        challenge: null // Permet d'éditer un challenge existant ou d'en créer un nouveau
      },
      cssClass: 'auto-height',
      backdropDismiss: false
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();
    
    if (data) {
      this.loadActiveChallenges(this.currentUserId || ''); // Rafraîchir la liste des challenges
    }
   
  }

   async openChallenge(challenge?: Challenge) {
    console.log('Navigating to create challenge...');
    //this.router.navigate(['/create-challenge']);
  }

  viewAllChallenges() {
    console.log('Viewing all challenges for user:', this.userProfile.id);
    this.router.navigate(['/challenges', this.userProfile.id]);
  }

  getDaysRemaining(endDate?: Date): number {
    if (!endDate) return 0;
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  getChallengeStatus(challenge: Challenge): 'active' | 'ending-soon' | 'ended' {
    const daysRemaining = this.getDaysRemaining(challenge.end_date);
    if (daysRemaining <= 0) return 'ended';
    if (daysRemaining <= 3) return 'ending-soon';
    return 'active';
  }

  getStatusBadgeColor(status: string): string {
    switch(status) {
      case 'active': return 'success';
      case 'ending-soon': return 'warning';
      case 'ended': return 'medium';
      default: return 'primary';
    }
  }

  getStatusText(status: string): string {
    switch(status) {
      case 'active': return 'EN COURS';
      case 'ending-soon': return 'BIENTÔT TERMINÉ';
      case 'ended': return 'TERMINÉ';
      default: return 'ACTIF';
    }
  }

  // Méthodes existantes
  async presentShareOptions() {
    const actionSheet = await this.actionSheetController.create({
      header: 'Partager le profil',
      buttons: [
        {
          text: 'Copier le lien',
          icon: 'link',
          handler: () => {
            this.copyProfileLink();
          }
        },
        {
          text: 'Partager via...',
          icon: 'share-social',
          handler: () => {
            this.shareProfile();
          }
        },
        {
          text: 'Annuler',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

 async presentMoreOptions() {
  const isOwnProfile = this.userProfile?.id === this.authservice.getCurrentUser()?.id;
  
  const buttons = [];
  console.log("current_profile_is"+isOwnProfile);
  if (isOwnProfile) {
    // Options pour le profil de l'utilisateur connecté
    buttons.push(
      {
        text: 'Modifier le profil',
        icon: 'create-outline',
        handler: () => {
          this.editProfile();
        }
      },
      {
        text: 'Paramètres',
        icon: 'settings-outline',
        handler: () => {
          this.openSettings();
        }
      }
    );
  } else {
    // Options pour le profil d'un autre utilisateur
    buttons.push(
      {
        text: 'Signaler',
        icon: 'flag-outline',
        role: 'destructive',
        handler: () => {
          this.reportUser();
        }
      },
      {
        text: 'Bloquer',
        icon: 'ban-outline',
        role: 'destructive',
        handler: () => {
          this.blockUser();
        }
      }
    );
  }

  // Bouton Annuler commun aux deux cas
  buttons.push({
    text: 'Annuler',
    icon: 'close',
    role: 'cancel'
  });

  const actionSheet = await this.actionSheetController.create({
    header: isOwnProfile ? 'Options du profil' : 'Options',
    buttons: buttons
  });

  await actionSheet.present();
}

// Ajoutez ces méthodes si elles n'existent pas déjà
private editProfile() {
  this.router.navigate(['/edit-profile']);
}

private openSettings() {
  this.router.navigate(['/settings']);
}

private async reportUser() {
  const alert = await this.alertController.create({
    header: 'Signaler un utilisateur',
    message: 'Pourquoi souhaitez-vous signaler cet utilisateur ?',
    inputs: [
      {
        name: 'reason',
        type: 'text',
        placeholder: 'Raison du signalement'
      }
    ],
    buttons: [
      {
        text: 'Annuler',
        role: 'cancel'
      },
      {
        text: 'Envoyer',
        handler: (data) => {
          if (data.reason) {
            // Envoyer le signalement
            console.log('Signalement envoyé :', data.reason);
            this.presentToast('Signalement envoyé avec succès', 'success');
            return true; // Ajoutez cette ligne pour fermer l'alerte
          } else {
            this.presentToast('Veuillez indiquer une raison', 'warning');
            return false; // Empêche la fermeture de l'alerte
          }
        }
      }
    ]
  });
  await alert.present();
}
private async blockUser() {
  const alert = await this.alertController.create({
    header: 'Confirmer',
    message: 'Voulez-vous vraiment bloquer cet utilisateur ?',
    buttons: [
      {
        text: 'Annuler',
        role: 'cancel'
      },
      {
        text: 'Bloquer',
        role: 'destructive',
        handler: () => {
          // Implémentez la logique de blocage
          console.log('Utilisateur bloqué');
          this.presentToast('Utilisateur bloqué avec succès', 'success');
          // Revenir en arrière ou rafraîchir la page
          this.router.navigate(['/tabs/tab-home']);
        }
      }
    ]
  });
  await alert.present();
}

// Ajoutez cette méthode utilitaire pour les notifications
private async presentToast(message: string, color: 'success' | 'warning' | 'danger' = 'success') {
  const toast = await this.toastController.create({
    message: message,
    duration: 2000,
    color: color,
    position: 'bottom'
  });
  await toast.present();
}

  copyProfileLink() {
    const link = `https://app.com/profile/${this.userProfile.id}`;
    navigator.clipboard.writeText(link);
    console.log('Link copied:', link);
  }

  shareProfile() {
    console.log('Sharing profile...');
  }

  sendMessage() {
    console.log('Opening message...');
  }

  // Dans profile.page.ts
openContent(content: Content) {
  // Naviguer vers la page de détail du contenu
  this.router.navigate(['/content-detail', content.id]);
  // Ou ouvrir un modal avec le contenu
  // this.presentContentModal(content);
}

goBack() {
  if (this.location.back) {
    this.location.back();
  } else {
    this.router.navigate(['/home']);
  }
}

 formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null) {
    return '0';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}
}