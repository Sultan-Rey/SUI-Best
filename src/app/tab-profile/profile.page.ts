import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { NgIf, CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { ChallengeFormComponent } from '../components/modal-challenge-form/challenge-form.component.js';
import { ModalChallengeComponent } from '../components/modal-challenge-view/modal-challenge.component.js';
import { ModalMessageComponent } from '../components/modal-message/modal-message.component.js';
import { addIcons } from 'ionicons';

import { 
  shareSocialOutline, 
  ellipsisVertical, 
  addCircle, 
  banOutline,
  flagOutline,
  checkmarkCircle, 
  star, 
  shieldHalf,
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
  personCircleOutline,
  rocketOutline,
  add, musicalNotesOutline, chatbubble, chevronBack, 
  create} from 'ionicons/icons';
import { 
  IonContent, 
  IonHeader,
  IonToolbar, 
  IonButtons, 
  IonButton, 
  IonIcon, 
  IonBadge,
  IonFab,
  IonFabButton, IonSpinner, IonTitle }  from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { ActionSheetController, AlertController, ToastController } from '@ionic/angular';
import { UserProfile } from 'src/models/User.js';
import { Observable, of, Subject, switchMap, takeUntil, tap } from 'rxjs';
import { Challenge } from 'src/models/Challenge.js';
import { ProfileService } from 'src/services/PROFILE_SERVICE/profile-service.js';
import { Auth } from 'src/services/AUTH/auth.js';
import { CreationService } from 'src/services/CREATION_SERVICE/creation-service.js';
import { UserService } from 'src/services/USER_SERVICE/user-service.js';
import { Content } from 'src/models/Content.js';
import { ChallengeService } from 'src/services/CHALLENGE_SERVICE/challenge-service.js';
import { AccountModalComponent } from '../components/modal-account/account-modal.component.js';
import { MediaUrlPipe } from '../utils/pipes/mediaUrlPipe/media-url-pipe';
import { ModalEditProfileComponent } from '../components/modal-edit-profile/modal-edit-profile.component.js';
import { ShortNumberPipe } from '../utils/pipes/shortNumberPipe/short-number-pipe.js';
import { isNullOrUndefined } from 'html5-qrcode/esm/core.js';
import { FollowedViewComponent } from '../components/view-followed/followed-view.component.js';

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
    CommonModule, FormsModule, MediaUrlPipe, ShortNumberPipe
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
  successPosts: Post[] = [];
  private destroy$ = new Subject<void>();
  constructor(
    private cdr: ChangeDetectorRef, 
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private profileService : ProfileService,
    private authservice: Auth,
    private creationService: CreationService,
    private challengeService: ChallengeService,
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
    
    addIcons({shieldHalf, rocketOutline, banOutline, flagOutline, close, createOutline, settingsOutline, chevronBack,shareSocialOutline,star, ellipsisVertical,addCircle,checkmarkCircle,schoolOutline,linkOutline,calendarOutline,openOutline,trophyOutline,flameOutline,peopleOutline,musicalNotesOutline,timeOutline,add,heart,chatbubble, personCircleOutline});
  }
ngOnInit() {

  const currentUser = this.authservice.getCurrentUser();
  this.currentUserId = currentUser?.id?.toString() || null;
  const param_id = this.route.snapshot.paramMap.get('id');
  if(!isNullOrUndefined(param_id)){
    this.isOwnProfile = false;
    this.loadUserProfile(param_id as string).then(()=>{

    })
  }else{
    this.loadUserProfile(this.currentUserId as string)
  }

  // S'abonner aux changements d'authentification
  this.authservice.currentUser$.pipe(
    takeUntil(this.destroy$)
  ).subscribe(user => {
    const currentUserId = user?.id?.toString() || null;
    if (this.userProfile) {
      // Mettre à jour isOwnProfile en fonction de la route actuelle
      const isTabsRoute = this.router.url.startsWith('/tabs');
      if (isTabsRoute) {
        this.isOwnProfile = true;
      } else {
        this.isOwnProfile = this.userProfile.id === currentUserId;
      }
    }
    this.currentUserId = currentUserId;
  });
}

async toggleFollow() {
  if (!this.currentUserId || !this.userProfile) return;
  this.isLoading = true;
  try {
    let result;
    if (this.userProfile.isFollowing) {
      result = await this.profileService.unfollowProfile(this.currentUserId, this.userProfile.id);
    } else {
      result = await this.profileService.followProfile(this.currentUserId, this.userProfile.id);
    }

    // Mise à jour locale des données
    if (result) {
      this.userProfile.isFollowing = !this.userProfile.isFollowing;
      if (result.profile) {
        // Mettre à jour le compteur de fans avec la valeur du serveur
        this.userProfile.stats = this.userProfile.stats || { fans: 0, following: 0 };
        this.userProfile.stats.fans = result.profile.stats?.fans || 0;
      }
    }
  } catch (err) {
    console.error('Erreur lors de la mise à jour du suivi', err);
    const toast = await this.toastController.create({
      message: 'Erreur lors de la mise à jour du suivi',
      duration: 3000,
      position: 'bottom',
      color: 'danger'
    });
    await toast.present();
  }finally{
    this.isLoading = false;
  }
}

 
   async loadUserProfile(userId: string) {
  if (!userId) {
    this.router.navigate(['/login']);
    return;
  }

  this.isLoading = true;

  try {
  
    const profile = await this.profileService.getProfileById(userId).toPromise();
    if (!profile) {
      throw new Error('Profil non trouvé');
    }
    if(this.currentUserId!== profile.id){
     const myUserProfile =  await this.profileService.getProfileById(this.currentUserId as string).toPromise();
      profile.isFollowing = myUserProfile?.myFollows.some((id)=> id == profile.id ) || false;
    }
    this.userProfile = profile;
    this.isOwnProfile = this.currentUserId === userId;
    this.cdr.detectChanges();
    
    // Charger les données associées
    this.loadUserContents(userId);
    this.loadActiveChallenges(userId);
    
  } catch (error) {
    console.error('Erreur lors du chargement du profil:', error);
    this.router.navigate(['tabs/tabs/home']);
  } finally {
    this.isLoading = false;
  }
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
    this.activeChallengesCount = 0;
    this.activeChallenges$ = this.challengeService.getChallengesByCreator(UerId);
    this.activeChallenges$.subscribe((challenges: Challenge[]) => {
      if(challenges.some((challenge)=> challenge.is_active)){
      this.activeChallengesCount++;
      }
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

  getDaysRemaining(challenge: Challenge): number {
  if (!challenge.end_date) return 0;
  
  const endDate = new Date(challenge.end_date);
  if (isNaN(endDate.getTime())) {
    console.error('Date de fin invalide:', challenge.end_date);
    return 0;
  }
  
  const now = new Date();
  const diffTime = endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

  getChallengeStatus(challenge: Challenge): 'active' | 'ending-soon' | 'ended' {
    const daysRemaining = this.getDaysRemaining(challenge);
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
  async presentShareOptions(profile: UserProfile) {
    const actionSheet = await this.actionSheetController.create({
      header: 'Partager le profil',
      buttons: [
        {
          text: 'Copier le lien',
          icon: 'link',
          handler: () => {
            this.copyProfileLink(profile);
          }
        },
        {
          text: 'Partager via...',
          icon: 'share-social',
          handler: () => {
            this.shareProfile(profile);
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
 
  if (isOwnProfile) {
    buttons.push(
      {
        text: 'Mon Compte',
        icon: 'person-circle-outline',
        handler: () => {
          this.openAccountModal();
        }
      },
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
    // Options pour le profil de l'utilisateur connecté
    /*if(this.activeChallengesCount > 0 && this.userProfile?.userType === 'creator') {
      buttons.push(
        {
          text: 'Nouveau Défi',
          icon: 'trophy-outline',
          handler: () => {
            this.createChallenge();
          }
        }
      );
    }*/
    
    
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

async openAccountModal() {
  const modal = await this.modalCtrl.create({
        component: AccountModalComponent,
        componentProps: {},
        cssClass: 'auto-height',
        initialBreakpoint: 0.75,
        breakpoints: [0, 0.75, 1],
        handle: true
      });
      
      await modal.present();
      
      modal.onDidDismiss().then((data) => {
        if (data.data && data.data.success) {
          //console.log('Achat de coins réussi:', data.data.pack);
         
        }
      });
}

async openChallengeModal(challenge: Challenge){
  const modal = await this.modalCtrl.create({
    component: ModalChallengeComponent,
    cssClass: 'auto-height',
    componentProps: {challenge: challenge, currentUserProfile:this.userProfile},
  })

  await modal.present();
}

private async editProfile() {
  const modal = await this.modalCtrl.create({
    component: ModalEditProfileComponent,
    componentProps: {
      profile: this.userProfile
    },
    cssClass: 'auto-height',
    initialBreakpoint: 0.9,
    breakpoints: [0, 0.9, 1]
  });

  await modal.present();

  const { data } = await modal.onDidDismiss();
  
  if (data?.success && data?.profile) {
    // Update the local profile data
    this.userProfile = data.profile;
    this.cdr.detectChanges();
    
    // Show success message
    const toast = await this.toastController.create({
      message: 'Profil mis à jour avec succès',
      duration: 2000,
      position: 'bottom',
      color: 'success'
    });
    await toast.present();
  }
}

private openSettings() {
  // Récupérer l'utilisateur connecté
  const currentUser = this.authservice.getCurrentUser();
 
  if (!currentUser || !this.userProfile) {
    console.error('Utilisateur ou profil non disponible pour les paramètres');
    return;
  }

  // Naviguer vers settings avec les extras nécessaires
  this.router.navigate(['/settings'], {
    state: {
      userProfile: this.userProfile,
      user: currentUser
    }
  });
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

  copyProfileLink(profile:UserProfile) {
    const link = `https://app.com/profile/${profile.id}`;
    navigator.clipboard.writeText(link);
    console.log('Link copied:', link);
  }

  async shareProfile(profile: UserProfile) {
    const shareData = {
      title: `${profile.displayName} - Best Academy`,
      text: `Découvrez le profil de ${profile.displayName}${profile.bio ? ': ' + profile.bio : ''}`,
      url: `https://app.com/profile/${profile.id}`
    };

    try {
      // Vérifier si l'API Web Share est disponible
      if (navigator.share) {
        await navigator.share(shareData);
        console.log('Profile shared successfully');
      } else {
        // Fallback: copier le lien dans le presse-papiers
        await this.copyProfileLink(profile);
        await this.presentToast('Lien du profil copié dans le presse-papiers', 'success');
      }
    } catch (error: unknown) {
      console.error('Error sharing profile:', error);
      
      // En cas d'erreur, proposer de copier le lien
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      if (errorName !== 'AbortError') { // L'utilisateur a annulé le partage
        await this.copyProfileLink(profile);
        await this.presentToast('Lien du profil copié dans le presse-papiers', 'success');
      }
    }
  }

  async openDM() {
    const modal = await this.modalCtrl.create({
      component: ModalMessageComponent,
      componentProps: {
        currentUserId: this.currentUserId,
        currentUsername: this.userProfile?.displayName
      },
      cssClass: 'modal-fullscreen'
    });
    
    await modal.present();
  }

  // Dans profile.page.ts
async openContent(content: Content) {
  
  if (!content) {
        console.error('Content not found for item:', content);
        return;
      }
      const myUserProfile = await this.profileService.getProfileById(this.currentUserId as string).toPromise();
          const modal = await this.modalCtrl.create({
          component: FollowedViewComponent,
          componentProps: {
            currentUserProfile: myUserProfile,
            posts: [content],
            challengeName: '-'
          },
          animated: true,
          cssClass: 'followed-view-modal',
          handle: true
        });
        await modal.present();
}


onImageAvatarError(event: any) {
    // On récupère l'élément HTML <img> qui a déclenché l'erreur
    const imgElement = event.target as HTMLImageElement;
   imgElement.onerror = null;
    // On remplace la source par l'image locale
    imgElement.src = 'assets/avatar-default.png';
    // Optionnel : ajouter une classe pour styliser différemment l'avatar par défaut si besoin
    imgElement.classList.add('is-default');
  }


  onImageContentError(event: any) {
    // On récupère l'élément HTML <img> qui a déclenché l'erreur
    const imgElement = event.target as HTMLImageElement;
   imgElement.onerror = null;
    // On remplace la source par l'image locale
    imgElement.src = 'assets/splash.png';
    // Optionnel : ajouter une classe pour styliser différemment l'avatar par défaut si besoin
    imgElement.classList.add('is-default');
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