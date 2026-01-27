import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule, DatePipe, DecimalPipe, SlicePipe } from '@angular/common';
import { finalize, takeUntil, Subject, map, Observable, forkJoin } from 'rxjs';
import { Challenge } from 'src/models/Challenge.js';
import { CreationService } from 'src/services/CREATION/creation-service.js';
import { IonButton, IonIcon, IonSkeletonText } from "@ionic/angular/standalone";
import { getMediaUrl} from 'src/app/utils/media.utils.js';
import { ProfileService } from 'src/services/PROFILE_SERVICE/profile-service.js';
import { UserProfile } from 'src/models/User.js';
import { Input } from '@angular/core';
import { ToastController, AlertController} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, checkmark, peopleOutline, people, timeOutline, playCircle, heart, trophy, thumbsUp, star } from 'ionicons/icons';
import { ChallengeService } from 'src/services/CHALLENGE_SERVICE/challenge-service';


@Component({
  selector: 'app-discovery-view',
  templateUrl: './discovery-view.component.html',
  styleUrls: ['./discovery-view.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    IonButton,
    IonIcon,
    IonSkeletonText,
    RouterLink
  ]
})
export class DiscoveryViewComponent implements OnInit {
  @Input() currentUserProfile: any; 
  mostPopularChallenge: Challenge | null = null;
  topArtists: UserProfile[] = [];
  topCreators: UserProfile[] = [];
  topFans: UserProfile[] = [];
  artistContents: { [key: string]: string } = {}; // Pour stocker les premiers contenus des artistes
  isLoadingPopularChallenge = false;
  isLoadingArtists = false;
  isLoadingCreators = false;
  isLoadingFans = false;
  heroStats = {
    totalArtists: 0,
    activeChallenges: 0,
    totalVotes: 0
  };
  private destroy$ = new Subject<void>();
  isFollowingUser: { [key: string]: boolean } = {};

  constructor(
    private creationService: CreationService,
    private challengeService: ChallengeService,
    private profileService: ProfileService,
    private cdr: ChangeDetectorRef,
    private toastController: ToastController,
    private alertController: ToastController,
    private router: Router
  ) {  
    addIcons({peopleOutline,timeOutline,playCircle,heart,people,add,trophy,thumbsUp,star,checkmark});
  }

  ngOnInit() {
    this.loadHeroStats();
    this.loadMostPopularActiveChallenge();
    this.loadTopArtists();
    this.loadTopCreators();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  
getGlobalStats(): Observable<{
  totalArtists: number;
  activeChallenges: number;
  totalVotes: number;
}> {
  return forkJoin({
    artists: this.profileService.getProfiles().pipe(
      map(profiles => profiles.filter(p => p.userType === 'artist').length)
    ),
    challenges: this.challengeService.getActiveChallenges().pipe(
      map(challenges => challenges.length)
    ),
    votes: this.profileService.getProfiles().pipe(
      map(profiles => profiles.reduce((sum, profile) => sum + (profile.stats?.votes || 0), 0))
    )
  }).pipe(
    map(({artists, challenges, votes}) => ({
      totalArtists: artists,
      activeChallenges: challenges,
      totalVotes: votes
    }))
  );
}


loadHeroStats(): void {
  this.getGlobalStats()
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (stats) => {
        this.heroStats = stats;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des statistiques:', error);
        // Valeurs par défaut en cas d'erreur
        this.heroStats = {
          totalArtists: 1000,
          activeChallenges: 50,
          totalVotes: 50000
        };
      }
    });
}

  loadTopArtists(): void {
    this.isLoadingArtists = true;
    this.cdr.markForCheck();

    this.profileService.getTopArtists()
      .pipe(
        takeUntil(this.destroy$),
        map(artists => {
          // Filtrer pour exclure le profil de l'utilisateur connecté
          return artists.filter(artist => artist.id !== this.currentUserProfile?.id);
        }),
        finalize(() => {
          this.isLoadingArtists = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (filteredArtists) => {
          this.topArtists = filteredArtists;
          // Initialiser l'état de suivi et charger le contenu pour chaque artiste
          filteredArtists.forEach(artist => {
            if (artist.id && this.currentUserProfile?.myFollows?.includes(artist.id)) {
              this.isFollowingUser[artist.id] = true;
            }
            // Charger le premier contenu de l'artiste
            if (artist.id) {
              this.loadArtistFirstContent(artist.id);
            }
          });
        },
        error: (error) => {
          console.error('Erreur lors du chargement des artistes populaires:', error);
        }
      });
  }

  /**
   * Charge le premier contenu d'un artiste
   * @param artistId ID de l'artiste
   */
  loadArtistFirstContent(artistId: string): void {
    this.creationService.getUserContents(artistId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (contents) => {
          if (contents && contents.length > 0) {
            // Stocke l'URL du premier contenu pour cet artiste
            this.artistContents[artistId] = contents[0].fileUrl;
            this.cdr.markForCheck();
          }
        },
        error: (error) => {
          console.error(`Erreur lors du chargement du contenu pour l'artiste ${artistId}:`, error);
        }
      });
  }

  loadTopCreators(): void {
    this.isLoadingCreators = true;
    this.cdr.markForCheck();

    this.profileService.getTopCreators()
      .pipe(
        takeUntil(this.destroy$),
        map(creators => {
          // Filtrer pour exclure le profil de l'utilisateur connecté
          return creators.filter(creator => creator.id !== this.currentUserProfile?.id);
        }),
        finalize(() => {
          this.isLoadingCreators = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (filteredCreators) => {
          this.topCreators = filteredCreators;
          // Initialiser l'état de suivi
          filteredCreators.forEach(creator => {
            if (creator.id && this.currentUserProfile?.myFollows?.includes(creator.id)) {
              this.isFollowingUser[creator.id] = true;
            }
          });
        },
        error: (error) => {
          console.error('Erreur lors du chargement des créateurs populaires:', error);
        }
      });
  }

// Dans votre composant
loadTopFans(): void {
  this.isLoadingFans = true;
  
  this.profileService.getTopFans(10)
    .pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isLoadingFans = false;
        this.cdr.markForCheck();
      })
    )
    .subscribe({
      next: (topFans) => {
        this.topFans = topFans;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des meilleurs fans:', error);
      }
    });
}

  getFansCount(count: number): string {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    } else if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
  }

  loadMostPopularActiveChallenge(): void {
    this.isLoadingPopularChallenge = true;
    this.challengeService.getMostPopularActiveChallenge()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoadingPopularChallenge = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (challenge) => {
          this.mostPopularChallenge = challenge;
        },
        error: (error) => {
          console.error('Erreur lors du chargement du challenge populaire:', error);
        }
      });
  }

  /**
   * Calcule le nombre de jours restants avant la fin du challenge
   * @param endDate Date de fin du challenge
   * @returns Nombre de jours restants (arrondi à l'entier supérieur)
   */
  calculateDaysLeft(endDate: Date | string): number {
    if (!endDate) return 0;
    
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays); // Retourne 0 si la date est déjà passée
  }

  onImageAvatarError(event: any) {
      // On récupère l'élément HTML <img> qui a déclenché l'erreur
      const imgElement = event.target as HTMLImageElement;
     imgElement.onerror = null;
      // On remplace la source par l'image locale
      imgElement.src = 'assets/avatar-default.png';
      // Optionnel : ajouter une classe pour styliser différemment l'avatar par défaut si besoin
      imgElement.classList.add('is-default');
    }
 onImageContentError(event: any) {
    // On récupère l'élément HTML <img> qui a déclenché l'erreur
    const imgElement = event.target as HTMLImageElement;
   imgElement.onerror = null;
    // On remplace la source par l'image locale
    imgElement.src = 'assets/splash.png';
    // Optionnel : ajouter une classe pour styliser différemment l'avatar par défaut si besoin
    imgElement.classList.add('is-default');
  }
  
  getMediaUrl(relativePath: string): string {
    return getMediaUrl(relativePath);
  }
   /**
   * Redirige vers la page de détail d'un challenge
   * @param challengeId ID du challenge à afficher
   */
  viewChallenge(challengeId: string): void {
    if (!challengeId) return;
    this.router.navigate(['/challenge', challengeId]);
  }

  //Follow and unfollow 

