import { Component, Input, OnInit } from '@angular/core';
import { CommonModule, NgFor } from '@angular/common';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { ChallengeRanking } from '../../../models/Challenge';
import { Artist } from 'src/models/User';
import { ShortNumberPipe } from 'src/app/utils/pipes/shortNumberPipe/short-number-pipe';
import { ModalController } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-modal-ranking',
  templateUrl: './modal-ranking.component.html',
  styleUrls: ['./modal-ranking.component.scss'],
  standalone: true,
  providers: [ModalController],
  imports: [CommonModule, ShortNumberPipe, NgFor],
  animations: [
    trigger('modalSlideInOut', [
      state('void', style({
        opacity: 0,
        transform: 'translateY(100%) scale(0.9)'
      })),
      state('*', style({
        opacity: 1,
        transform: 'translateY(0) scale(1)'
      })),
      transition(':enter', [
        animate('300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)')
      ]),
      transition(':leave', [
        animate('250ms cubic-bezier(0.55, 0.055, 0.675, 0.19)', style({
          opacity: 0,
          transform: 'translateY(100%) scale(0.9)'
        }))
      ])
    ]),
    trigger('overlayFadeInOut', [
      state('void', style({
        opacity: 0
      })),
      state('*', style({
        opacity: 1
      })),
      transition(':enter', [
        animate('200ms ease-out')
      ]),
      transition(':leave', [
        animate('200ms ease-in')
      ])
    ])
  ]
})
export class ModalRankingComponent implements OnInit {
  @Input() ranking!: ChallengeRanking;
  @Input() isVisible: boolean = false;
  @Input() title: string = 'Classement';

  sortedArtists: Artist[] = [];
  
  constructor(private modalCtrl: ModalController, private router: Router) { }

  ngOnInit() {
    if (this.ranking && this.ranking.artists) {
      this.sortedArtists = [...this.ranking.artists].sort((a, b) => (b.votes || 0) - (a.votes || 0));
    }
  }


  getRankIcon(rank: number): string {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  }

  getRankColor(rank: number): string {
    switch (rank) {
      case 1: return '#FFD700'; // Or
      case 2: return '#C0C0C0'; // Argent
      case 3: return '#CD7F32'; // Bronze
      default: return '#6B7280'; // Gris
    }
  }

  showAccount(userId:string){
        this.router.navigate(['/profile', userId]);
        this.modalCtrl.dismiss({
          animation: {
            leaveAnimation: 'modal-slide-out'
          }
        });
      }

  closeModal() {
    this.modalCtrl.dismiss({
      animation: {
        leaveAnimation: 'modal-slide-out'
      }
    });
  }

  onImageError(event: any) {
    event.target.src = 'assets/icon/avatar-default.png';
  }
}
