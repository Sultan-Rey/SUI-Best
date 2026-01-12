import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { NgFor, NgIf, SlicePipe, DatePipe } from '@angular/common';
import { FilterPipe } from '../utils/pipes/filter-pipe';
import { ToastController } from '@ionic/angular';
import { 
  IonHeader, 
  IonToolbar, 
  IonIcon, 
  IonButton, 
  IonContent,
  IonInfiniteScroll, IonInfiniteScrollContent, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  search, 
  notificationsOutline, 
  play, 
  giftOutline, 
  heartOutline,
  bookmarkOutline,
  chatbubbleEllipsesOutline, 
  starOutline, 
  shareOutline, chevronUp, chevronDown, trophyOutline } from 'ionicons/icons';
import { Content } from 'src/models/Content';
import { CreationService } from 'src/services/CREATION/creation-service';
import { ProfileService } from 'src/services/PROFILE_SERVICE/profile-service';
import { getMediaUrl} from 'src/app/utils/media.utils';
import { Challenge } from 'src/models/Challenge';
import { Auth } from 'src/services/AUTH/auth';
import { UserProfile } from 'src/models/User';
import { Router } from '@angular/router';


@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [DatePipe,IonRefresherContent, IonRefresher, FilterPipe, IonInfiniteScrollContent, IonInfiniteScroll, NgFor, NgIf, SlicePipe, IonHeader, IonToolbar, IonIcon, IonButton, IonContent]
})

export class HomePage implements OnInit {
  @ViewChild(IonContent) content!: IonContent;
  
  posts: Content[] = [];
  currentIndex = 0;
  currentPage = 1;
  isLoading = false;
  currentUserProfile: UserProfile = {} as UserProfile;
  get currentPost(): any {
    if (this.posts.length > 0) {
      return this.posts[this.currentIndex];
    }
    return this.posts = [];
  }

  
  constructor(private toastController:ToastController, private router: Router, private creationService: CreationService, private ProfileService: ProfileService, private authService: Auth)
 {
  this.currentUserProfile.stats = {} as {
      posts: 0;
      fans: 0;
      votes: 0;
      stars: 0;
    };
    
    addIcons({search,notificationsOutline,heartOutline, bookmarkOutline, trophyOutline,play,chevronUp,chevronDown,'giftOutline':giftOutline,'chatbubbleEllipsesOutline':chatbubbleEllipsesOutline,'starOutline':starOutline,'shareOutline':shareOutline});
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
  async ngOnInit() {
    const userId = await this.authService.getCurrentUser();
  if (userId) {
    this.ProfileService.getProfileById(userId.id as string || '').subscribe(profile => {
      this.currentUserProfile = profile;
    });
  }
    this.loadFeed();
    // S'abonner aux nouveaux contenus
  this.creationService.newContent$.subscribe(newContent => {
    if (newContent) {
      // Vérifier si le contenu n'existe pas déjà
      const exists = this.posts.some(p => p.id === newContent.id);
      if (!exists) {
        this.posts.unshift(newContent); // Ajouter au début de la liste
      }
    }
  });
  }


  
  handleAction(action: any) { action.action(); }


  /**
   * Charge les contenus depuis le service
   */
loadFeed(event?: any) {
  if (this.isLoading) return;
  this.isLoading = true;

  this.creationService.getFeedContents(this.currentPage, 10).subscribe({
    next: (newPosts) => {
      // Marquer les posts aimés par l'utilisateur actuel
      const updatedPosts = newPosts.map(post => ({
        ...post,
        // Vérifier si l'utilisateur actuel a aimé ce post
        isLikedByUser: this.currentUserProfile?.id 
          ? post.likedIds?.includes(this.currentUserProfile.id) || false
          : false
      }));

      // Si c'est le premier chargement (page 1), on remplace les posts existants
      if (this.currentPage === 1) {
        this.posts = updatedPosts;
      } else {
        // Sinon on ajoute à la suite (pour l'Infinite Scroll)
        this.posts = [...this.posts, ...updatedPosts];
      }
      
      // Charge les challenges pour les nouveaux posts
      updatedPosts.forEach((post: Content) => this.getCurrentChallenge(post));
      
      this.currentPage++;
      this.isLoading = false;
      
      // Si c'est un appel via l'Infinite Scroll
      if (event) {
        event.target.complete();
        // Désactiver le scroll infini s'il n'y a plus de contenu
        if (newPosts.length < 10) {
          event.target.disabled = true;
        }
      }
    },
    error: (err) => {
      console.error('Erreur de chargement du feed', err);
      this.isLoading = false;
      if (event) event.target.complete();
    }
  });
}

// Pour forcer un rechargement complet
refreshFeed(event: any) {
  this.currentPage = 1;
  this.loadFeed(event);
}
 

 userAvatars: { [userId: string]: string } = {};
private loadingProfiles = new Set<string>();

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

// Modifiez la méthode getCurrentChallenge
getCurrentChallenge(post: Content): void {
  if (!post.challengeId) return;

  this.creationService.getChallengeById(post.challengeId).subscribe({
    next: (challenge) => {
      if (challenge?.is_active) {
        this.currentChallenge[post.challengeId || ''] = challenge;
      } else {
        this.currentChallenge[post.challengeId || ''] = null;
      }
    },
    error: (error) => {
      console.error('Erreur lors du chargement du challenge:', error);
      this.currentChallenge[post.challengeId || ''] = null;
    }
  });
}

hasActiveChallenge(post: Content): boolean {
  const challenge = this.currentChallenge[post.challengeId || ''];
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

  voteForArtist(post: Content) { console.log('Vote pour user:', post.userId); }

  // Dans home.page.ts
isFollowingUser: { [key: string]: boolean } = {};

subscribeTo(profileId: string) {
  if (!this.currentUserProfile?.id) return;

  // Optimistic UI update
  const wasFollowing = this.isFollowingUser[profileId];
  this.isFollowingUser[profileId] = !wasFollowing;

  const subscription = wasFollowing
    ? this.ProfileService.unfollowProfile(this.currentUserProfile.id, profileId)
    : this.ProfileService.followProfile(this.currentUserProfile.id, profileId);

  subscription.subscribe({
    next: () => {
      // Mise à jour du compteur de followers côté client si nécessaire
      if (this.currentUserProfile.stats) {
        if (wasFollowing) {
          this.currentUserProfile.stats.fans = Math.max(0, (this.currentUserProfile.stats.fans || 1) - 1);
        } else {
          this.currentUserProfile.stats.fans = (this.currentUserProfile.stats.fans || 0) + 1;
        }
      }
    },
    error: (error) => {
      console.error('Erreur lors de la mise à jour de l\'abonnement:', error);
      // Annuler le changement en cas d'erreur
      this.isFollowingUser[profileId] = wasFollowing;
      
      // Afficher un message d'erreur à l'utilisateur
      // Vous pouvez utiliser un service de notification ou une alerte
      // Par exemple: this.toastService.show('Erreur lors de la mise à jour de l\'abonnement');
    }
  });
}
 



}