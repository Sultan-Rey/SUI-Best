import { Component } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { 
  IonHeader, 
  IonToolbar, 
  IonIcon, 
  IonButton, 
  IonContent 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  search, 
  notificationsOutline, 
  play, 
  giftOutline, 
  chatbubbleEllipsesOutline, 
  starOutline, 
  shareOutline 
} from 'ionicons/icons';

interface TikTokPost {
  id: number;
  artistName: string;
  artistAvatar: string;
  location: string;
  videoThumbnail: string;
  likes: number;
  comments: number;
  saves: number;
}

interface ActionButton {
  icon: string;
  count?: number;
  action: () => void;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [NgFor,NgIf,IonHeader, IonToolbar, IonIcon, IonButton, IonContent]
})
export class HomePage {
  currentPost: TikTokPost = {
    id: 1,
    artistName: 'loading...',
    artistAvatar: 'https://randomuser.me/api/portraits/men/1.jpg',
    location: 'Ville, Pays',
    videoThumbnail: 'https://picsum.photos/1080/1920',
    likes: 1234,
    comments: 56,
    saves: 89
  };

  actions: ActionButton[] = [
    { icon: 'gift-outline', count: this.currentPost.likes, action: () => this.likePost() },
    { icon: 'chatbubble-ellipses-outline', count: this.currentPost.comments, action: () => this.openComments() },
    { icon: 'star-outline', count: this.currentPost.saves, action: () => this.savePost() },
    { icon: 'share-outline', action: () => this.sharePost() }
  ];

  constructor() {
    addIcons({ 
      search, 
      'notifications-outline': notificationsOutline,
      play,
      'gift-outline': giftOutline,
      'chatbubble-ellipses-outline': chatbubbleEllipsesOutline,
      'star-outline': starOutline,
      'share-outline': shareOutline
    });
  }

  handleAction(action: ActionButton) {
    action.action();
  }

  playVideo() {
    console.log('Play video');
  }

  likePost() {
    console.log('Like post');
    this.currentPost.likes++;
  }

  openComments() {
    console.log('Open comments');
  }

  savePost() {
    console.log('Save post');
    this.currentPost.saves++;
  }

  sharePost() {
    console.log('Share post');
  }

  voteForArtist() {
    console.log('Vote for artist');
  }
}