import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { starOutline, cash, search, diamond, ribbon, trophy, trophyOutline, checkmarkCircle, trendingUp, gift, heart } from 'ionicons/icons';
import { ChallengeService } from '../../services/Service_challenge/challenge-service';
import { CreationService } from '../../services/Service_content/creation-service';
import { VoteService } from '../../services/Service_vote/vote-service';
import { ProfileService } from '../../services/Service_profile/profile-service';
import { forkJoin, Observable, of } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { HeaderComponentComponent } from '../components/header-component/header-component.component';
import { 
  IonContent, 
  IonHeader, 
  IonToolbar, 
  IonButton,
  IonIcon,
  IonCard,
  IonCardContent,
  IonSpinner
} from '@ionic/angular/standalone';
import { Artist } from 'src/models/User';
import { VotesRankingComponent } from '../components/view-votes-ranking/votes-ranking.component';
import { DonationsRankingComponent } from '../components/view-donations-ranking/donations-ranking.component';



interface Donor {
  id: string;
  name: string;
  totalDonations: number;
  donationCount: number;
  imageUrl: string;
  rank?: number;
  tier: 'legendary' | 'epic' | 'rare' | 'common';
  badge?: string;
  level: number;
}

interface DonorTier {
  name: string;
  minAmount: number;
  color: string;
  icon: string;
  benefits: string[];
}





interface ChallengeRanking {
  challengeId: string;
  challengeName: string;
  artists: Artist[];
}

@Component({
  selector: 'app-ranking',
  templateUrl: './ranking.page.html',
  styleUrls: ['./ranking.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HeaderComponentComponent,
    IonContent,
    IonButton,
    IonIcon,
    IonSpinner,
    VotesRankingComponent,
    DonationsRankingComponent
  ]
})
export class RankingPage implements OnInit {
  selectedTab: 'votes' | 'dons' = 'votes';
  isLoading = true;
  challengeRankings: ChallengeRanking[] = [];
  allArtists: Artist[] = [];
  topArtists: Artist[] = [];

  topDonors: Donor[] = [];
  donorTiers: DonorTier[] = [
    {
      name: 'Légendaire',
      minAmount: 10000,
      color: '#FFD700',
      icon: 'star',
      benefits: ['Badge exclusif', 'Mention spéciale', 'Accès VIP']
    },
    {
      name: 'Épique',
      minAmount: 5000,
      color: '#9945FF',
      icon: 'diamond',
      benefits: ['Badge premium', 'Priorité support']
    },
    {
      name: 'Rare',
      minAmount: 1000,
      color: '#3B82F6',
      icon: 'ribbon',
      benefits: ['Badge rare', 'Remerciements']
    },
    {
      name: 'Commun',
      minAmount: 0,
      color: '#10B981',
      icon: 'heart',
      benefits: ['Badge donateur']
    }
  ];

  // Données statiques pour la démonstration
  mockDonors: Donor[] = [
    {
      id: '1',
      name: 'Marie Laurent',
      totalDonations: 15000,
      donationCount: 45,
      imageUrl: 'https://i.pravatar.cc/150?img=1',
      tier: 'legendary',
      badge: '👑',
      level: 12,
      rank: 1
    },
    {
      id: '2',
      name: 'Jean Pierre',
      totalDonations: 12000,
      donationCount: 38,
      imageUrl: 'https://i.pravatar.cc/150?img=2',
      tier: 'legendary',
      badge: '💎',
      level: 11,
      rank: 2
    },
    {
      id: '3',
      name: 'Sophie Martin',
      totalDonations: 8500,
      donationCount: 32,
      imageUrl: 'https://i.pravatar.cc/150?img=3',
      tier: 'epic',
      badge: '⭐',
      level: 9,
      rank: 3
    },
    {
      id: '4',
      name: 'Lucas Dubois',
      totalDonations: 6200,
      donationCount: 28,
      imageUrl: 'https://i.pravatar.cc/150?img=4',
      tier: 'epic',
      badge: '🎯',
      level: 8,
      rank: 4
    },
    {
      id: '5',
      name: 'Emma Bernard',
      totalDonations: 4800,
      donationCount: 24,
      imageUrl: 'https://i.pravatar.cc/150?img=5',
      tier: 'rare',
      badge: '🌟',
      level: 7,
      rank: 5
    },
    {
      id: '6',
      name: 'Thomas Petit',
      totalDonations: 3500,
      donationCount: 20,
      imageUrl: 'https://i.pravatar.cc/150?img=6',
      tier: 'rare',
      badge: '🔥',
      level: 6,
      rank: 6
    }
  ];

