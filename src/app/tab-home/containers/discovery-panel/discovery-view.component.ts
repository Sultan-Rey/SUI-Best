// discovery-view.component.ts
import { Component, Input, OnInit, ChangeDetectorRef, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { UserProfile } from 'src/models/User';
import { CreationService } from 'src/services/Service_content/creation-service';
import { ModalController, ToastController } from '@ionic/angular';
import { map, filter, switchMap, forkJoin, of, take, finalize, catchError } from 'rxjs';
import { ProfileService } from 'src/services/Service_profile/profile-service';
import { assignDiscoveryLayout } from 'src/app/utils/discovery-layout.utils';
import { MediaUrlPipe } from 'src/app/utils/pipes/mediaUrlPipe/media-url-pipe';
import { FollowedViewComponent } from '../followed-panel/followed-view.component';
import { Router } from '@angular/router';
import { CommentService } from 'src/services/service_comment/comment-service';
import { Segment } from 'src/models/Segment';
export interface DiscoveryAuthor {
  name: string;
  avatar: string;
}

export interface DiscoveryItem {
  id: string;
  title: string;
  thumbnail: string;
  type: 'video' | 'audio' | 'image';
  size: 'lg' | 'md' | 'sm';
  category: string[];
  trending: boolean;
  likes: string;
  comments: string;
  views: string;
  timeAgo: string;
  author: DiscoveryAuthor;
  saved: boolean;
  loading?: boolean;
}

export interface Category {
  id: string;
  label: string;
  icon: string;
}

export interface Story {
  id:string;
  name: string;
  avatar: string;
  isLive: boolean;
}

@Component({
  selector: 'app-discovery-view',
  templateUrl: './discovery-view.component.html',
  styleUrls: ['./discovery-view.component.scss'],
  standalone: true,
  providers: [ModalController],
  imports: [CommonModule, FormsModule, IonicModule, MediaUrlPipe],
})
export class DiscoveryViewComponent implements OnInit {
  @Input() currentUserProfile!:UserProfile;
  searchOpen = false;
  searchQuery = '';
  activeCategory = 'all';

  // États de chargement
  isLoading = true;
  loadingContent = true;
  loadingStories = true;

  // Output pour naviguer vers followed
  @Output() navigateToTab = new EventEmitter<{
    args: any[];
    targetSegment: Segment;
    targetReturn: Segment;
  }>();

  categories: Category[] = [
    { id: 'all',      label: 'Tout',        icon: '✦' },
    { id: 'travel',   label: 'Voyage',      icon: '✈' },
    { id: 'food',     label: 'Gastronomie', icon: '◈' },
    { id: 'tech',     label: 'Tech',        icon: '⬡' },
    { id: 'art',      label: 'Art',         icon: '◉' },
    { id: 'music',    label: 'Musique',     icon: '♪' },
    { id: 'sport',    label: 'Sport',       icon: '◎' },
  ];

  stories: Story[] =[];

  allItems: DiscoveryItem[] = []

  get filteredItems(): DiscoveryItem[] {
    const result = this.allItems.filter(item => {
      // Si activeCategory est 'all', tout est accepté
      if (this.activeCategory === 'all') {
        return true;
      }
      
      // Vérifier si item.category existe et est un tableau
      if (!item.category) {
        console.log('Item sans catégorie:', item);
        return false;
      }
      
      // Si category est un tableau, vérifier l'inclusion
      if (Array.isArray(item.category)) {
        return item.category.includes(this.activeCategory);
      }
      
      // Si category est une chaîne, vérifier l'égalité
      if (typeof item.category === 'string') {
        return item.category === this.activeCategory;
      }
      
      return false;
    });
       return result;
  }

  constructor(private creationService: CreationService, 
    private profile: ProfileService, 
    private cdr: ChangeDetectorRef ,
    private router: Router,
    private commentService: CommentService,
    private modalController: ModalController,
    private toastController: ToastController){}

  ngOnInit(): void {
    this.loadContent();
    this.loadTopArtists();
  }

  loadContent(){
    this.loadingContent = true;
    this.creationService.getDiscoveryFeedContents(this.currentUserProfile).pipe(
      finalize(() => {
        this.loadingContent = false;
        this.updateGlobalLoadingState();
        this.cdr.markForCheck();
      }),
      catchError(error => {
        console.error('Erreur lors du chargement du contenu discovery:', error);
        this.loadingContent = false;
        this.updateGlobalLoadingState();
        this.cdr.markForCheck();
        return of([]); // Retourner un tableau vide en cas d'erreur
      }),
      switchMap((filteredContents) => {
        // Créer les requêtes de profil pour chaque contenu filtré
        const profileRequests = filteredContents.map(content => 
          this.profile.getProfileById(content.userId).pipe(
            map(profile => ({
              content,
              profile
            }))
          )
        );
        
        // Attendre toutes les réponses des profils
        return forkJoin(profileRequests);
      }),
      switchMap((contentsWithProfiles) => {
        // Créer les requêtes de commentaires pour chaque contenu
        const commentRequests = contentsWithProfiles.map(({ content, profile }) => 
          this.commentService.getCommentCount(content.id as string).pipe(
            map(commentCount => ({
              content,
              profile,
              commentCount
            }))
          )
        );
        
        // Attendre tous les comptes de commentaires
        return forkJoin(commentRequests);
      }),
      map((contentsWithProfilesAndComments) => 
        contentsWithProfilesAndComments.map(({ content, profile, commentCount }) => ({
          id: content.id || '',
          title: content.description || 'Contenu sans titre',
          thumbnail: content.thumbnailUrl || content.fileUrl || '',
          type: (content.mimeType?.includes('video') ? 'video' : 
                content.mimeType?.includes('audio') ? 'audio' : 'image') as 'video' | 'audio' | 'image',
          size: ['lg', 'md', 'sm'][Math.floor(Math.random() * 3)] as 'lg' | 'md' | 'sm',
          category: content.tags || ['general'],
          trending: Math.random() > 0.7,
          likes: content.voteCount?.toString() || '0',
          comments: commentCount.toString(),
          views: content.viewCount?.toString() || '0',
          timeAgo: this.formatTimeAgo(content.created_at),
          author: {
            name: profile?.username || content.username || `User ${content.userId.slice(-4)}`,
            avatar: profile?.avatar || 'https://picsum.photos/seed/' + content.userId + '/100/100.jpg'
          },
          saved: false,
          loading: false // ← Initialiser l'état de chargement individuel
        }))
      )
    ).subscribe((discoveryItems) => {
      this.allItems = assignDiscoveryLayout(discoveryItems);
      this.cdr.markForCheck();
    });
  }

  loadTopArtists(){
    this.loadingStories = true;
    this.profile.getTopArtists().pipe(
      finalize(() => {
        this.loadingStories = false;
        this.updateGlobalLoadingState();
        this.cdr.markForCheck();
      }),
      catchError(error => {
        console.error('Erreur lors du chargement des top artists:', error);
        this.loadingStories = false;
        this.updateGlobalLoadingState();
        this.cdr.markForCheck();
        return of([]); // Retourner un tableau vide en cas d'erreur
      })
    ).subscribe((artists) => {
      // Transform creators into story objects
      const creatorStories: Story[] = artists.map(creator => ({
        id: creator.id,
        name: creator.displayName || creator.username || `User ${creator.id.slice(-4)}`,
        avatar: creator.avatar || `https://picsum.photos/seed/${creator.id}/100/100.jpg`,
        isLive: false// Randomly set some as live for demo
      }));
      
      // Update stories with top creators (limit to first 7 for display)
      this.stories = creatorStories.slice(0, 9);
      this.cdr.markForCheck();
    });
  }

  // Mettre à jour l'état de chargement global
  private updateGlobalLoadingState(): void {
    this.isLoading = this.loadingContent || this.loadingStories;
  }

  onImageAvatarError(event: any) {
      const imgElement = event.target as HTMLImageElement;
      imgElement.onerror = null;
      imgElement.src = 'assets/avatar-default.png';
      imgElement.classList.add('is-default');
    }

  formatTimeAgo(dateString?: string): string {
    if (!dateString) return 'il y a quelques instants';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
    } else {
      return 'il y a quelques minutes';
    }
  }

  toggleSearch(): void {
    this.searchOpen = !this.searchOpen;
    if (!this.searchOpen) this.searchQuery = '';
  }

  setCategory(id: string): void {
    this.activeCategory = id;
  }

  async openItem(item: DiscoveryItem): Promise<void> {
    try {
      // Ajouter un état de chargement
      item.loading = true;
       
      const content = await this.creationService.getContentById(item.id).pipe(
        take(1)
      ).toPromise();
      
      // Émettre l'événement vers le parent avec tous les contents complets réordonnés
      // Récupérer tous les contents complets
      const contentPromises = this.allItems.map(item => 
        this.creationService.getContentById(item.id).pipe(take(1)).toPromise()
      );
      
      const allContents = await Promise.all(contentPromises);
      
      // Retirer l'état de chargement
      item.loading = false;
      
      // Filtrer les contents null/undefined et réordonner avec le contenu choisi en premier
      const validContents = allContents.filter(content => content !== null && content !== undefined);
      const contentIndex = validContents.findIndex(item => item.id === content?.id);
      
      let reorderedContents = [...validContents];
      if (contentIndex > 0) {
        // Déplacer le contenu choisi au début
        const [selectedItem] = reorderedContents.splice(contentIndex, 1);
        reorderedContents = [selectedItem, ...reorderedContents];
      }

      this.navigateToTab.emit({
        args: reorderedContents, // Tableau de Content complets réordonnés
        targetSegment: 'followed',
        targetReturn: "discovery" as const
      });
      
    } catch (error) {
      console.error('Error opening item:', error);
      // Retirer l'état de chargement en cas d'erreur
      item.loading = false;
      // Afficher un message d'erreur à l'utilisateur
      this.showErrorToast('Erreur lors du chargement du contenu');
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
  private async showErrorToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color: 'danger',
      position: 'bottom'
    });
    await toast.present();
  }

  getCategoryLabel(categoryId: string): string {
    const category = this.categories.find(c => c.id === categoryId);
    return category?.label || categoryId;
  }

  saveItem(event: Event, item: DiscoveryItem): void {
    event.stopPropagation();
    item.saved = !item.saved;
  }
}