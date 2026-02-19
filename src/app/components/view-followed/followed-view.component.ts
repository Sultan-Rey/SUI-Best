import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, ChangeDetectionStrategy, Input, Output, EventEmitter, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FilterPipe } from '../../utils/pipes/filterPipe/filter-pipe';
import { ShortNumberPipe } from '../../utils/pipes/shortNumberPipe/short-number-pipe.js';
import { MediaUrlPipe } from '../../utils/pipes/mediaUrlPipe/media-url-pipe';
import { ToastController, ModalController } from '@ionic/angular';
import { 
  IonChip,
  IonIcon, 
  IonButton, 
  IonContent,
  IonInfiniteScroll, IonInfiniteScrollContent, IonRefresher, IonRefresherContent, IonSkeletonText, IonInput } from '@ionic/angular/standalone';
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
import { Challenge } from 'src/models/Challenge.js';
import { Auth } from 'src/services/AUTH/auth.js';
import { UserProfile } from 'src/models/User.js';
import { Router } from '@angular/router';
import { CommentService } from 'src/services/COMMENTS_SERVICE/comment-service.js';
import { catchError, filter, map, Observable, of, Subject, switchMap, takeUntil, tap, finalize, count, take } from 'rxjs';
import { ChallengeService } from 'src/services/CHALLENGE_SERVICE/challenge-service.js';
import { CouponModalComponent } from '../modal-exchange-coupon/coupon-modal.component.js';
import { GiftModalComponent } from '../modal-gift/gift-modal.component.js';
import { VoteService } from 'src/services/VOTE_SERVICE/vote-service.js';

@Component({
  selector: 'app-followed-view',
  templateUrl: './followed-view.component.html',
  styleUrls: ['./followed-view.component.scss'],
  standalone: true,
  providers: [ModalController],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonInput, DatePipe, IonRefresherContent, IonRefresher, ShortNumberPipe, MediaUrlPipe, IonInfiniteScrollContent,
    IonInfiniteScroll, NgFor, NgIf, IonIcon, IonButton, IonChip, FormsModule]
})
export class FollowedViewComponent implements OnInit, OnChanges, OnDestroy {
  //#region Component Configuration
  @ViewChild(IonContent) content!: IonContent;
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
  private currentPostIndex: number = 0;
  private intersectionObserver?: IntersectionObserver;
  //#endregion

  //#region Public Properties
  needsRefresh = false;
  currentIndex = 0;
  currentPage = 1;
  isLoading = false;
  userAvatars: { [userId: string]: string } = {};
  userVerified: { [userId: string]: boolean } = {};
  isFollowingUser: { [key: string]: boolean } = {};
  buttonAction: { [key: string]: string } = {};
  currentChallenge: { [challengeId: string]: Challenge } = {};
  
  // Comment functionality
  newComment: string = '';
  showEmojiPicker: boolean = false;
  emojis: string[] = ['❤️', '🔥', '😂', '😍', '👏', '🎉', '😢', '😡', '👍', '👎', '🔥', '💯', '✨', '🌟', '💪', '🙏', '😊', '😎', '🤔', '👀'];
  
