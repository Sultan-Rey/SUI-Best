import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  heart,
  trophyOutline,
  schoolOutline,
  flameOutline,
  peopleOutline,
  timeOutline,
  add, musicalNotesOutline, chatbubble, chevronBack } from 'ionicons/icons';
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
import { ActionSheetController } from '@ionic/angular';
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
  imports: [IonTitle, IonSpinner, 
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
    private userService: UserService,
    private creationService: CreationService,
    private actionSheetController: ActionSheetController
  ) {
    this.userProfile = {} as UserProfile;
    this.userProfile.stats = {} as {
      posts: number;
      fans: number;
      votes: number;
      stars: number;
    };
    addIcons({chevronBack,shareSocialOutline,star, ellipsisVertical,addCircle,checkmarkCircle,schoolOutline,linkOutline,calendarOutline,openOutline,trophyOutline,flameOutline,peopleOutline,musicalNotesOutline,timeOutline,add,heart,chatbubble});
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
      ? this.userService.unfollowProfile(this.currentUserId, this.userProfile.id)
      : this.userService.followProfile(this.currentUserId, this.userProfile.id);

    action$.subscribe({
      next: () => {
        // Mise à jour locale de l'état de suivi
        if (this.userProfile) {
          this.userProfile.isFollowing = !this.userProfile.isFollowing;
          // Mise à jour du compteur
          this.userProfile.stats.fans += this.userProfile.isFollowing ? 1 : -1;
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
    this.profileService.getProfileByUserId(userId, this.currentUserId || undefined)
      .subscribe({
        next: (profile) => {
          this.userProfile = profile;
          this.loadUserContents(userId); // Charger les contenus après le chargement du profil
          this.isLoading = false;
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
  createChallenge() {
    console.log('Navigating to create challenge...');
    this.router.navigate(['/create-challenge']);
  }

  openChallenge(challenge: Challenge) {
    console.log('Opening challenge:', challenge.id);
    this.router.navigate(['/challenge', challenge.id]);
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
    const actionSheet = await this.actionSheetController.create({
      header: 'Options',
      buttons: [
        {
          text: 'Signaler',
          icon: 'flag',
          role: 'destructive',
          handler: () => {
            this.reportUser();
          }
        },
        {
          text: 'Bloquer',
          icon: 'ban',
          role: 'destructive',
          handler: () => {
            this.blockUser();
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

  copyProfileLink() {
    const link = `https://app.com/profile/${this.userProfile.id}`;
    navigator.clipboard.writeText(link);
    console.log('Link copied:', link);
  }

  shareProfile() {
    console.log('Sharing profile...');
  }

  reportUser() {
    console.log('Reporting user...');
  }

  blockUser() {
    console.log('Blocking user...');
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