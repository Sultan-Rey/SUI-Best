import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Observable, Subject, combineLatest, of } from 'rxjs';
import { map, switchMap, takeUntil, catchError, startWith } from 'rxjs/operators';
import { ProfileService } from '../../../services/Service_profile/profile-service';
import { UserProfile } from '../../../models/User';
import { NgFor, NgIf, AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-modal-following',
  templateUrl: './modal-following.component.html',
  styleUrls: ['./modal-following.component.scss'],
  standalone: true,
  imports: [NgFor, NgIf, AsyncPipe]
})
export class ModalFollowingComponent implements OnInit, OnDestroy {
  @Input() CurrentUserId!: string;
  
  // Segment actif: 'following' | 'fans'
  activeSegment: 'following' | 'fans' = 'following';
  
  // États de chargement
  loading$ = new Subject<boolean>();
  
  // Données
  followingProfiles$ = new Subject<UserProfile[]>();
  fansProfiles$ = new Subject<UserProfile[]>();
  
  // États pour les actions en cours
  processingActions = new Set<string>(); // IDs des profils en cours de traitement
  
  // Pagination
  followingPageSize = 10;
  fansPageSize = 10;
  followingHasMore = false;
  fansHasMore = false;
  
  // Compteurs
  followingCount = 0;
  fansCount = 0;
  
  private destroy$ = new Subject<void>();

  constructor(private profileService: ProfileService) {}