  // Button actions
  isGifted: { [postId: string]: boolean } = {};
  //#endregion

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
    private voteService: VoteService
  ) {
    //this.initializeUserProfile();
    this.setupIcons();
    this.setupCommentSubscription();
  }
  //#endregion

  //#region Lifecycle Hooks
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
     this.setupIntersectionObserver();
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
    this.cleanup();
  }
  //#endregion

  //#region Initialization Methods
  private initializeUserProfile() {
    this.currentUserProfile.stats = {
      posts: 0,
      fans: 0,
      votes: 0,
      stars: 0
    } as {
      posts: number;
      fans: number;
      votes: number;
      stars: number;
    };
    this.currentUserProfile.myFollows = [];
  }

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

  private setupIntersectionObserver() {
    if (typeof IntersectionObserver !== 'undefined') {
      //console.log('Setting up Intersection Observer');
      this.intersectionObserver = new IntersectionObserver((entries) => {
        //console.log('Intersection Observer entries:', entries);
        entries.forEach(entry => {
          //console.log('Entry:', entry.isIntersecting, entry.target);
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement;
            const contentId = element.getAttribute('data-content-id');
            //console.log('Content ID from attribute:', contentId);
            if (contentId) {
              const post = this.posts.find(p => p.id === contentId);
              //console.log('Found post:', post);
              if (post) {
                //console.log('Calling onViewChange for post:', post.id);
                this.onViewChange(post);
              }
            }
          }
        });
      }, {
        threshold: 0.5,
        rootMargin: '0px'
      });
    } else {
      console.error('IntersectionObserver is not supported');
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

      return {
        ...post,
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

  //#region User Actions & Modal Management
  async dismiss() {
    if (this.challengeName) {
      await this.modalController.dismiss();
    }
  }

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

  async voteForArtist(post: any) {
    const modal = await this.modalController.create({
      component: CouponModalComponent,
      cssClass: 'vote-modal',
      breakpoints: [0, 0.7, 0.85],
      initialBreakpoint: 0.85,
      backdropDismiss: true,
      componentProps: {
        artistName: post.username || 'Utilisateur',
        artistAvatar: this.userAvatars[post.userId] || 'assets/avatar-default.png',
        challengeName: this.currentChallenge[post.challengeId]?.name || 'Challenge',
        postId: post.id,
        userId: this.currentUserProfile?.id,
        challengeId: post.challengeId,
        usageRule: this.currentChallenge[post.challengeId]?.vote_rule 
      }
    });

    await modal.present();
    const { data } = await modal.onWillDismiss();
    
    if (data && data.success) {
      this.showToast('Vote enregistré!', 'success');
    }
  }

  showAccount(userId:string){
    this.router.navigate(['/profile', userId]);
    this.modalController.dismiss({
      animation: {
        leaveAnimation: 'modal-slide-out'
      }
    });
  }

  async giftPost(post: Content) {
    const modal = await this.modalController.create({
      component: GiftModalComponent,
      componentProps: { post },
      cssClass: 'auto-height',
      initialBreakpoint: 0.5,
      breakpoints: [0, 0.5, 1],
      handle: true
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data?.gift) {
      if (this.isGifted[post.id!]) return;
      this.isGifted[post.id!] = true;
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

  async sharePost(post: Content) {
    try {
      const shareData = {
      
        text: post.description || 'Regardez ce contenu intéressant',
        url: post.fileUrl
      };

      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await this.copyToClipboard(shareData.url);
        const toast = await this.toastController.create({
          message: 'Lien copié dans le presse-papier',
          duration: 2000,
          position: 'bottom'
        });
        await toast.present();
      }
    } catch (error) {
      console.error('Erreur lors du partage:', error);
    }
  }

  private async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Erreur lors de la copie dans le presse-papier:', err);
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
  //#endregion

  //#region Comment System
  toggleEmojiPicker() {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  addEmoji(emoji: string) {
    this.newComment += emoji;
    this.showEmojiPicker = false;
    this.cdr.markForCheck();
  }

  onCommentFocus() {
    this.showEmojiPicker = false;
  }

  async postComment() {
    if (!this.newComment?.trim() || !this.currentUserProfile?.id) return;
    
    const currentPost = this.posts[this.currentIndex];
    if (!currentPost) return;

    try {
      await this.commentService.addComment({
        contentId: currentPost.id!,
        userId: this.currentUserProfile.id,
        username: this.currentUserProfile.username || 'Utilisateur',
        text: this.newComment.trim()
      }).toPromise();
      
      this.newComment = '';
      this.showEmojiPicker = false;
      currentPost.commentCount = (currentPost.commentCount || 0) + 1;
      this.cdr.markForCheck();
      
      const toast = await this.toastController.create({
        message: 'Commentaire ajouté!',
        duration: 2000,
        color: 'success'
      });
      await toast.present();
    } catch (error) {
      console.error('Erreur lors de l\'ajout du commentaire:', error);
      const toast = await this.toastController.create({
        message: 'Erreur lors de l\'ajout du commentaire',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
  }
  //#endregion

  //#region View Tracking
  onViewChange(content: Content) {
    if (!content?.id) return;
    
    //console.log('onViewChange called for content:', content.id);
    //console.log('Already viewed:', this.viewedContent.has(content.id));
    
    this.clearViewTimer(content.id);
    
    if (!this.viewedContent.has(content.id)) {
      //console.log('Starting 30-second timer for content:', content.id);
      this.viewTimers[content.id] = setTimeout(() => {
        this.incrementContentView(content);
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

  private incrementContentView(content: Content) {
   
    if (!content?.id || this.viewedContent.has(content.id)) return;
     
    // Calculer le nouveau viewCount
    const currentViewCount = content.viewCount || 0;
    const newViewCount = currentViewCount + 1;
     
    this.creationService.incrementViewCount(content.id!, newViewCount).subscribe({
      next: (updatedContent) => {
        this.viewedContent.add(updatedContent.id!);
        content.viewCount = updatedContent.viewCount;
        this.clearViewTimer(updatedContent.id!);
        this.cdr.markForCheck();
        //console.log(`Vue comptée pour le contenu ${updatedContent.id}`);
      },
      error: (error) => {
        console.error('Erreur lors de la mise à jour des vues:', error);
        this.clearViewTimer(content.id!);
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

  hasActiveChallenge(post: Content): boolean {
    return !!(post.challengeId && this.currentChallenge[post.challengeId]);
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

  getActionsForPost(post: Content) {
    const voteIcon = post.isVotedByUser ? '../assets/icon/checked.gif' : '../assets/icon/like.gif';
    const giftColor = post.isGiftedByUser ? 'danger' : '';
    let actionButtons = [];
    
    if(this.hasActiveChallenge(post)){
      actionButtons.push({ 
        icon: 'thumbs-up', 
        count: post.voteCount,
        gifIcon: voteIcon,
        action: () => this.voteForArtist(post) 
      },
      { 
        icon: 'gift', 
        count: post.giftCount,
        color: giftColor,
        action: () => this.giftPost(post) 
      });
    }
    
    actionButtons.push(
      { 
        icon: 'chatbubble', 
        count: post.commentCount, 
        action: () => this.openComments(post) 
      },
      { 
        icon: 'share', 
        count: post.shareCount,
        action: () => this.sharePost(post) 
      });

    return actionButtons;
  }

  getButtonImage(post: Content, action: any): string {
    if (action.icon === 'thumbs-up') {
      const buttonKey = `${post.id}-thumbs-up`;
      return this.buttonAction[buttonKey] || action.gifIcon;
    }
    return action.gifIcon;
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

  private async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color
    });
    await toast.present();
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
}