async subscribeTo(profileId: string) {
  if (!this.currentUserProfile?.id) return;

  const wasFollowing = this.isFollowingUser[profileId];
  // Mise à jour optimiste de l'UI
  this.isFollowingUser[profileId] = !wasFollowing;
  this.cdr.detectChanges(); // Forcer la détection des changements

  try {
    const subscription = wasFollowing
      ? await this.profileService.unfollowProfile(this.currentUserProfile.id, profileId)
      : await this.profileService.followProfile(this.currentUserProfile.id, profileId);

   const toast = await this.toastController.create({
      message: wasFollowing ? 'Vous ne suivez plus cet utilisateur' : 'Vous suivez maintenant cet utilisateur',
      duration: 2000,
      position: 'bottom',
      color: 'success',
      icon: wasFollowing ? 'person-remove' : 'person-add',
      buttons: [
        {
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    
    await toast.present();
  } catch (error) {
    console.error('Erreur:', error);
    // En cas d'erreur, on remet l'état précédent
    this.isFollowingUser[profileId] = wasFollowing;
    this.cdr.detectChanges();
    // Afficher le toast d'erreur...
  }
}
goTo(profileId: string): void {
  if (!profileId) {
    console.error('ID de profil non valide');
    return;
  }
  this.router.navigate(['tabs/tabs/profile', profileId]);
}

getFanLevel(fan: UserProfile): string {
  const score = (fan.stats?.votes || 0) + (fan.stats?.stars || 0) * 10;
  if (score > 1000) return 'Fan Ultime';
  if (score > 500) return 'Fan Passionné';
  if (score > 100) return 'Fan Actif';
  return 'Nouveau Fan';
}

// Dans votre composant
formatWithCounter(value: number): string {
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'K+';
  }
  return value.toString();
}
// Pour calculer le pourcentage de participation
getVoteParticipation(fan: UserProfile): number {
  // Ici, vous devriez avoir une logique pour calculer la participation
  // Pour l'instant, on met une valeur aléatoire entre 80 et 100
  return Math.floor(Math.random() * 21) + 80;
}

async handleExploreClick() {
  if (this.currentUserProfile?.myFollows?.length >= 2) {
    window.location.reload();
  } else {
    const alert = await this.alertController.create({
      cssClass: 'custom-alert', // Ajoutez une classe CSS personnalisée
      header: 'Découverte requise',
      message: 'Pour une expérience utilisateur optimale, nous vous recommandons de suivre au moins 2 personnes.',
      buttons: [
        {
          text: 'Plus tard',
          role: 'cancel',
          
        },
        {
          text: 'Découvrir',
          handler: () => {
            this.router.navigate(['/explore']);
          }
        }
      ]
    });

    await alert.present();
  }
}

}