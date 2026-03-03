import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, ChangeDetectionStrategy, Input, Output, EventEmitter, OnDestroy, OnChanges, SimpleChanges, ViewChildren, QueryList } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShortNumberPipe } from '../../../utils/pipes/shortNumberPipe/short-number-pipe.js';
import { MediaUrlPipe } from '../../../utils/pipes/mediaUrlPipe/media-url-pipe';
import { ToastController, ModalController } from '@ionic/angular';
import { 
  IonChip,
  IonIcon, 
  IonButton, 
  IonContent,
  IonInfiniteScroll, IonInfiniteScrollContent, IonRefresher, IonRefresherContent, IonSkeletonText, IonInput, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  play, 
  gift, 
  heart,
  people,
  trophy,
  star,
  chatbubble,
  chevronBack,
  thumbsUp,
  bookmark,
  chatbubbleEllipses,  
  share, chevronUp, chevronDown, trophyOutline, peopleOutline, timeOutline, playCircle, add, checkmarkCircle, close, happyOutline, send, compass } from 'ionicons/icons';
import { Content } from 'src/models/Content.js';
import { CreationService } from 'src/services/CREATION_SERVICE/creation-service.js';
import { ProfileService } from 'src/services/PROFILE_SERVICE/profile-service.js';
import { Challenge } from 'src/models/Challenge';
import { UserProfile } from 'src/models/User';
import { Router } from '@angular/router';
import { CommentService } from 'src/services/COMMENTS_SERVICE/comment-service.js';
import { catchError, filter, map, Observable, of, Subject, switchMap, takeUntil, tap, finalize, count, take } from 'rxjs';
import { ChallengeService } from 'src/services/CHALLENGE_SERVICE/challenge-service.js';
import { SideActionsComponent } from './components/side-actions/side-actions.component';
import { QuickCommentComponent } from './components/quick-comment/quick-comment.component.js';
@Component({
  selector: 'app-followed-view',
  templateUrl: './followed-view.component.html',
  styleUrls: ['./followed-view.component.scss'],
  standalone: true,
  providers: [ModalController],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonSpinner, IonContent, DatePipe, IonRefresherContent, IonRefresher, ShortNumberPipe, MediaUrlPipe, IonInfiniteScrollContent,
    IonInfiniteScroll, NgFor, NgIf, IonIcon, IonButton, IonChip, FormsModule, SideActionsComponent, QuickCommentComponent]
})
export class FollowedViewComponent implements OnInit, OnChanges, OnDestroy {
  //#region Component Configuration
  @ViewChild(IonContent) content!: IonContent;
  @ViewChild('postsContainer') postsContainer!: ElementRef<HTMLDivElement>;
  @ViewChildren('postEl') postElements!: QueryList<ElementRef<HTMLDivElement>>;
  @ViewChildren(SideActionsComponent) sideActionsComponents!: QueryList<SideActionsComponent>;
  @Input() currentUserProfile: UserProfile = {} as UserProfile;
  @Input() posts: Content[] = [];
  @Input() challengeName: string = "";
  @Output() refreshComplete = new EventEmitter<void>();
  //#endregion

  //#region Private Properties
  private destroy$ = new Subject<void>();
  private readonly PAGE_SIZE = 5;
  private loadingProfiles = new Set<string>();
  private viewTimers: { [contentId: string]: any } = {};
  private viewedContent: Set<string> = new Set();
  private intersectionObserver?: IntersectionObserver;
   private scrollTimeout: any;
private snapRevealTimeout: any;
private lastIndex = -1;
  //#endregion

  //#region Public Properties
  needsRefresh = false;
  currentIndex = 0;
  isMuted = true;
  scrollingUiHidden = false;
  uiHidden: { [postId: string]: boolean } = {};
  loadingVideos: { [postId: string]: boolean } = {};
  currentPage = 1;
  isLoading = false;
  userAvatars: { [userId: string]: string } = {};
  userVerified: { [userId: string]: boolean } = {};
  isFollowingUser: { [key: string]: boolean } = {};
  currentChallenge: { [challengeId: string]: Challenge } = {};
  
 
  commentCount!:number;

  //#region Constructor
  constructor(
    private cdr: ChangeDetectorRef, 
    private toastController: ToastController, 
    private modalController: ModalController,
    private router: Router, 
    private creationService: CreationService, 
    private challengeService: ChallengeService,
    private commentService: CommentService,
    private profileService: ProfileService,
  ) {
    //this.initializeUserProfile();
    this.setupIcons();
    this.setupCommentSubscription();
  }
  //#endregion

