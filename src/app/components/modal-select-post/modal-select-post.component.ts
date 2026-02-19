import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MediaUrlPipe } from '../../utils/pipes/mediaUrlPipe/media-url-pipe';
import { ShortNumberPipe } from '../../utils/pipes/shortNumberPipe/short-number-pipe.js';
import { Content } from 'src/models/Content.js';
import { UserProfile } from 'src/models/User.js';
import { CreationService } from 'src/services/CREATION_SERVICE/creation-service.js';
import { addIcons } from 'ionicons';
import { eye, close, checkmark, play, image } from 'ionicons/icons';

@Component({
  selector: 'app-modal-select-post',
  templateUrl: './modal-select-post.component.html',
  styleUrls: ['./modal-select-post.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, ShortNumberPipe, MediaUrlPipe]
})
export class ModalSelectPostComponent implements OnInit {
  @Input() currentUserProfile!: UserProfile;
  @Output() postSelected = new EventEmitter<Content>();

  userPosts: Content[] = [];
  isLoading = false;
  selectedPost: Content | null = null;
  searchTerm = '';
  filteredPosts: Content[] = [];

  constructor(
    private modalController: ModalController,
    private creationService: CreationService
  ) {
    addIcons({
      eye,
      'close': close,
      'checkmark': checkmark,
      'play': play,
      'image': image
    });
  }

  ngOnInit() {
    this.loadUserPosts();
  }

  loadUserPosts() {
    if (!this.currentUserProfile?.id) {
      console.error('UserProfile ou ID manquant');
      return;
    }

    this.isLoading = true;
    this.creationService.getUserContents(this.currentUserProfile.id).subscribe({
      next: (posts) => {
        this.userPosts = posts;
        this.filteredPosts = posts;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des posts:', error);
        this.userPosts = [];
        this.filteredPosts = [];
        this.isLoading = false;
      }
    });
  }

  filterPosts() {
    if (!this.searchTerm.trim()) {
      this.filteredPosts = this.userPosts;
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredPosts = this.userPosts.filter(post => 
        post.description?.toLowerCase().includes(term) ||
        post.tags?.some(tag => tag.toLowerCase().includes(term))
      );
    }
  }

  selectPost(post: Content) {
    this.selectedPost = post;
  }

  confirmSelection() {
    if (this.selectedPost) {
      this.postSelected.emit(this.selectedPost);
      this.modalController.dismiss({
        selected: true,
        post: this.selectedPost
      });
    }
  }

  dismiss() {
    this.modalController.dismiss({
      selected: false
    });
  }


  isVideo(content: Content): boolean {
    return content.mimeType.startsWith('video/');
  }

  onImageError(event: any) {
    const imgElement = event.target as HTMLImageElement;
    imgElement.onerror = null;
    imgElement.src = 'assets/placeholder-image.png';
  }

  trackByPostId(index: number, post: Content): string {
    return post.id || index.toString();
  }
}
