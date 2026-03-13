import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponentComponent } from '../components/header-component/header-component.component';
import {
  IonContent,
  IonIcon,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  searchOutline,
  eyeOutline,
  timeOutline,
  lockClosedOutline,
  play,
  starOutline,
  videocamOutline,
  imagesOutline,
} from 'ionicons/icons';

// ─── Models ───────────────────────────────────────────────────────────────────

export interface Author {
  name: string;
  initials: string;
  color: string; // CSS gradient string
}

export interface ExclusiveContent {
  id: string;
  title: string;
  author: Author;
  views: string;
  duration?: string;
  thumbnail?: string;
  locked: boolean;
  price?: number;
  isLive?: boolean;
  type: 'video' | 'behind' | 'masterclass';
}

export interface FilterTab {
  id: string;
  label: string;
  icon?: string;
  prefix?: string;
}

// ─── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_FEATURED: ExclusiveContent[] = [
  {
    id: 'f1',
    title: 'Masterclass: Techniques de Sculpture Moderne',
    author: { name: 'Sophie Martin', initials: 'SM', color: 'linear-gradient(135deg,#EF4444,#B91C1C)' },
    views: '2.3k',
    duration: '45:30',
    locked: true,
    price: 15,
    type: 'masterclass',
  },
  {
    id: 'f2',
    title: 'Dans l\'Atelier de Laurent Beaumont',
    author: { name: 'Laurent B.', initials: 'LB', color: 'linear-gradient(135deg,#14B8A6,#0F766E)' },
    views: '4.1k',
    duration: '28:15',
    thumbnail: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&q=70',
    locked: false,
    type: 'behind',
  },
  {
    id: 'f3',
    title: 'Aquarelle: Paysages Lumineux',
    author: { name: 'Chloé Renard', initials: 'CR', color: 'linear-gradient(135deg,#EC4899,#9D174D)' },
    views: '1.8k',
    duration: '22:45',
    locked: true,
    price: 9,
    type: 'video',
  },
];

const MOCK_ALL: ExclusiveContent[] = [
  {
    id: 'a1',
    title: 'Session Live: Peinture en Direct',
    author: { name: 'Thomas Bernard', initials: 'TB', color: 'linear-gradient(135deg,#FF8C00,#E05000)' },
    views: '0.9k',
    thumbnail: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=70',
    locked: false,
    isLive: true,
    type: 'video',
  },
  {
    id: 'a2',
    title: 'Exploration du Mixed Media',
    author: { name: 'Julie Moreau', initials: 'JM', color: 'linear-gradient(135deg,#8B5CF6,#5B21B6)' },
    views: '1.6k',
    duration: '38:20',
    locked: true,
    price: 15,
    type: 'video',
  },
  {
    id: 'a3',
    title: 'Perspective & Profondeur – Cours Complet',
    author: { name: 'Arnaud Dubois', initials: 'AD', color: 'linear-gradient(135deg,#14B8A6,#0F766E)' },
    views: '3.2k',
    duration: '1:12:00',
    locked: true,
    price: 20,
    type: 'masterclass',
  },
];

// ─── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-exclusive',
  templateUrl: 'exclusive.page.html',
  styleUrls: ['exclusive.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonIcon, HeaderComponentComponent],
})
export class ExclusivePage {

  searchQuery = '';
  activeFilter = 'all';

  filterTabs: FilterTab[] = [
    { id: 'all',        label: 'Tout',      prefix: '✦' },
    { id: 'video',      label: 'Vidéos',    icon: 'videocam-outline' },
    { id: 'behind',     label: 'Coulisses', icon: 'images-outline' },
    { id: 'masterclass',label: 'Masterclass',icon: 'star-outline' },
  ];

  featuredItems: ExclusiveContent[] = MOCK_FEATURED;
  allContents:   ExclusiveContent[] = MOCK_ALL;

  constructor(private toastCtrl: ToastController) {
    addIcons({
      searchOutline,
      eyeOutline,
      timeOutline,
      lockClosedOutline,
      play,
      starOutline,
      videocamOutline,
      imagesOutline,
    });
  }

  // ── Filter ──────────────────────────────────────────────────────────────────

  setFilter(filterId: string): void {
    this.activeFilter = filterId;
    const source = [...MOCK_FEATURED];

    this.featuredItems = filterId === 'all'
      ? source
      : source.filter(i => i.type === filterId);

    const sourceAll = [...MOCK_ALL];
    this.allContents = filterId === 'all'
      ? sourceAll
      : sourceAll.filter(i => i.type === filterId);
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  onSubscribe(): void {
    this.showToast('Redirection vers l\'abonnement Premium…');
  }

  onContentTap(item: ExclusiveContent): void {
    if (item.locked) {
      this.showToast(`Acheter pour déverrouiller : ${item.title}`);
    } else {
      this.showToast(`Lecture : ${item.title}`);
    }
  }

  onBuy(item: ExclusiveContent, event: Event): void {
    event.stopPropagation();
    this.showToast(`Achat en cours : ${item.title} — ${item.price}€`);
  }

  onWatch(item: ExclusiveContent, event: Event): void {
    event.stopPropagation();
    this.showToast(`Lecture : ${item.title}`);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'bottom',
      cssClass: 'ex-toast',
    });
    await toast.present();
  }
}