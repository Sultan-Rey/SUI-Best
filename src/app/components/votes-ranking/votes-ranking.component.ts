import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { trophy, trophyOutline, arrowForward } from 'ionicons/icons';
import { Artist } from 'src/models/User';
import { ChallengeRanking } from '../../../models/Challenge';

import { 
  IonButton,
  IonIcon,
  IonSpinner
} from '@ionic/angular/standalone';
import { getMediaUrl } from 'src/app/utils/media.utils';

@Component({
  selector: 'app-votes-ranking',
  templateUrl: './votes-ranking.component.html',
  styleUrls: ['./votes-ranking.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonIcon,
    IonButton
  ]
})
export class VotesRankingComponent implements OnInit {
  @Input() isLoading: boolean = false;
  @Input() challengeRankings: (ChallengeRanking & { coverImage?: string; description?: string })[] = [];
  @Input() topArtists: Artist[] = [];
  
  currentSlide = 0;

  constructor() {
    addIcons({ trophy, trophyOutline, arrowForward });
  }

  ngOnInit() {}

  // Méthode pour formater les nombres de votes
  formatVotes(votes: number): string {
    if (!votes) return '0';
    return votes >= 1000 ? (votes / 1000).toFixed(1) + 'k' : votes.toString();
  }

  getMediaUrl(relativePath: string): string {
    return getMediaUrl(relativePath);
  }

  // Gestion des erreurs d'image
  onImageError(event: any) {
    event.target.style.display = 'none';
    if (event.target.nextElementSibling) {
      event.target.nextElementSibling.style.display = 'flex';
    }
  }
  
  // Navigation dans le diaporama
  goToSlide(index: number): void {
    this.currentSlide = index;
  }
  
  // Méthode pour passer au slide suivant
  nextSlide(): void {
    this.currentSlide = (this.currentSlide + 1) % this.challengeRankings.length;
  }
  
  // Méthode pour passer au slide précédent
  prevSlide(): void {
    this.currentSlide = (this.currentSlide - 1 + this.challengeRankings.length) % this.challengeRankings.length;
  }

  // Méthode pour afficher le classement complet d'un défi
  @Output() viewChallenge = new EventEmitter<string>();
  
  viewChallengeRanking(challengeId: string) {
    this.viewChallenge.emit(challengeId);
  }
}