  //#region Lifecycle Hooks
  ngAfterViewInit() {
    // Petit délai pour laisser Ionic finir son rendu
    setTimeout(() => this.initIntersectionObserver(), 300);
    // Observer les nouveaux posts ajoutés (infinite scroll)
    this.postElements.changes.subscribe(() => {
      this.observeAllPosts();
    });
  }

  async ngOnInit() {
    
    if (this.posts && this.posts.length > 0) {
      await this.processExternalPosts();
    } else {
      // Ne charger le contenu que si currentUserProfile est valide
      if (this.currentUserProfile && this.currentUserProfile.id) {
        //console.log('currentUserProfile dans ngOnInit:', this.currentUserProfile);
        this.setupNewContentSubscription();
        this.loadInitialFeed().subscribe();
      }
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    // Détecter quand currentUserProfile est mis à jour
    if (changes['currentUserProfile'] && changes['currentUserProfile'].currentValue) {
      const newProfile = changes['currentUserProfile'].currentValue;
     // console.log('currentUserProfile mis à jour dans ngOnChanges:', newProfile);
      
      // Si le profil a un ID valide et qu'on n'a pas encore initialisé le contenu
      if (newProfile.id && !this.posts.length) {
       // console.log('Initialisation du contenu après mise à jour du profil');
        this.setupNewContentSubscription();
        this.loadInitialFeed().subscribe();
      }
    }
  }

 ngOnDestroy() {
    this.intersectionObserver?.disconnect();
  clearTimeout(this.snapRevealTimeout);
  // Retirer le listener scroll
  this.postsContainer?.nativeElement
    .removeEventListener('scroll', this.onScroll);
    this.cleanup();
  }
  //#endregion

  //#region Initialization Methods


  private setupIcons() {
    addIcons({
      close, checkmarkCircle, chevronBack, happyOutline, send, peopleOutline, thumbsUp, timeOutline,
      playCircle, heart, people, add, trophy, star, chatbubble, bookmark, trophyOutline,
      play, chevronUp, chevronDown, gift, chatbubbleEllipses, share
    });
  }

  private setupCommentSubscription() {
    this.commentService.commentAdded$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(({contentId, increment}) => {
      const post = this.posts.find(p => p.id === contentId);
      if (post) {
        post.commentCount = (post.commentCount || 0) + increment;
        this.posts = [...this.posts];
      }
    });
  }

  onPostTap(postId: string) {
  this.uiHidden[postId] = !this.uiHidden[postId];
  this.cdr.markForCheck(); // ✅ Ajouter
}

    // -------------------------------------------------------
  // ✅ Crée l'observer — se déclenche quand un post est 
  //    visible à 70% → lecture / pause automatique
  // -------------------------------------------------------
  private initIntersectionObserver() {
  this.intersectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        const postEl = entry.target as HTMLElement;
        const index = parseInt(postEl.getAttribute('data-index') || '0', 10);
        const video = postEl.querySelector('video') as HTMLVideoElement | null;

        if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
          
          // ✅ Nouveau post visible
          if (this.lastIndex !== index) {
            this.lastIndex = index;
            this.currentIndex = index;

            // ✅ Reset le tap-hide du post précédent
            const prevPostId = this.posts[index > 0 ? index - 1 : 0]?.id;
            if (prevPostId) this.uiHidden[prevPostId] = false;

            // ✅ UI cachée pendant le scroll → réapparaît avec animation
            this.triggerSnapReveal(postEl);
          }

          if (video) this.playVideo(video, this.posts[index]?.id as string);

        } else {
          if (video) {
            video.pause();
            video.currentTime = 0;
          }
        }
      });
    },
    {
      root: this.postsContainer.nativeElement,
      threshold: 0.7
    }
  );

  // ✅ Cacher l'UI pendant le scroll
  this.postsContainer.nativeElement.addEventListener('scroll', () => {
    this.onScroll();
  }, { passive: true });

  this.observeAllPosts();
}

// -------------------------------------------------------
// ✅ Pendant le scroll → UI disparaît
// -------------------------------------------------------
private onScroll() {
  this.scrollingUiHidden = true;
  clearTimeout(this.snapRevealTimeout);
  this.cdr.markForCheck(); // ✅ Indispensable avec OnPush
}

