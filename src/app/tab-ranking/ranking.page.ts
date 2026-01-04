import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { starOutline, cash, search } from 'ionicons/icons';
import { 
  IonContent, 
  IonHeader, 
  IonToolbar, 
  IonButton,
  IonIcon,
  IonCard,
  IonCardContent
} from '@ionic/angular/standalone';

interface Artist {
  id: number;
  name: string;
  category: string;
  votes: number;
  imageUrl: string;
  rank?: number;
  isFavorite?: boolean;
}

@Component({
  selector: 'app-ranking',
  templateUrl: './ranking.page.html',
  styleUrls: ['./ranking.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonContent,
    IonButton,
    IonIcon,
    IonCard,
    IonCardContent  ]
})
export class RankingPage implements OnInit {
  selectedTab: 'votes' | 'dons' = 'votes';
  
  topArtists: Artist[] = [
    {
      id: 1,
      name: 'Sophie Martin',
      category: 'Sculpture',
      votes: 15420,
      imageUrl: 'https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?w=300&h=400&fit=crop',
      rank: 1
    },
    {
      id: 2,
      name: 'Jean Dubois',
      category: 'Peinture',
      votes: 12350,
      imageUrl: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=300&h=400&fit=crop',
      rank: 2
    },
    {
      id: 3,
      name: 'Marie Leclerc',
      category: 'Photographie',
      votes: 10890,
      imageUrl: 'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=300&h=400&fit=crop',
      rank: 3
    },
    {
      id: 4,
      name: 'Pierre Laurent',
      category: 'Design',
      votes: 9560,
      imageUrl: 'https://images.unsplash.com/photo-1536924940846-227afb31e2a5?w=300&h=400&fit=crop',
      rank: 4
    },
    {
      id: 5,
      name: 'Claire Bonnet',
      category: 'Illustration',
      votes: 8720,
      imageUrl: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=300&h=400&fit=crop',
      rank: 5
    },
    {
      id: 6,
      name: 'Thomas Roux',
      category: 'Art Numérique',
      votes: 7890,
      imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=400&fit=crop',
      rank: 6
    }
  ];

  allArtists: Artist[] = [
    ...this.topArtists,
    {
      id: 7,
      name: 'Emma Lefebvre',
      category: 'Céramique',
      votes: 6540,
      imageUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=100&h=100&fit=crop',
      isFavorite: true
    },
    {
      id: 8,
      name: 'Lucas Moreau',
      category: 'Street Art',
      votes: 5890,
      imageUrl: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=100&h=100&fit=crop',
      isFavorite: false
    }
  ];

  constructor() {addIcons({ starOutline, cash, search });}

  ngOnInit() {}

  selectTab(tab: 'votes' | 'dons') {
    this.selectedTab = tab;
  }

  formatVotes(votes: number): string {
    return votes.toLocaleString('fr-FR');
  }

  toggleFavorite(artist: Artist) {
    artist.isFavorite = !artist.isFavorite;
  }
}