import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { NgFor, NgIf,  SlicePipe, DatePipe } from '@angular/common';
import { FilterPipe } from '../utils/pipes/filter-pipe.js';
import { ToastController, ModalController } from '@ionic/angular';
import { 
  IonHeader, 
  IonToolbar, 
  IonIcon, 
  IonButton, 
  IonContent,
  IonInfiniteScroll, IonInfiniteScrollContent, IonRefresher, IonRefresherContent, IonSkeletonText } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  search, 
  notificationsOutline, 
  play, 
  giftOutline, 
  heart,
  people,
  trophy,
  star,
  chatbubble,
  heartOutline,
  bookmarkOutline,
  chatbubbleEllipsesOutline, 
  starOutline, 
  shareOutline, chevronUp, chevronDown, trophyOutline, peopleOutline, timeOutline, playCircle, add } from 'ionicons/icons';
import { Content } from 'src/models/Content.js';
import { CreationService } from 'src/services/CREATION/creation-service.js';
import { ProfileService } from 'src/services/PROFILE_SERVICE/profile-service.js';
import { getMediaUrl} from 'src/app/utils/media.utils.js';
import { Challenge } from 'src/models/Challenge.js';
import { Auth } from 'src/services/AUTH/auth.js';
import { UserProfile } from 'src/models/User.js';
import { Router } from '@angular/router';
import { CommentService } from 'src/services/COMMENTS_SERVICE/comment-service.js';
import { catchError, filter, map, Observable, of, Subject, switchMap, takeUntil, tap, finalize } from 'rxjs';
import { DiscoveryViewComponent } from "../components/discovery-view/discovery-view.component.js";
import { ChallengeService } from 'src/services/CHALLENGE_SERVICE/challenge-service.js';
import { CouponModalComponent } from '../components/coupon-modal/coupon-modal.component.js';


@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  providers: [ModalController],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DiscoveryViewComponent, DatePipe, IonRefresherContent, IonRefresher, FilterPipe, IonInfiniteScrollContent,
    IonInfiniteScroll, NgFor, NgIf, SlicePipe, IonHeader, IonToolbar, IonIcon, IonButton, IonContent, DiscoveryViewComponent]
})

export class HomePage implements OnInit {
  @ViewChild(IonContent) content!: IonContent;
  private destroy$ = new Subject<void>();
  needsRefresh = false;
  posts: Content[] = [];
 showDiscoveryView: boolean = true;
isTransitioning: boolean = false;

  currentIndex = 0;
  currentPage = 1;
  isLoading = false;
  private readonly PAGE_SIZE = 5;
  currentUserProfile: UserProfile = {} as UserProfile;
  private loadingProfiles = new Set<string>();
  userAvatars: { [userId: string]: string } = {};
  trackByPostId(index: number, post: Content): string {
    return post.id || index.toString();
  }

