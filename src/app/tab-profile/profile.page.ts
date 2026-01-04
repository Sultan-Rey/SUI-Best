import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { 
  shareSocialOutline, 
  ellipsisVertical, 
  addCircle, 
  checkmarkCircle, 
  locationOutline, 
  linkOutline, 
  calendarOutline, 
  openOutline,
  heart,
  trophyOutline,
  globeOutline,
  lockClosedOutline
} from 'ionicons/icons';
import { 
  IonContent, 
  IonHeader,
  IonToolbar, 
  IonButtons, 
  IonButton, 
  IonIcon, 
  IonBackButton
}  from '@ionic/angular/standalone';
import { ActivatedRoute } from '@angular/router';
import { ActionSheetController } from '@ionic/angular';

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  isVerified: boolean;
  isFollowing: boolean;
  bio: string;
  location: string;
  website: string;
  memberSince: string;
  stats: {
    posts: number;
    fans: number;
    votes: number;
    stars: number;
  };
}

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
  imports: [IonContent, IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonBackButton,  CommonModule, FormsModule] 
})
export class ProfilePage implements OnInit {

  selectedTab: 'posts' | 'success' | 'info' = 'posts';
  
  userProfile: UserProfile = {
    id: '1',
    username: '@sophiemartin',
    displayName: 'Sophie Martin',
    avatar: 'assets/avatars/sophie-martin.jpg',
    isVerified: true,
    isFollowing: false,
    bio: 'Sculptrice passionnée 🔥 | Créatrice d\'art contemporain',
    location: 'Paris, France',
    website: 'sophiemartin.art.com',
    memberSince: 'Janvier 2023',
    stats: {
      posts: 156,
      fans: 15400,
      votes: 12800,
      stars: 342
    }
  };

  userPosts: Post[] = [
    {
      id: 1,
      imageUrl: 'assets/posts/post1.jpg',
      title: 'Paysage de montagne',
      votes: 1250,
      category: 'Peinture'
    },
    {
      id: 2,
      imageUrl: 'assets/posts/post2.jpg',
      title: 'Sculpture moderne',
      votes: 980,
      category: 'Sculpture'
    },
    {
      id: 3,
      imageUrl: 'assets/posts/post3.jpg',
      title: 'Art abstrait',
      votes: 1560,
      category: 'Art contemporain'
    },
    {
      id: 4,
      imageUrl: 'assets/posts/post4.jpg',
      title: 'Portrait',
      votes: 2100,
      category: 'Portrait'
    }
  ];

  successPosts: Post[] = [];
  
  constructor(
    private route: ActivatedRoute,
    private actionSheetController: ActionSheetController
  ) {addIcons({
    'share-social-outline': shareSocialOutline,
    'ellipsis-vertical': ellipsisVertical,
    'add-circle': addCircle,
    'checkmark-circle': checkmarkCircle,
    'location-outline': locationOutline,
    'link-outline': linkOutline,
    'calendar-outline': calendarOutline,
    'open-outline': openOutline,
    'heart': heart,
    'trophy-outline': trophyOutline,
    'globe-outline': globeOutline,
    'lock-closed-outline': lockClosedOutline
  });}

  ngOnInit() {
    
    // Load user profile data
    const userId = this.route.snapshot.paramMap.get('id');
    if (userId) {
      this.loadUserProfile(userId);
    }
  }

  loadUserProfile(userId: string) {
    // API call to load user profile
    console.log('Loading profile for user:', userId);
  }

  selectTab(tab: 'posts' | 'success' | 'info') {
    this.selectedTab = tab;
  }

  async toggleFollow() {
    this.userProfile.isFollowing = !this.userProfile.isFollowing;
    
    if (this.userProfile.isFollowing) {
      this.userProfile.stats.fans++;
    } else {
      this.userProfile.stats.fans--;
    }
  }

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

  openPost(post: Post) {
    console.log('Opening post:', post.id);
  }

  formatNumber(num: number): string {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

}