// -------------------------------------------------------
// ✅ Au snap → UI réapparaît avec animation
// -------------------------------------------------------
private triggerSnapReveal(postEl: HTMLElement) {
  clearTimeout(this.snapRevealTimeout);

  this.snapRevealTimeout = setTimeout(() => {
    this.scrollingUiHidden = false;
    this.cdr.markForCheck(); // ✅ Indispensable avec OnPush

    const ui = postEl.querySelector('.post-ui') as HTMLElement;
    if (ui) {
      ui.classList.remove('snap-reveal');
      void ui.offsetWidth;
      ui.classList.add('snap-reveal');
      setTimeout(() => ui.classList.remove('snap-reveal'), 350);
    }
  }, 50);
}


  // -------------------------------------------------------
  // ✅ Observe tous les éléments .post actuels
  // -------------------------------------------------------
  private observeAllPosts() {
    // Déconnecter les anciens
    this.intersectionObserver?.disconnect();

    this.postElements.forEach(ref => {
      this.intersectionObserver?.observe(ref.nativeElement);
    });
  }

  // -------------------------------------------------------
  // ✅ Lecture vidéo avec gestion du son et du loading
  // -------------------------------------------------------
  private async playVideo(video: HTMLVideoElement, postId: string) {
    video.muted = this.isMuted;

    // Afficher le spinner si la vidéo n'est pas prête
    if (video.readyState < 3) {
      this.loadingVideos[postId] = true;
      await new Promise<void>(resolve => {
        video.oncanplay = () => resolve();
      });
      this.loadingVideos[postId] = false;
    }

    try {
      await video.play();
    } catch (err) {
      // Autoplay bloqué par le navigateur → silencieux
      console.warn('Autoplay bloqué:', err);
    }
  }

  // -------------------------------------------------------
  // ✅ Toggle mute global sur toutes les vidéos
  // -------------------------------------------------------
  toggleMute(event: Event) {
    event.stopPropagation();
    this.isMuted = !this.isMuted;

    // Appliquer à la vidéo actuellement visible
    const currentPost = this.postElements.get(this.currentIndex);
    if (currentPost) {
      const video = currentPost.nativeElement.querySelector('video') as HTMLVideoElement;
      if (video) video.muted = this.isMuted;
    }
  }

  //#endregion



 

  private async processExternalPosts(): Promise<void> {
    // Mode modal : afficher directement les posts fournis en input sans filtrage
    const validPosts = this.posts.filter(post => {
      if (!post || !post.id || !post.userId) {
        console.warn('Post invalide ignoré:', post);
        return false;
      }
      return true;
    });
    
    //console.log('processExternalPosts - posts en input:', validPosts.length);
    
    await this.processNewPosts(validPosts);
    
    setTimeout(() => {
      this.observePostElements();
    }, 100);
  }

  private observePostElements() {
    if (!this.intersectionObserver) {
      console.error('IntersectionObserver is not initialized');
      return;
    }
    
    // Unobserve all existing elements first to prevent duplicates
    this.intersectionObserver.disconnect();
    
    // Attendre que le DOM soit prêt
    setTimeout(() => {
      const postElements = document.querySelectorAll('.post[data-content-id]');
      //console.log('Found post elements:', postElements.length);
      
      postElements.forEach((element, index) => {
        const contentId = element.getAttribute('data-content-id');
        //console.log(`Observing element ${index}:`, contentId);
        this.intersectionObserver!.observe(element);
      });
    }, 500); // Augmenter le délai pour s'assurer que le DOM est prêt
  }

  trackByPostId(index: number, post: Content): string {
    return post.id || index.toString();
  }

  private setupNewContentSubscription(): void {
    this.creationService.newContent$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(newContent => {
      if (newContent && this.currentUserProfile?.id && !this.challengeName) {
        const exists = this.posts.some(p => p.id === newContent.id);
        if (!exists) {
          this.posts = [newContent, ...this.posts];
          this.loadAvatarForPost(newContent);
          this.cdr.markForCheck();
        }
      }
    });
  }

  private async processNewPosts(newPosts: Content[]): Promise<void> {
    
    const postsWithUser = await Promise.all(newPosts.map(async post => {
      let username = 'Utilisateur';
      
      if (post.userId) {
        try {
          const userProfile = await this.profileService.getProfileById(post.userId).toPromise();
          if (userProfile?.username) {
            username = userProfile.username;
          }
        } catch (error) {
          console.warn(`Impossible de charger le profil pour l'utilisateur ${post.userId}:`, error);
        }
      }

      if (post.challengeId && this.currentChallenge[post.challengeId] === undefined) {
        this.getCurrentChallenge(post);
      }
      const commentCount = await this.commentService.getCommentCount(post.id as string).toPromise() || 0;
      
      return {
        ...post,
        commentCount: commentCount,
        username: username,
        isVotedByUser: this.currentUserProfile?.id 
          ? post.votersList?.some(vote => 
              vote.userId === this.currentUserProfile.id && 
              vote.challengeId === post.challengeId
            ) || false
          : false,
        isLikedByUser: this.currentUserProfile?.id 
          ? post.likedIds?.includes(this.currentUserProfile.id) || false
          : false,
        isGiftedByUser: this.currentUserProfile?.id 
          ? post.giftIds?.includes(this.currentUserProfile.id) || false
          : false
      } as Content & { username: string, isLikedByUser: boolean, isGiftedByUser: boolean, isVotedByUser: boolean };
    }));

    if (this.currentPage === 1) {
      this.posts = postsWithUser;
          } else {
      this.posts = [...this.posts, ...postsWithUser];
       }

    postsWithUser.forEach(post => {
      this.loadAvatarForPost(post);
    });
    
    this.cdr.markForCheck();
     
    // Observer les éléments après la mise à jour du DOM
    setTimeout(() => {
      this.observePostElements();
    }, 100);
  }
  //#endregion

  //#region Content Loading
  private loadInitialFeed(): Observable<void> {
    this.isLoading = true;
    this.currentPage = 1;
    return this.creationService.getFollowedFeedContents(this.currentUserProfile, this.currentPage, this.PAGE_SIZE).pipe(
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

  private loadAvatarForPost(post: Content): void {
    if (!post || !post.userId) {
      console.warn('loadAvatarForPost: post ou userId invalide', post);
      return;
    }
    
    if (!this.userAvatars[post.userId] && !this.loadingProfiles.has(post.userId)) {
      this.loadingProfiles.add(post.userId);
      
      this.profileService.getProfileById(post.userId).pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loadingProfiles.delete(post.userId))
      ).subscribe({
        next: (profile) => {
          if (profile?.avatar) {
            this.userAvatars[post.userId] = profile.avatar;
          }
          if (profile?.isVerified !== undefined) {
            this.userVerified[post.userId] = profile.isVerified;
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.userAvatars[post.userId] = 'assets/avatar-default.png';
          this.userVerified[post.userId] = false;
          this.cdr.markForCheck();
        }
      });
    }
  }

  async loadFeed(event?: any) {
    if (this.isLoading) return;
    this.isLoading = true;
    console.log("Launched");
    try {
      const newPosts = await this.creationService.getFollowedFeedContents(this.currentUserProfile, this.currentPage, this.PAGE_SIZE).toPromise();
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

  async refreshFeed(event: any) {
    if (this.challengeName) {
      await this.processExternalPosts();
      if (event) event.target.complete();
    } else {
      // Mode feed normal : réinitialiser seulement si pas en mode modal
      this.currentPage = 1;
      this.userAvatars = {};
      this.userVerified = {};
      this.posts = []; // Réinitialiser seulement en mode normal
      this.loadFeed(event);
    }
  }
  //#endregion

  
  //#region View Tracking
  onViewChange(content: Content) {
    if (!content?.id) return;
    this.clearViewTimer(content.id);
    if (!this.viewedContent.has(content.id)) {
       this.viewTimers[content.id] = setTimeout(() => {
        const currentViewCount = content.viewCount || 0;
        this.incrementContentView(content.id!, currentViewCount + 1);
      }, 30000);
    }
  }

  // Méthode de test pour déclencher manuellement le suivi
  testViewTracking(post: Content) {
    //console.log('Manual test - triggering view tracking for:', post.id);
    this.onViewChange(post);
  }

  private clearViewTimer(contentId: string) {
    if (this.viewTimers[contentId]) {
      clearTimeout(this.viewTimers[contentId]);
      delete this.viewTimers[contentId];
    }
  }

  private incrementContentView(contentId: string, viewCount: number) {
   
    if (!contentId || this.viewedContent.has(contentId)) return;
     
    this.creationService.incrementViewCount(contentId, viewCount).subscribe({
      next: (updatedContent) => {
        this.viewedContent.add(updatedContent.id!);
        this.clearViewTimer(updatedContent.id!);
        this.cdr.markForCheck();
        //console.log(`Vue comptée pour le contenu ${updatedContent.id}`);
      },
      error: (error) => {
        console.error('Erreur lors de la mise à jour des vues:', error);
        this.clearViewTimer(contentId);
      }
    });
  }
  //#endregion

  //#region Challenge Management
  private getCurrentChallenge(post: Content) {
    if (!post.challengeId) return;
    
    this.challengeService.getChallengeById(post.challengeId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (challenge) => {
        if (challenge) {
          this.currentChallenge[post.challengeId!] = challenge;
          this.cdr.markForCheck();
        }
      },
      error: (error) => {
        console.error('Erreur lors du chargement du challenge:', error);
      }
    });
  }

  async dismiss() {
        if (this.challengeName) {
          await this.modalController.dismiss();
        }
      }

  //#endregion

  //#region Utility Methods
  getPostAvatar(post: Content): string {
    const userId = post.userId;

    if (this.userAvatars[userId]) {
      return this.userAvatars[userId];
    }

    if (this.loadingProfiles.has(userId)) {
      return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    }

    this.loadingProfiles.add(userId);
    this.profileService.getProfileById(userId).subscribe({
      next: (profile) => {
        this.userAvatars[userId] = profile?.avatar || ''; 
        this.loadingProfiles.delete(userId);
      },
      error: (err) => {
        console.error('Profil introuvable pour:', userId);
        this.userAvatars[userId] = 'broken-link';
        this.loadingProfiles.delete(userId);
      }
    });

    return this.userAvatars[userId] || 'assets/avatar-default.png';
  }

  onCommentAdded(count: number){
    this.commentCount = count;
    // Forcer la détection de changement pour mettre à jour tous les SideActionsComponents
    this.cdr.markForCheck();
  }
  
showAccount(userId:string){
        this.router.navigate(['/profile', userId]);
        this.modalController.dismiss({
          animation: {
            leaveAnimation: 'modal-slide-out'
          }
        });
      }
 hasActiveChallenge(post: Content): boolean {
    return !!(post.challengeId && this.currentChallenge[post.challengeId]);
  }

  onImageAvatarError(event: any) {
    const imgElement = event.target as HTMLImageElement;
    imgElement.onerror = null;
    imgElement.src = 'assets/avatar-default.png';
    imgElement.classList.add('is-default');
  }

  onImageContentError(event: any) {
    const imgElement = event.target as HTMLImageElement;
    imgElement.onerror = null;
    imgElement.src = 'assets/splash.png';
    imgElement.classList.add('is-default');
  }

 

  // Méthode pour déterminer si le contenu est une vidéo
  isVideo(post: Content): boolean {
    if (!post.fileUrl) return false;
    const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv'];
    return videoExtensions.some(ext => post.fileUrl!.toLowerCase().includes(ext));
  }

  // Méthode pour obtenir la classe de cadrage en fonction du cadrage du contenu
  getCadrageClass(post: Content): string {
    return post.cadrage === 'fit' ? 'fit-to-screen' : '';
  }

  private cleanup() {
    Object.keys(this.viewTimers).forEach(contentId => {
      this.clearViewTimer(contentId);
    });
    
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    
    this.destroy$.next();
    this.destroy$.complete();
  }
  //#endregion

  async subscribeTo(profileIdTofollow: string) {
        if (!profileIdTofollow || !this.currentUserProfile?.id) return;
        
        try {
          const result = await this.profileService.followProfile(this.currentUserProfile.id, profileIdTofollow);
          
          // Mettre à jour le currentUserProfile avec les nouvelles données
          if (result?.user) {
            this.currentUserProfile = result.user;
            
            // Forcer la détection de changement
            this.cdr.markForCheck();
          }
          
          const toast = await this.toastController.create({
            message: 'Bravo vous suivez une nouvelle personne!',
            duration: 2000,
            color: 'dark'
          });
          await toast.present();
          
        } catch (error) {
          console.error('Erreur lors de l\'abonnement:', error);
        }
      }
}