  get currentPost(): any {
    if (this.posts.length > 0) {
      return this.posts[this.currentIndex];
    }
    return [];
  }

  
  constructor(private cdr: ChangeDetectorRef, 
    private toastController:ToastController, 
    private modalController: ModalController,
    private router: Router, 
    private creationService: CreationService, 
    private challengeService: ChallengeService,
    private commentService: CommentService,
    private ProfileService: ProfileService, 
    private authService: Auth)
 {
  this.currentUserProfile.stats = {} as {
      posts: 0;
      fans: 0;
      votes: 0;
      stars: 0;
    };
    this.currentUserProfile.myFollows = [];
    addIcons({search,notificationsOutline,peopleOutline,timeOutline,playCircle,heart,people,add,trophy,star,chatbubble,heartOutline,bookmarkOutline,trophyOutline,play,chevronUp,chevronDown,'giftOutline':giftOutline,'chatbubbleEllipsesOutline':chatbubbleEllipsesOutline,'starOutline':starOutline,'shareOutline':shareOutline});
     this.commentService.commentAdded$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(({contentId, increment}) => {
      const post = this.posts.find(p => p.id === contentId);
      if (post) {
        post.commentCount = (post.commentCount || 0) + increment;
        this.posts = [...this.posts]; // Forcer la détection de changement
      }
    });
  
  }

  
filterPublic = (post: Content): boolean => {
  // Si le contenu n'est pas public, on le filtre
  if (post.isPublic === false) {
    return false;
  }
  
  // Si on n'a pas encore chargé le profil utilisateur, on affiche le contenu par défaut
  if (!this.currentUserProfile) {
    return true;
  }
  // L'utilisateur peut voir son propre contenu
  if (post.userId === this.currentUserProfile.id) {
    return true;
  }
  
  // Vérification sécurisée de l'existence de myfollows et conversion en tableau si nécessaire
  const follows = Array.isArray(this.currentUserProfile.myFollows) 
    ? this.currentUserProfile.myFollows 
    : [];
  
  // Si le créateur du contenu est dans les abonnements de l'utilisateur connecté, on l'affiche
  return follows.includes(post.userId);
}
  ngOnInit() {
  this.setupAuthSubscription();
  this.setupNewContentSubscription();
   
}

private setupAuthSubscription(): void {
  this.authService.currentUser$.pipe(
    takeUntil(this.destroy$),
    tap(user => {
      if (!user) {
        this.posts = [];
        this.currentUserProfile = {} as UserProfile;
        this.cdr.markForCheck();
      }
    }),
    filter(user => !!user),
    switchMap(user => 
      this.ProfileService.getProfileById(user.id.toString()).pipe(
        tap(profile => {
          this.currentUserProfile = profile;
          this.updateViewState(profile.myFollows.length);
          this.cdr.markForCheck();
        })
      )
    ),
    switchMap(() => this.loadInitialFeed())
  ).subscribe();
}

private setupNewContentSubscription(): void {
  this.creationService.newContent$.pipe(
    takeUntil(this.destroy$)
  ).subscribe(newContent => {
    if (newContent && this.currentUserProfile?.id) {
      const exists = this.posts.some(p => p.id === newContent.id);
      if (!exists) {
        this.posts = [newContent, ...this.posts];
        console.log(this.posts[0].challengeId);
        this.loadAvatarForPost(newContent);
        this.cdr.markForCheck();
      }
    }
  });
}

private loadInitialFeed(): Observable<void> {
  this.isLoading = true;
  this.currentPage = 1;
  
  return this.creationService.getFeedContents(this.currentPage, this.PAGE_SIZE).pipe(
    switchMap(async (newPosts) => {
      await this.processNewPosts(newPosts);
      this.currentPage++;
      this.isLoading = false;
      this.cdr.markForCheck();
      return undefined;
    }),
    catchError(err => {
      console.error('Erreur lors du chargement initial:', err);
      this.isLoading = false;
      this.cdr.markForCheck();
      return of(undefined);
    })
  );
}


private async processNewPosts(newPosts: Content[]): Promise<void> {
  // Créer une copie des posts avec les propriétés supplémentaires
  const postsWithUser = await Promise.all(newPosts.map(async post => {
    let username = 'Utilisateur';
    
    // Récupérer le nom d'utilisateur depuis le profil
    if (post.userId) {
      try {
        const userProfile = await this.ProfileService.getProfileById(post.userId).toPromise();
        if (userProfile?.username) {
          username = userProfile.username;
        }
      } catch (error) {
        console.warn(`Impossible de charger le profil pour l'utilisateur ${post.userId}:`, error);
      }
    }

    // Charger les informations du challenge si nécessaire
    if (post.challengeId && this.currentChallenge[post.challengeId] === undefined) {
      this.getCurrentChallenge(post);
    }

    return {
      ...post,
      username: username,
      isLikedByUser: this.currentUserProfile?.id 
        ? post.likedIds?.includes(this.currentUserProfile.id) || false
        : false
    } as Content & { username: string, isLikedByUser: boolean };
  }));

  // Mettre à jour la liste des posts
  if (this.currentPage === 1) {
    this.posts = postsWithUser;
  } else {
    this.posts = [...this.posts, ...postsWithUser];
  }

  // Charger les avatars pour les nouveaux posts
  postsWithUser.forEach(post => this.loadAvatarForPost(post));
  
  // Forcer la mise à jour de la vue
  this.cdr.markForCheck();
}

private loadAvatarForPost(post: Content): void {
  if (post.userId && !this.userAvatars[post.userId] && !this.loadingProfiles.has(post.userId)) {
    this.loadingProfiles.add(post.userId);
    
    this.ProfileService.getProfileById(post.userId).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.loadingProfiles.delete(post.userId))
    ).subscribe({
      next: (profile) => {
        if (profile?.avatar) {
          this.userAvatars[post.userId] = profile.avatar;
          this.cdr.markForCheck();
        }
      },
      error: () => {
        this.userAvatars[post.userId] = 'assets/avatar-default.png';
        this.cdr.markForCheck();
      }
    });
  }
}