  constructor(
    private challengeService: ChallengeService,
    private creationService: CreationService,
    private voteService: VoteService,
    private profileService: ProfileService
  ) {
    addIcons({search,diamond,ribbon, trophy,cash,trophyOutline,checkmarkCircle,trendingUp,gift,heart,starOutline});
  }

  ngOnInit() {
    this.loadRankingData();
    this.loadDonorsData();
  }

    // Ajoutez cette méthode dans ngOnInit ou loadRankingData
  loadDonorsData() {
    // Simuler le chargement des données
    this.topDonors = this.mockDonors;
  }

  formatDonation(amount: number): string {
    if (amount >= 1000000) {
      return (amount / 1000000).toFixed(1) + 'M Gdes';
    }
    if (amount >= 1000) {
      return (amount / 1000).toFixed(1) + 'K Gdes';
    }
    return amount + ' Gdes';
  }

  getTierColor(tier: string): string {
    const tierObj = this.donorTiers.find(t => t.name.toLowerCase() === tier);
    return tierObj?.color || '#10B981';
  }

  getDonorProgress(donor: Donor): number {
    const nextTierIndex = this.donorTiers.findIndex(t => t.minAmount > donor.totalDonations);
    if (nextTierIndex === -1) return 100;
    
    const currentTier = this.donorTiers[nextTierIndex + 1] || this.donorTiers[this.donorTiers.length - 1];
    const nextTier = this.donorTiers[nextTierIndex];
    
    const progress = ((donor.totalDonations - currentTier.minAmount) / 
                     (nextTier.minAmount - currentTier.minAmount)) * 100;
    return Math.min(Math.max(progress, 0), 100);
  }



  loadRankingData() {
    this.isLoading = true;
    
    // Charger les défis actifs
    this.challengeService.getActiveChallenges().pipe(
      switchMap(challenges => {
        if (!challenges || challenges.length === 0) {
          return of([]);
        }
        
        const rankings$ = challenges.map(challenge => 
          this.getChallengeRanking(challenge)
        );
        return forkJoin(rankings$);
      })
    ).subscribe({
      next: (rankings: ChallengeRanking[]) => {
        this.challengeRankings = rankings.filter(r => r.artists.length > 0);
        this.prepareArtistsData();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading ranking data:', error);
        this.isLoading = false;
      }
    });
  }

