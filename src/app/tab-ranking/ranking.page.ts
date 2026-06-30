import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalController, RefresherCustomEvent } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { search, trophy, trophyOutline, checkmarkCircle, trendingUp, gift, heart, starOutline, medal, ribbon, closeOutline, people, chevronForward, arrowForward } from 'ionicons/icons';
import { ChallengeService } from '../../services/Service_challenge/challenge-service';
import { VoteService, LeaderboardEntry } from '../../services/Service_vote/vote-service';
import { ProfileService } from '../../services/Service_profile/profile-service';
import { Subject } from 'rxjs';
import { MediaUrlPipe } from '../utils/pipes/mediaUrlPipe/media-url-pipe';
import { HeaderComponentComponent } from '../components/header-component/header-component.component';
import { 
  IonContent, 
  IonSpinner, 
  IonRefresher, 
  IonRefresherContent, 
  IonIcon,
 IonFooter } from '@ionic/angular/standalone';
import { Auth } from '../../services/AUTH/auth';
import { Router } from '@angular/router';
import { UserProfile } from '../../models/User';
import { ModalRankingComponent } from '../components/modal-ranking/modal-ranking.component';

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
  selector: 'app-ranking',
  templateUrl: './ranking.page.html',
  styleUrls: ['./ranking.page.scss'],
  standalone: true,
  providers: [ModalController],
  imports: [
    CommonModule,
    FormsModule,
    HeaderComponentComponent,
    IonContent,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonIcon,
   MediaUrlPipe,
   AsyncPipe
  ]
})
export class RankingPage implements OnInit, OnDestroy {
  isLoading = true;
  challengeLeaderboards: ChallengeLeaderboard[] = [];
  filteredChallengeLeaderboards: ChallengeLeaderboard[] = [];
  allArtists: LeaderboardEntry[] = [];
  topArtists: LeaderboardEntry[] = [];
  currentUserProfile: UserProfile | null = null;
  currentUserId: string = '';
  adminUID: string = '';

  // ✅ Filtre
  filterType: 'all' | 'active' | 'completed' = 'all';

  private destroy$ = new Subject<void>();

  constructor(
    private challengeService: ChallengeService,
    private voteService: VoteService,
    private auth: Auth,
    private router: Router,
    private modalCtrl: ModalController
  ) {
    addIcons({
      search, trophy, trophyOutline, checkmarkCircle, 
      trendingUp, gift, heart, starOutline, medal, ribbon, people,
      chevronForward, arrowForward
    });
  }