private updateViewState(followsCount: number) {
  const shouldShowDiscovery = followsCount <= 1;
  
  // Si l'état change, on déclenche la transition
  if (this.showDiscoveryView !== shouldShowDiscovery) {
    this.isTransitioning = true;
    
    // Petite pause pour laisser le temps à l'animation de se terminer
    setTimeout(() => {
      this.showDiscoveryView = shouldShowDiscovery;
      this.isTransitioning = false;
      this.cdr.detectChanges();
    }, 300); // Durée de la transition en ms
  }
}

  
  handleAction(action: any) { action.action(); }


  /**
   * Charge les contenus depuis le service
   */
async loadFeed(event?: any) {
  if (this.isLoading) return;
  this.isLoading = true;
  
  try {
    const newPosts = await this.creationService.getFeedContents(this.currentPage, this.PAGE_SIZE).toPromise();
    if (!newPosts) return;
    
    await this.processNewPosts(newPosts);
    
    if (event) {
      event.target.complete();
      if (newPosts.length < this.PAGE_SIZE) {
        event.target.disabled = true;
      }
    }
    
    this.currentPage++;
  } catch (err) {
    console.error('Erreur lors du chargement du feed:', err);
    if (event) event.target.complete();
  } finally {
    this.isLoading = false;
    this.cdr.markForCheck();
  }
}

// Pour forcer un rechargement complet
refreshFeed(event: any) {
  this.currentPage = 1;
  this.userAvatars = {}; // Réinitialiser le cache des avatars
  this.loadFeed(event);
}

getPostAvatar(post: Content): string {
  const userId = post.userId;

  // 1. Si on a l'URL (même potentiellement erronée) en cache, on la renvoie
  if (this.userAvatars[userId]) {
    return this.userAvatars[userId];
  }

  // 2. Si on est déjà en train de charger le profil
  if (this.loadingProfiles.has(userId)) {
    // On retourne une image transparente ou vide pour ne pas déclencher d'erreur prématurée
    return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  }

  // 3. Lancement du chargement
  this.loadingProfiles.add(userId);
  this.ProfileService.getProfileById(userId).subscribe({
    next: (profile) => {
      // On stocke l'URL brute. Si profile.avatar est invalide ou null, 
      // la balise <img> déclenchera naturellement (error)
      this.userAvatars[userId] = profile?.avatar || ''; 
      this.loadingProfiles.delete(userId);
    },
    error: (err) => {
      console.error('Profil introuvable pour:', userId);
      this.userAvatars[userId] = 'broken-link'; // Forcera le déclenchement de (error)
      this.loadingProfiles.delete(userId);
    }
  });

  return ''; // Vide pendant le chargement initial
}

// Ajoutez cette propriété à votre classe
currentChallenge: { [postId: string]: Challenge | null } = {};

// Récupère les informations d'un challenge spécifique
private getCurrentChallenge(post: Content): void {
  if (!post.challengeId || this.currentChallenge[post.challengeId] !== undefined) return;

  // Marquer le chargement en cours
  this.currentChallenge[post.challengeId] = null;

  this.challengeService.getChallengeById(post.challengeId).pipe(
    takeUntil(this.destroy$)
  ).subscribe({
    next: (challenge) => {
      this.currentChallenge[post.challengeId || ''] = challenge?.is_active ? challenge : null;
      this.cdr.markForCheck(); // Forcer la mise à jour de la vue
    },
    error: (error) => {
      console.error('Erreur lors du chargement du challenge:', error);
      this.currentChallenge[post.challengeId || ''] = null;
      this.cdr.markForCheck(); // Forcer la mise à jour de la vue en cas d'erreur
    }
  });
}