  private getChallengeRanking(challenge: any): Observable<ChallengeRanking> {
    // Étape 1: Récupérer les participants réels du défi
    return this.creationService.getChallengeParticipantProfiles(challenge.id).pipe(
      switchMap((participants: any[]) => {
        if (!participants || participants.length === 0) {
          return of({
            challengeId: challenge.id,
            challengeName: challenge.name,
            artists: []
          });
        }

        // Étape 2: Récupérer tous les contenus du défi pour calculer les votes
        return this.creationService.getContents({ChallengeId:challenge.id}).pipe(
          switchMap((contents: any[]) => {
            // Étape 3: Calculer les votes pour chaque participant
            const participantsWithVotes$ = participants.map((participant: any) => {
              // Filtrer les contenus de ce participant
              const participantContents = contents.filter((content: any) => content.userId === participant.id);
              
              // Calculer le total des votes pour tous ses contenus
              const votesForParticipant$ = participantContents.length > 0 
                ? forkJoin(
                    participantContents.map((content: any) => 
                      this.voteService.getTotalVotesForContent(content.id || '')
                    )
                  ).pipe(
                    map(votesArray => votesArray.reduce((total, votes) => total + votes, 0))
                  )
                : of(0); // Aucun contenu = 0 votes

              return votesForParticipant$.pipe(
                map(totalVotes => ({
                  participant,
                  totalVotes,
                  contentCount: participantContents.length
                }))
              );
            });

            return forkJoin(participantsWithVotes$).pipe(
              map((participantsData: any[]) => {
                // Étape 4: Transformer en objets Artist et trier
                const artists: Artist[] = participantsData.map(({ participant, totalVotes, contentCount }: any) => ({
                  id: participant.id,
                  name: participant.displayName || participant.username || 'Artiste inconnu',
                  imageUrl: participant.avatar || 'assets/icon/avatar-default.png',
                  category: 'Artiste',
                  votes: totalVotes,
                  contentCount: contentCount, // Utile pour le debug
                  rank: 0 // Sera calculé après le tri
                }));

                // Trier par nombre de votes décroissant
                artists.sort((a, b) => b.votes - a.votes);
                
                // Ajouter le rang
                artists.forEach((artist, index) => {
                  artist.rank = index + 1;
                });

                return {
                  challengeId: challenge.id,
                  challengeName: challenge.name,
                  coverImage: challenge.cover_image_url,
                  description: challenge.description,
                  artists: artists
                };
              })
            );
          })
        );
      }),
      catchError(error => {
        console.error(`Error getting ranking for challenge ${challenge.id}:`, error);
        return of({
          challengeId: challenge.id,
          challengeName: challenge.name,
          artists: []
        });
      })
    );
  }

  private prepareArtistsData() {
    // Rassembler tous les artistes de tous les défis
    const artistMap = new Map<string, Artist>();

    this.challengeRankings.forEach(ranking => {
      ranking.artists.forEach(artist => {
        if (artistMap.has(artist.id)) {
          // Si l'artiste existe déjà, additionner les votes
          const existingArtist = artistMap.get(artist.id)!;
          existingArtist.votes += artist.votes;
          // Garder le meilleur rang (le plus bas)
          if (artist.rank && (!existingArtist.rank || artist.rank < existingArtist.rank!)) {
            existingArtist.rank = artist.rank;
          }
        } else {
          artistMap.set(artist.id, { ...artist });
        }
      });
    });

    // Convertir en tableau et trier par votes décroissants
    this.allArtists = Array.from(artistMap.values())
      .sort((a, b) => b.votes - a.votes);

    // Mettre à jour les rangs finaux
    this.allArtists.forEach((artist, index) => {
      artist.rank = index + 1;
    });

    // Les 6 premiers pour le top
    this.topArtists = this.allArtists.slice(0, 6);
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

  selectTab(tab: 'votes' | 'dons') {
    this.selectedTab = tab;
    console.log("Tab is : ",this.selectedTab);
    // Implémentez la logique pour l'onglet "dons" si nécessaire
  }

  toggleFavorite(artist: Artist) {
    artist.isFavorite = !artist.isFavorite;
    // Implémentez la logique pour sauvegarder les favoris si nécessaire
  }

  // Gestion des erreurs d'image
  onImageError(event: any) {
    event.target.src = 'assets/icon/avatar-default.png';
  }


  // Méthode pour afficher les détails d'un défi
  viewChallengeDetails(challengeId: string) {
    // Implémentez la navigation vers la page des détails du défi
    console.log('Voir les détails du défi:', challengeId);
    // this.router.navigate(['/challenge-details', challengeId]);
  }

  // Méthode pour afficher le classement complet d'un défi
  onViewChallenge(challengeId: string) {
    // Implémentez la logique pour afficher le classement complet
    console.log('View challenge ranking:', challengeId);
  }

  // Méthode appelée lorsqu'un donateur est sélectionné
  onViewDonor(donorId: string) {
    // Implémentez la logique pour afficher les détails du donateur
    console.log('View donor details:', donorId);
  }
}