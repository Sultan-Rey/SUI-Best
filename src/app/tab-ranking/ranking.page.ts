import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { RefresherCustomEvent } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { search, diamond, ribbon, trophy, cash, trophyOutline, checkmarkCircle, trendingUp, gift, heart, starOutline } from 'ionicons/icons';
import { ChallengeService } from '../../services/Service_challenge/challenge-service';
import { CreationService } from '../../services/Service_content/creation-service';
import { VoteService } from '../../services/Service_vote/vote-service';
import { ProfileService } from '../../services/Service_profile/profile-service';
import { forkJoin, Observable, of, Subject, from } from 'rxjs';
import { switchMap, map, catchError, takeUntil, filter, take } from 'rxjs/operators';
import { HeaderComponentComponent } from '../components/header-component/header-component.component';
import { 
  IonContent, 
  IonSpinner, IonRefresher, IonRefresherContent, IonButton, IonIcon } from '@ionic/angular/standalone';
import { Artist } from 'src/models/User';
import { VotesRankingComponent } from '../components/view-votes-ranking/votes-ranking.component';
import { ModalRankingComponent } from '../components/modal-ranking/modal-ranking.component';
import { UserProfile } from 'src/models/User';
import { Auth } from 'src/services/AUTH/auth';
import { Router } from '@angular/router';

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
  providers: [ModalController],
  imports: [IonRefresherContent, IonRefresher, 
    CommonModule,
    FormsModule,
    HeaderComponentComponent,
    IonContent,
    IonSpinner,
    IonButton,
    IonIcon,
    VotesRankingComponent
  ]
})
export class RankingPage implements OnInit, OnDestroy {
  selectedTab: 'votes' | 'dons' = 'votes';
  isLoading = true;
  challengeRankings: ChallengeRanking[] = [];

  allArtists: Artist[] = [];
  topArtists: Artist[] = [];

  private destroy$ = new Subject<void>();
  
  // Modal properties
  showRankingModal: boolean = false;
  selectedRanking: ChallengeRanking | null = null;
  
  // User profile
  currentUserProfile: UserProfile | null = null;

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
    private profileService: ProfileService,
    private auth: Auth,
    private router: Router,
    private modalCtrl: ModalController
  ) {
    addIcons({search,diamond,ribbon, trophy,cash,trophyOutline,checkmarkCircle,trendingUp,gift,heart,starOutline});
  }

  ngOnInit() {
    this.loadRankingData();
    this.loadDonorsData();
  }


  // Méthode pour gérer le pull-to-refresh
  doRefresh(event: RefresherCustomEvent) {
    console.log('Rafraîchissement du classement...');
    
    // Recharger les données
    this.loadRankingData();
    this.loadDonorsData();
    
    // Terminer le refresher après 1 seconde pour montrer l'animation
    setTimeout(() => {
      event.detail.complete();
    }, 1000);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

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
  
                     return progress;
                    }
  
 async loadRankingData() {
    this.isLoading = true;
    
    try {
      // 1- Récupérer le profil utilisateur courant
      const currentUser = this.auth.getCurrentUser();
      if (!currentUser) {
        this.isLoading = false;
        return;
      }
      
      const currentProfile = await this.profileService.getProfileById(currentUser.id).toPromise();
      this.currentUserProfile = currentProfile as UserProfile;
      
      // 2- Récupérer les challenges actifs des créateurs suivis
      const challenges = await this.challengeService.getActiveChallenges().toPromise();
      const followedCreatorIds = this.currentUserProfile?.myFollows || [];
      const filteredChallenges = challenges?.filter(challenge => 
        followedCreatorIds.includes(challenge.creator_id)
      );
      
      if (!filteredChallenges || filteredChallenges.length === 0) {
        this.challengeRankings = [];
        this.isLoading = false;
        return;
      }
      
      // 3- Récupérer tous les contenus de ces challenges
      const allContents = await this.creationService.getContents({}).toPromise();
      const challengeContents = allContents?.filter(content => 
        filteredChallenges.some(challenge => challenge.id === content.challengeId)
      );
      
      // 4- Créer les classements simples
      const rankings = await Promise.all(
        filteredChallenges.map(async (challenge) => {
          // Récupérer les contenus de ce challenge
          const contents = challengeContents?.filter(c => c.challengeId === challenge.id);
          
          if(!contents){
            return null;
          }
          
          // Grouper par utilisateur et compter les votes
          const userVotesMap = new Map<string, number>();
          
          for (const content of contents) {
            const votes = await this.voteService.getTotalVotesForContent(content.id || '').toPromise();
            const currentVotes = userVotesMap.get(content.userId) || 0;
            userVotesMap.set(content.userId, currentVotes + (votes||0));
          }
          
          // Récupérer les profils des créateurs
          const artists: Artist[] = [];
          for (const [userId, totalVotes] of userVotesMap.entries()) {
            const userProfile = await this.profileService.getProfileById(userId).toPromise();
            artists.push({
              id: userId,
              name: userProfile?.displayName || userProfile?.username || 'Artiste inconnu',
              imageUrl: userProfile?.avatar || 'assets/icon/avatar-default.png',
              category: 'Artiste',
              votes: totalVotes,
              rank: 0
            });
          }
          
          // Trier par votes
          artists.sort((a, b) => b.votes - a.votes);
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
      
      // Filtrer les résultats nuls et assigner
      this.challengeRankings = rankings.filter(r => r !== null) as ChallengeRanking[];
      
      // Préparer les données pour l'affichage
      this.prepareArtistsData();
      this.isLoading = false;
      
    } catch (error) {
      console.error('Error loading ranking data:', error);
      this.isLoading = false;
    }
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

 
openSearch() {
   this.router.navigate(['/search']);
  }

  selectTab(tab: 'votes' | 'dons') {
    this.selectedTab = tab;
    console.log("Tab is : ",this.selectedTab);
    // Implémentez la logique pour l'onglet "dons" si nécessaire
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
  async onViewChallenge(ranking: any) {
     const modal = await this.modalCtrl.create({
          component: ModalRankingComponent,
          componentProps: { ranking: ranking},
          cssClass: 'auto-height',
          initialBreakpoint: 0.75,
          breakpoints: [0, 0.75, 1],
          handle: true
        });
        
        await modal.present();
  }

  // Méthode appelée lorsqu'un donateur est sélectionné
  onViewDonor(donorId: string) {
    // Implémentez la logique pour afficher les détails du donateur
    console.log('View donor details:', donorId);
  }
}