hasActiveChallenge(post: Content): boolean {
  if (!post.challengeId) return false;
  
  const challenge = this.currentChallenge[post.challengeId];
  // Si le challenge n'est pas encore chargé, on le charge
  if (challenge === undefined) {
    this.getCurrentChallenge(post);
    return false;
  }
  
  return !!challenge && challenge.is_active === true;
}

// Add this method to your HomePage class
getMediaUrl(relativePath: string): string {
  return getMediaUrl(relativePath);
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
  
  playVideo() {
    console.log('Play video');
  }

  /**
   * Prépare les boutons d'action dynamiquement pour chaque post
   */
  getActionsForPost(post: Content) {
  // Déterminer l'icône du like en fonction de l'état actuel
  const likeIcon = post.isLikedByUser ? 'heart' : 'heart-outline';
  const likeColor = post.isLikedByUser ? 'danger' : 'medium';
  
  return [
    { 
      icon: likeIcon,
      color: likeColor,
      count: post.likeCount, 
      action: () => this.likePost(post) 
    },
    { 
      icon: 'chatbubble-ellipses-outline', 
      count: post.commentCount, 
      action: () => this.openComments(post) 
    },
    { 
      icon: 'bookmark-outline', 
      action: () => this.savePost(post) 
    },
    { 
      icon: 'share-outline', 
      action: () => this.sharePost(post) 
    }
  ];
}

  onPostVisible(index: number) {
    this.currentIndex = index;
  }

  // Méthodes d'interactions
// Propriété pour suivre les likes en cours
isLiking: { [postId: string]: boolean } = {};

async likePost(post: Content) {
  // Vérifier si l'utilisateur est connecté
  if (!this.currentUserProfile?.id) {
    console.log('Veuillez vous connecter pour aimer cette publication');
    // Vous pourriez ajouter une notification ou une redirection vers la page de connexion
    return;
  }

  const userId = this.currentUserProfile.id;
  const postId = post.id;

  // Vérifier si un like est déjà en cours pour ce post
  if (this.isLiking[postId!]) return;
  this.isLiking[postId!] = true;

  // Sauvegarder l'état précédent pour le rollback en cas d'erreur
  const wasLiked = post.isLikedByUser || false;
  const previousLikeCount = post.likeCount;

  // Mise à jour optimiste de l'interface
  post.isLikedByUser = !wasLiked;
  post.likeCount = wasLiked ? Math.max(0, post.likeCount - 1) : post.likeCount + 1;

  try {
    // Appeler le service approprié en fonction de l'action
    if (wasLiked) {
      await this.creationService.unlikeContent(postId!, userId).toPromise();
    } else {
      await this.creationService.likeContent(postId!, userId).toPromise();
    }

    // Mettre à jour l'état local après un succès
    if (!post.likedIds) {
      post.likedIds = [];
    }
    if (wasLiked) {
      post.likedIds = post.likedIds.filter(id => id !== userId);
    } else {
      post.likedIds = [...(post.likedIds || []), userId];
    }

  } catch (error) {
    console.error('Erreur lors de la mise à jour du like:', error);
    
    // Annuler les changements en cas d'erreur
    post.isLikedByUser = wasLiked;
    post.likeCount = previousLikeCount;
    post.likedIds = wasLiked 
      ? [...(post.likedIds || []), userId]
      : post.likedIds?.filter(id => id !== userId) || [];
    
    // Afficher un message d'erreur à l'utilisateur
    // Par exemple: this.toastService.show('Impossible de mettre à jour le like');
  } finally {
    // Réinitialiser l'état de chargement
    this.isLiking[postId!] = false;
  }
}

  async openComments(post: Content) {
  if (!this.currentUserProfile) {
    this.router.navigate(['/login']);
    return;
  }

  this.router.navigate(['/content-comments', post.id], {
    state: { 
      currentUser: this.currentUserProfile 
    }
  });
}
  savePost(post: Content) { console.log('Sauvegarder:', post.id); }
  async sharePost(post: Content) {
  try {
    const shareData = {
      title: post.title || 'Découvrez ce contenu',
      text: post.description || 'Regardez ce contenu intéressant',
      url: post.fileUrl
    };

    // Vérifier si l'API Web Share est disponible
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      // Solution de secours pour les navigateurs qui ne supportent pas l'API Web Share
      await this.copyToClipboard(shareData.url);
      // Afficher un toast ou une alerte
      const toast = await this.toastController.create({
        message: 'Lien copié dans le presse-papier',
        duration: 2000,
        position: 'bottom'
      });
      await toast.present();
    }
  } catch (error) {
    console.error('Erreur lors du partage:', error);
    // Gérer l'erreur (par exemple, si l'utilisateur annule le partage)
  }
}