  ngOnInit() {
    this.loadRankingData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  doRefresh(event: RefresherCustomEvent) {
    this.loadRankingData();
    setTimeout(() => {
      event.detail.complete();
    }, 1000);
  }

  // ✅ Appliquer le filtre
  applyFilter() {
    if (this.filterType === 'all') {
      this.filteredChallengeLeaderboards = [...this.challengeLeaderboards];
    } else if (this.filterType === 'active') {
      this.filteredChallengeLeaderboards = this.challengeLeaderboards.filter(c => !c.isCompleted);
    } else if (this.filterType === 'completed') {
      this.filteredChallengeLeaderboards = this.challengeLeaderboards.filter(c => c.isCompleted);
    }
  }

  // ✅ Changer le filtre
  setFilter(type: 'all' | 'active' | 'completed') {
    this.filterType = type;
    this.applyFilter();
  }

  onProfileLoaded(profile:UserProfile){
    this.currentUserProfile  = profile;
  }

  async loadRankingData() {
    this.isLoading = true;
    
    try {
      // 1- Récupérer l'utilisateur courant et l'admin
      const currentUser = this.auth.getCurrentUser();
      if (!currentUser) {
        this.isLoading = false;
        return;
      }
      this.currentUserId = currentUser.id;

      const adminUID = await this.auth.getAdminUID().toPromise();
      this.adminUID = adminUID || '';

      // 3- Récupérer les challenges (actifs et terminés) des créateurs suivis
      const followedCreatorIds = this.currentUserProfile?.myFollows || [];
      const filteredCreatorIds = followedCreatorIds.filter(id => id !== this.currentUserId && id !== this.adminUID);
      
      if (filteredCreatorIds.length === 0) {
        this.challengeLeaderboards = [];
        this.filteredChallengeLeaderboards = [];
        this.isLoading = false;
        return;
      }

      // Récupérer tous les challenges (actifs + terminés)
      const challengesResponse = await this.challengeService.getChallengesByCreator(
        [...filteredCreatorIds, this.adminUID]
      ).toPromise();

      const allChallenges = challengesResponse || [];

      if (allChallenges.length === 0) {
        this.challengeLeaderboards = [];
        this.filteredChallengeLeaderboards = [];
        this.isLoading = false;
        return;
      }

      // 4- Pour chaque challenge, récupérer le leaderboard via VoteService
      const leaderboards = await Promise.all(
        allChallenges.map(async (challenge) => {
          try {
            // Vérifier si le challenge est terminé
            const isCompleted = challenge.is_active === false || 
                               (challenge.end_date && new Date(challenge.end_date) < new Date());

            // Récupérer le leaderboard pour ce challenge
            const leaderboardResponse = await this.voteService.getChallengeLeaderboard(
              challenge.id,
              20
            ).toPromise();

            return {
              challengeId: challenge.id,
              challengeName: challenge.name,
              coverImage: challenge.cover_image_url,
              description: challenge.description,
              endDate: challenge.end_date,
              isCompleted: isCompleted,
              leaderboard: leaderboardResponse?.leaderboard || [],
              statistics: leaderboardResponse?.statistics || {
                total_participants: 0,
                total_votes: 0,
                average_votes_per_participant: 0
              }
            } as ChallengeLeaderboard;
          } catch (error) {
            console.error(`Error loading leaderboard for challenge ${challenge.id}:`, error);
            return null;
          }
        })
      );

      // Filtrer les résultats nuls
      this.challengeLeaderboards = leaderboards.filter(lb => lb !== null) as ChallengeLeaderboard[];

      // Trier : les challenges terminés d'abord, puis par popularité
      this.challengeLeaderboards.sort((a, b) => {
        if (a.isCompleted && !b.isCompleted) return -1;
        if (!a.isCompleted && b.isCompleted) return 1;
        return b.statistics.total_votes - a.statistics.total_votes;
      });

      // ✅ Appliquer le filtre
      this.applyFilter();

      // Préparer les artistes du top global
      this.prepareGlobalArtists();

      this.isLoading = false;

    } catch (error) {
      console.error('Error loading ranking data:', error);
      this.isLoading = false;
    }
  }

  private prepareGlobalArtists() {
    const artistMap = new Map<string, LeaderboardEntry>();

    this.challengeLeaderboards.forEach(challenge => {
      challenge.leaderboard.forEach(artist => {
        if (artistMap.has(artist.userId)) {
          const existing = artistMap.get(artist.userId)!;
          existing.totalVotes += artist.totalVotes;
          existing.votesCount += artist.votesCount;
          existing.averageVotes = Math.round((existing.totalVotes / existing.votesCount) * 100) / 100;
        } else {
          artistMap.set(artist.userId, { ...artist });
        }
      });
    });

    this.allArtists = Array.from(artistMap.values())
      .sort((a, b) => b.totalVotes - a.totalVotes);

    this.allArtists.forEach((artist, index) => {
      artist.rank = index + 1;
    });

    this.topArtists = this.allArtists.slice(0, 6);
  }

  async onViewChallenge(challenge: ChallengeLeaderboard) {
    console.log('View challenge:', challenge.challengeId);
  }

  async onViewFullLeaderboard(challenge: ChallengeLeaderboard) {
    const modal = await this.modalCtrl.create({
      component: ModalRankingComponent,
      componentProps: { 
        challenge: challenge,
        isCompleted: challenge.isCompleted
      },
      cssClass: 'auto-height',
      initialBreakpoint: 0.60,
      breakpoints: [0, 0.60, 1],
      handle: true
    });
    await modal.present();
  }

  openSearch() {
    this.loadRankingData();
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

  /**
   * Calcule le pourcentage de votes d'un artiste par rapport au leader (topArtists[0]).
   * Utilisé pour animer la barre de progression dans le podium.
   * Toujours 100% pour le #1, proportionnel pour les autres.
   */
  getVotePercent(artist: LeaderboardEntry): number {
    if (!this.topArtists.length || this.topArtists[0].totalVotes === 0) return 0;
    const max = this.topArtists[0].totalVotes;
    return Math.round((artist.totalVotes / max) * 100);
  }

  getMedalColor(rank: number): string {
    switch(rank) {
      case 1: return '#FFD700';
      case 2: return '#C0C0C0';
      case 3: return '#CD7F32';
      default: return '#666';
    }
  }

  getMedalIcon(rank: number): string {
    switch(rank) {
      case 1: return 'medal-outline';
      case 2: return 'medal-outline';
      case 3: return 'medal-outline';
      default: return 'ribbon-outline';
    }
  }
}