  ngOnInit() {
    if (this.CurrentUserId) {
      this.loadInitialData();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Charge les données initiales pour les deux segments
   */
  private loadInitialData() {
    this.loading$.next(true);
    
    combineLatest([
      this.loadFollowingProfiles(),
      this.loadFansProfiles()
    ]).pipe(
      takeUntil(this.destroy$),
      catchError(() => of([[], []]))
    ).subscribe(([following, fans]) => {
      this.followingProfiles$.next(following);
      this.fansProfiles$.next(fans);
      this.loading$.next(false);
    });
  }

  /**
   * Charge la liste des profils suivis par l'utilisateur
   */
  private loadFollowingProfiles(): Observable<UserProfile[]> {
    return this.profileService.getProfileById(this.CurrentUserId).pipe(
      switchMap(profile => {
        if (!profile || !profile.myFollows || profile.myFollows.length === 0) {
          this.followingCount = 0;
          this.followingHasMore = false;
          return of([]);
        }
        
        this.followingCount = profile.myFollows.length;
        this.followingHasMore = profile.myFollows.length > this.followingPageSize;
        
        return this.profileService.getProfilesByIds(profile.myFollows.slice(0, this.followingPageSize));
      })
    );
  }

  /**
   * Charge la liste des profils qui suivent l'utilisateur
   */
  private loadFansProfiles(): Observable<UserProfile[]> {
    return this.profileService.searchUserIdInMyFollows(this.CurrentUserId).pipe(
      switchMap(result => {
        this.fansCount = result.totalCount;
        this.fansHasMore = result.hasMore;
        return of(result.results);
      })
    );
  }

  /**
   * Change de segment actif
   */
  switchSegment(segment: 'following' | 'fans') {
    this.activeSegment = segment;
  }

  /**
   * Charge plus de profils (pagination)
   */
  loadMore() {
    if (this.activeSegment === 'following' && this.followingHasMore) {
      this.loadMoreFollowing();
    } else if (this.activeSegment === 'fans' && this.fansHasMore) {
      this.loadMoreFans();
    }
  }

  /**
   * Charge plus de profils suivis
   */
  private loadMoreFollowing() {
    this.followingProfiles$.pipe(
      takeUntil(this.destroy$),
      switchMap(currentProfiles => {
        return this.profileService.getProfileById(this.CurrentUserId).pipe(
          switchMap(profile => {
            if (!profile || !profile.myFollows) return of([]);
            
            const currentCount = currentProfiles.length;
            const nextBatch = profile.myFollows.slice(currentCount, currentCount + this.followingPageSize);
            
            if (nextBatch.length === 0) {
              this.followingHasMore = false;
              return of(currentProfiles);
            }
            
            return this.profileService.getProfilesByIds(nextBatch).pipe(
              map(newProfiles => {
                const updatedProfiles = [...currentProfiles, ...newProfiles];
                this.followingHasMore = currentCount + newProfiles.length < profile.myFollows.length;
                return updatedProfiles;
              })
            );
          })
        );
      })
    ).subscribe(profiles => {
      this.followingProfiles$.next(profiles);
    });
  }

  /**
   * Charge plus de fans
   */
  private loadMoreFans() {
    // Implémentation similaire pour les fans avec pagination
    this.fansProfiles$.pipe(
      takeUntil(this.destroy$),
      switchMap(currentProfiles => {
        return this.profileService.searchUserIdInMyFollows(this.CurrentUserId, this.fansPageSize).pipe(
          map(result => {
            const updatedProfiles = [...currentProfiles, ...result.results];
            this.fansHasMore = result.hasMore;
            return updatedProfiles;
          })
        );
      })
    ).subscribe(profiles => {
      this.fansProfiles$.next(profiles);
    });
  }

  /**
   * Action de follow/unfollow
   */
  async toggleFollow(profileId: string, isCurrentlyFollowing: boolean) {
    if (this.processingActions.has(profileId)) return;
    
    this.processingActions.add(profileId);
    
    try {
      if (isCurrentlyFollowing) {
        await this.profileService.unfollowProfile(this.CurrentUserId, profileId);
        this.removeProfileFromFollowing(profileId);
      } else {
        await this.profileService.followProfile(this.CurrentUserId, profileId);
        this.addProfileToFollowing(profileId);
      }
    } catch (error) {
      console.error('Erreur lors du follow/unfollow:', error);
    } finally {
      this.processingActions.delete(profileId);
    }
  }

  /**
   * Action de blacklist
   */
  async blacklistProfile(profileId: string) {
    if (this.processingActions.has(profileId)) return;
    
    this.processingActions.add(profileId);
    
    try {
      await this.profileService.blackListProfile(this.CurrentUserId, profileId);
      this.removeProfileFromFans(profileId);
    } catch (error) {
      console.error('Erreur lors du blacklist:', error);
    } finally {
      this.processingActions.delete(profileId);
    }
  }

  /**
   * Retire un profil de la liste des suivis
   */
  private removeProfileFromFollowing(profileId: string) {
    this.followingProfiles$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(currentProfiles => {
      const updatedProfiles = currentProfiles.filter(p => p.id !== profileId);
      this.followingProfiles$.next(updatedProfiles);
      this.followingCount = Math.max(0, this.followingCount - 1);
    });
  }

  /**
   * Ajoute un profil à la liste des suivis
   */
  private addProfileToFollowing(profileId: string) {
    this.profileService.getProfileById(profileId).pipe(
      takeUntil(this.destroy$)
    ).subscribe(profile => {
      if (profile) {
        this.followingProfiles$.pipe(
          takeUntil(this.destroy$)
        ).subscribe(currentProfiles => {
          const updatedProfiles = [...currentProfiles, profile];
          this.followingProfiles$.next(updatedProfiles);
          this.followingCount += 1;
        });
      }
    });
  }

  /**
   * Retire un profil de la liste des fans
   */
  private removeProfileFromFans(profileId: string) {
    this.fansProfiles$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(currentProfiles => {
      const updatedProfiles = currentProfiles.filter(p => p.id !== profileId);
      this.fansProfiles$.next(updatedProfiles);
      this.fansCount = Math.max(0, this.fansCount - 1);
    });
  }

  /**
   * Vérifie si une action est en cours pour un profil
   */
  isProcessing(profileId: string): boolean {
    return this.processingActions.has(profileId);
  }

  /**
   * Ferme le modal (à implémenter selon votre système de modals)
   */
  closeModal() {
    // Émettre un événement ou appeler un service pour fermer le modal
  }
}