// Méthode utilitaire pour copier du texte dans le presse-papier
private async copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error('Erreur lors de la copie dans le presse-papier:', err);
    // Fallback pour les anciens navigateurs
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Fallback copy method failed:', err);
    }
    document.body.removeChild(textArea);
  }
}

async voteForArtist(post: any) {
    const modal = await this.modalController.create({
  component: CouponModalComponent,
  cssClass: 'vote-modal',
  breakpoints: [0, 0.7, 0.85], // Points d'arrêt réajustés
  initialBreakpoint: 0.85, // Plus grand par défaut
  backdropDismiss: true,
  componentProps: {
    artistName: post.username || 'Utilisateur',
    artistAvatar: this.userAvatars[post.userId] || 'assets/avatar-default.png',
    challengeName: this.currentChallenge[post.challengeId]?.name || 'Challenge',
    postId: post.id,
    usageRule: this.currentChallenge[post.challengeId]?.vote_rule 
  }
});

    await modal.present();

    // Gérer le résultat du vote
    const { data } = await modal.onWillDismiss();
    
    if (data && data.voted) {
      console.log('Vote confirmé:', data);
      // Ici vous pouvez:
      // 1. Envoyer le vote à votre backend
      // 2. Mettre à jour l'UI (compteur de votes, etc.)
      // 3. Afficher un toast de confirmation
      // 4. Retirer le coupon utilisé de la liste
      
      // Exemple de toast:
      // await this.showVoteConfirmationToast(data.voteValue);
    }
  }

  // Méthode optionnelle pour afficher un toast de confirmation
  async showVoteConfirmationToast(voteValue: number) {
    const toast = await this.toastController.create({
      message: `✅ Votre vote de ${voteValue} point${voteValue > 1 ? 's' : ''} a été comptabilisé !`,
      duration: 3000,
      position: 'bottom',
      color: 'success',
      cssClass: 'custom-toast'
    });
    await toast.present();
  }


isFollowingUser: { [key: string]: boolean } = {};

async subscribeTo(profileId: string) {
  if (!this.currentUserProfile?.id) return;

  const wasFollowing = this.isFollowingUser[profileId];
  // Mise à jour optimiste de l'UI
  this.isFollowingUser[profileId] = !wasFollowing;
  this.cdr.detectChanges();

  try {
    if (wasFollowing) {
      await this.ProfileService.unfollowProfile(this.currentUserProfile.id, profileId);
      console.log('Unfollow réussi');
    } else {
      await this.ProfileService.followProfile(this.currentUserProfile.id, profileId);
      console.log('Follow réussi');
    }

    // Mettre à jour le compteur de followers
    if (this.currentUserProfile.stats) {
      this.currentUserProfile.stats.fans = wasFollowing 
        ? Math.max(0, (this.currentUserProfile.stats.fans || 1) - 1)
        : (this.currentUserProfile.stats.fans || 0) + 1;
    }

  } catch (error) {
    console.error('Erreur lors de la mise à jour du suivi:', error);
    // Annuler le changement en cas d'erreur
    this.isFollowingUser[profileId] = wasFollowing;
    this.cdr.detectChanges();

    // Afficher un message d'erreur
    const toast = await this.toastController.create({
      message: 'Erreur lors de la mise à jour du suivi',
      duration: 3000,
      position: 'bottom',
      color: 'danger'
    });
    await toast.present();
  }
}


  

 

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Charge le challenge actif avec le plus grand nombre de participants
   */
  
}