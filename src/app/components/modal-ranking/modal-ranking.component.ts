import { Component, Input, OnInit } from '@angular/core';
import { CommonModule, NgFor } from '@angular/common';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { ShortNumberPipe } from 'src/app/utils/pipes/shortNumberPipe/short-number-pipe';
import { LeaderboardEntry } from 'src/services/Service_vote/vote-service';
import { IonIcon, IonBadge } from "@ionic/angular/standalone";
import { addIcons } from 'ionicons';
import {closeOutline } from 'ionicons/icons';


// Interface pour le challenge reçu (identique à celle de ranking.page.ts)
interface ChallengeLeaderboard {
  challengeId: string;
  challengeName: string;
  coverImage?: string;
  description?: string;
  endDate?: string;
  isCompleted?: boolean;
  leaderboard: LeaderboardEntry[];
  statistics: {
    total_participants: number;
    total_votes: number;
    average_votes_per_participant: number;
  };
}

@Component({
  selector: 'app-modal-ranking',
  templateUrl: './modal-ranking.component.html',
  styleUrls: ['./modal-ranking.component.scss'],
  standalone: true,
  providers: [ModalController],
  imports: [IonBadge, IonIcon, CommonModule, ShortNumberPipe, NgFor],
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
  @Input() challenge!: ChallengeLeaderboard;
  @Input() isCompleted: boolean = false;

  sortedLeaderboard: LeaderboardEntry[] = [];
  
  constructor(
    private modalCtrl: ModalController,
    private router: Router
  ) { addIcons({closeOutline}); }

  ngOnInit() {
    if (this.challenge && this.challenge.leaderboard) {
      this.sortedLeaderboard = [...this.challenge.leaderboard]
        .sort((a, b) => b.totalVotes - a.totalVotes)
        .map((entry, index) => ({
          ...entry,
          rank: index + 1
        }));
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
      case 1: return '#FFD700';
      case 2: return '#C0C0C0';
      case 3: return '#CD7F32';
      default: return '#6B7280';
    }
  }

  getMedalClass(rank: number): string {
    switch (rank) {
      case 1: return 'gold-medal';
      case 2: return 'silver-medal';
      case 3: return 'bronze-medal';
      default: return '';
    }
  }

  showAccount(userId: string) {
    this.router.navigate(['/profile', userId]);
    this.closeModal();
  }

  closeModal() {
    this.modalCtrl.dismiss();
  }

  onImageError(event: any) {
    event.target.src = 'assets/avatar-default.png';
  }

  formatVotes(votes: number): string {
    if (votes >= 1000000) {
      return (votes / 1000000).toFixed(1) + 'M';
    }
    if (votes >= 1000) {
      return (votes / 1000).toFixed(1) + 'K';
    }
    return votes.toString();
  }
}