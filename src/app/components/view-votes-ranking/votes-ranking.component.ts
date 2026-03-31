import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediaUrlPipe } from '../../utils/pipes/mediaUrlPipe/media-url-pipe';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { trophy, trophyOutline, arrowForward } from 'ionicons/icons';
import { Artist } from 'src/models/User';
import { ChallengeRanking } from '../../../models/Challenge';
import { ShortNumberPipe } from 'src/app/utils/pipes/shortNumberPipe/short-number-pipe';
import { 
  IonButton,
  IonIcon,
  IonSpinner
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';


@Component({
  selector: 'app-votes-ranking',
  templateUrl: './votes-ranking.component.html',
  styleUrls: ['./votes-ranking.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MediaUrlPipe,
    ShortNumberPipe,
    IonIcon,
    IonButton
  ]
})
export class VotesRankingComponent implements OnInit {
  @Input() isLoading: boolean = false;
  @Input() challengeRankings: (ChallengeRanking & { coverImage?: string; description?: string })[] = [];
  @Input() topArtists: Artist[] = [];
  
  currentSlide = 0;

  constructor(private router: Router) {
    addIcons({ trophy, trophyOutline, arrowForward });
  }

  ngOnInit() {}

    
showAccount(userId:string){
        this.router.navigate(['/profile', userId]);
       
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
  @Output() viewChallenge = new EventEmitter<ChallengeRanking>();
  
  viewChallengeRanking(ranking: ChallengeRanking) {
    this.viewChallenge.emit(ranking);
  }
}
