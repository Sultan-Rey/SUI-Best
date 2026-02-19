// discovery-view.component.ts
import { Component, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { UserProfile } from 'src/models/User';
import { CreationService } from 'src/services/CREATION_SERVICE/creation-service';
import { ModalController, ToastController } from '@ionic/angular';
import { map, filter, switchMap, forkJoin, of, take } from 'rxjs';
import { ProfileService } from 'src/services/PROFILE_SERVICE/profile-service';
import { assignDiscoveryLayout } from 'src/app/utils/discovery-layout.utils';
import { MediaUrlPipe } from 'src/app/utils/pipes/mediaUrlPipe/media-url-pipe';
import { FollowedViewComponent } from '../view-followed/followed-view.component';
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
    private modalController: ModalController,
    private toastController: ToastController){}

  ngOnInit(): void {
    this.loadContent();
    this.loadTopArtists();
  }

  loadContent(){
    this.creationService.getDiscoveryFeedContents(this.currentUserProfile).pipe(
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
      map((contentsWithProfiles) => 
        contentsWithProfiles.map(({ content, profile }) => ({
          id: content.id || '',
          title: content.description || 'Contenu sans titre',
          thumbnail: content.thumbnailUrl || content.fileUrl || '',
          type: (content.mimeType?.includes('video') ? 'video' : 
                content.mimeType?.includes('audio') ? 'audio' : 'image') as 'video' | 'audio' | 'image',
          size: ['lg', 'md', 'sm'][Math.floor(Math.random() * 3)] as 'lg' | 'md' | 'sm',
          category: content.tags || ['general'],
          trending: Math.random() > 0.7,
          likes: content.voteCount?.toString() || '0',
          comments: content.commentCount?.toString() || '0',
          views: content.viewCount?.toString() || '0',
          timeAgo: this.formatTimeAgo(content.createdAt),
          author: {
            name: profile?.username || content.username || `User ${content.userId.slice(-4)}`,
            avatar: profile?.avatar || 'https://picsum.photos/seed/' + content.userId + '/100/100.jpg'
          },
          saved: false
        }))
      )
    ).subscribe((discoveryItems) => {
      this.allItems = assignDiscoveryLayout(discoveryItems);
      this.cdr.markForCheck();
    });
  }

  loadTopArtists(){
    this.profile.getTopArtists().subscribe((artists) => {
      // Transform creators into story objects
      const creatorStories: Story[] = artists.map(creator => ({
        name: creator.displayName || creator.username || `User ${creator.id.slice(-4)}`,
        avatar: creator.avatar || `https://picsum.photos/seed/${creator.id}/100/100.jpg`,
        isLive: false// Randomly set some as live for demo
      }));
      
      // Update stories with top creators (limit to first 7 for display)
      this.stories = creatorStories.slice(0, 9);
      this.cdr.markForCheck();
    });
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
      
      // Retirer l'état de chargement
      item.loading = false;
      
      if (!content) {
        console.error('Content not found for item:', item.id);
        // Afficher un message d'erreur à l'utilisateur
        this.showErrorToast('Contenu non trouvé');
        return;
      }

      const modal = await this.modalController.create({
        component: FollowedViewComponent,
        componentProps: {
          currentUserProfile: this.currentUserProfile,
          posts: [content],
          challengeName: '-'
        },
        cssClass: 'followed-view-modal',
        handle: true
      });
  
      await modal.present();
    } catch (error) {
      console.error('Error opening item:', error);
      // Retirer l'état de chargement en cas d'erreur
      item.loading = false;
      // Afficher un message d'erreur à l'utilisateur
      this.showErrorToast('Erreur lors du chargement du contenu');
    }
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

  saveItem(event: Event, item: DiscoveryItem): void {
    event.stopPropagation();
    item.saved = !item.saved;
  }
}