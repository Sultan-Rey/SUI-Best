import {
  Component, Input, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef, TrackByFunction, ViewChild,
  Output,
  EventEmitter
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth } from 'src/services/AUTH/auth';
import {
  IonContent, IonIcon, IonSkeletonText, IonModal, IonButton 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  starOutline, star, ellipse, addOutline, close, create,
  notificationsOutline, personCircleOutline, searchOutline,
  trophyOutline, timeOutline, informationCircleOutline, peopleOutline, addSharp
} from 'ionicons/icons';
import { ModalController, ToastController, AnimationController, LoadingController, ActionSheetController } from '@ionic/angular';
import { of, switchMap, map, takeUntil, Subject, combineLatest, BehaviorSubject, debounceTime, distinctUntilChanged, tap } from 'rxjs';
import { Challenge } from 'src/models/Challenge';
import { ChallengeService } from 'src/services/Service_challenge/challenge-service';
import { CreationService } from 'src/services/Service_content/creation-service';
import { ChallengeFormComponent } from 'src/app/components/modal-challenge-form/challenge-form.component';
import { MediaUrlPipe} from '../../../utils/pipes/mediaUrlPipe/media-url-pipe';
import { DatePipe } from '@angular/common';
import { UserProfile } from 'src/models/User';
import { ModalSelectPostComponent } from 'src/app/components/modal-select-post/modal-select-post.component';
import { Content, ContentStatus } from 'src/models/Content';
import { Segment } from 'src/models/Segment';
import { ModalChallengeAcceptanceComponent } from 'src/app/components/modal-challenge-acceptance/modal-challenge-acceptance.component';
import { PremiumLockComponent } from 'src/app/components/premium-lock/premium-lock.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-challenge',
  templateUrl: './challenge.component.html',
  styleUrls: ['./challenge.component.scss'],
  providers: [ModalController],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonButton, IonModal, IonContent, IonIcon, IonSkeletonText, CommonModule, FormsModule, DatePipe, MediaUrlPipe],
})
export class ChallengeComponent implements OnInit, OnDestroy {
  
  @Input() set CurrentUserProfile(profile: UserProfile) {
    this._currentUserProfile = profile;
    if (profile?.id) {
      this.initializeChallenges();
      this.countPendingRequest();
    }
  }
  get CurrentUserProfile(): UserProfile {
    return this._currentUserProfile;
  }
  private _currentUserProfile!: UserProfile;

  @ViewChild('modal') modal!: IonModal;
  @Output() navigateToTab = new EventEmitter<{
    args?: any[];
    extras?: any;
    targetSegment: Segment;
    targetReturn: Segment;
  }>();

  // ─── Recherche ────────────────────────────────────────────────
  private searchSubject = new BehaviorSubject<string>('');
  searchQuery$ = this.searchSubject.asObservable().pipe(
    debounceTime(300),
    distinctUntilChanged()
  );

  // ─── Gestion du Chargement Réactif ───────────────────────────
  private loadingSubject = new BehaviorSubject<boolean>(true);
  isLoading$ = this.loadingSubject.asObservable();

  // Compteur des demandes en attente
  pendingCount$ = this.challengeService.pendingRequestsCount$.pipe(
    map(count => count ?? 0)
  );

  // Flux de base
  forYouChallenges$ = this.challengeService.activeChallenges$.pipe(
    map(challenges => (challenges ?? []).filter(c => c.creator_id === this.getSchoolId())),
    tap(() => this.loadingSubject.next(false))
  );

  exploreChallenges$ = this.challengeService.activeChallenges$.pipe(
    map(challenges => (challenges ?? []).filter(c => c.creator_id !== this.getSchoolId())),
    tap(() => this.loadingSubject.next(false))
  );

  // Flux filtrés par la recherche
  filteredForYouChallenges$ = combineLatest([
    this.forYouChallenges$,
    this.searchQuery$
  ]).pipe(
    map(([challenges, query]) => {
      if (!query.trim()) return challenges;
      const lowerQuery = query.toLowerCase();
      return challenges.filter(c => 
        c.name.toLowerCase().includes(lowerQuery) || 
        c.description?.toLowerCase().includes(lowerQuery)
      );
    })
  );

  filteredExploreChallenges$ = combineLatest([
    this.exploreChallenges$,
    this.searchQuery$
  ]).pipe(
    map(([challenges, query]) => {
      if (!query.trim()) return challenges;
      const lowerQuery = query.toLowerCase();
      return challenges.filter(c => 
        c.name.toLowerCase().includes(lowerQuery) || 
        c.description?.toLowerCase().includes(lowerQuery)
      );
    })
  );

  // Détection automatique de l'état vide
  isEmpty$ = combineLatest([
    this.filteredForYouChallenges$,
    this.filteredExploreChallenges$
  ]).pipe(
    map(([forYou, explore]) => forYou.length === 0 && explore.length === 0)
  );

  private destroy$ = new Subject<void>();

  readonly trackByChallengeId: TrackByFunction<Challenge> = (_, c) => c.id;
  readonly trackBySkeletonIndex: TrackByFunction<number> = (i) => i;

  constructor(
    private challengeService: ChallengeService,
    private creationService: CreationService,
    private modalCtrl: ModalController,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private actionSheetController: ActionSheetController,
    private animationCtrl: AnimationController,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private auth: Auth
  ) {
    addIcons({
      starOutline, star, ellipse, addOutline, create, addSharp,
      notificationsOutline, personCircleOutline, searchOutline, peopleOutline,
      trophyOutline, timeOutline, informationCircleOutline, close
    });
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.searchSubject.complete();
  }

   // Dans le fichier TS où se trouve votre fonction openPremiumLock :
private async openPremiumLock(): Promise<void> {
  const modal = await this.modalCtrl.create({
    component: PremiumLockComponent,
    cssClass: 'dialog-modal',
    backdropDismiss: false,
    enterAnimation: this.enterAnimation, // Passez votre fonction d'animation ici
    leaveAnimation: this.leaveAnimation
  });
  await modal.present();

  const { role } = await modal.onWillDismiss();
  if (role === 'upgrade') {
    try {
    const renewalInfo = {
      plan: this.CurrentUserProfile.userInfo.memberShip?.plan,
      date: this.CurrentUserProfile.userInfo.memberShip?.date
    }
    // 5️⃣ Redirection vers la page d'abonnement en passant le payload mis à jour
    // ATTENTION : On envoie 'payload' au lieu de 'this.form' pour que l'étape suivante ait accès aux follows
    await this.router.navigate(['/subscription'], {
      state: { registrationData: this.CurrentUserProfile, renewalData: renewalInfo}
    });
  } catch (navError) {
    console.error("Erreur lors de la navigation :", navError);
  } finally {
    // 6️⃣ Quoi qu'il arrive, on détruit le loading pour libérer l'écran
    await this.modalCtrl.dismiss();
  }
  }
}

  private getSchoolId(): string {
    return this.CurrentUserProfile?.userInfo?.school?.id || '';
  }

  private initializeChallenges(): void {
    const schoolId = this.getSchoolId();
    this.loadingSubject.next(true);
    
    this.auth.getAdminUID().pipe(
      switchMap((adminId: string) => {
        if (!schoolId && !adminId) {
          this.challengeService['activeChallengesSubject'].next([]);
          return of(null);
        }
        return this.challengeService.getActiveChallenges(schoolId, adminId);
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => this.cdr.markForCheck(),
      error: (err) => {
        console.error('[ChallengeComponent] initializeChallenges error:', err);
        this.loadingSubject.next(false);
        this.cdr.markForCheck();
      }
    });
  }

  private countPendingRequest(): void {
    if (!this.CurrentUserProfile?.id) return;
    
    this.challengeService.getPendingRequestsCountFast(this.CurrentUserProfile.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: (err) => console.error('[ChallengeComponent] countPendingRequest error:', err)
      });
  }

  onSearchChange(event: any): void {
    this.searchSubject.next(event.target.value || '');
  }

  async openPendingParticipants(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: ModalChallengeAcceptanceComponent,
      componentProps: { profileId: this.CurrentUserProfile.id },
      cssClass: 'auto-height',
      backdropDismiss: false
    });
    await modal.present();

    const { data } = await modal.onDidDismiss();
    if (data) {
      this.countPendingRequest();
    }
  }

  async createChallenge(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: ChallengeFormComponent,
      componentProps: { challenge: null, profileId: this.CurrentUserProfile.id },
      cssClass: 'auto-height',
      backdropDismiss: false
    });
    await modal.present();

    const { data } = await modal.onDidDismiss();
    if (data) {
      this.refreshChallenges();
      this.showToast('Challenge créé avec succès !', 'success');
    }
  }

  async onPlay(challenge: Challenge): Promise<void> {
    if (!challenge.id) {
      this.showToast('Challenge non trouvé', 'warning');
      return;
    }

    try {
      const contents = await this.creationService
        .getContents({ challengeId: challenge.id })
        .toPromise();

      if (!contents?.length) {
        await this.modal.present();
        const { data } = await this.modal.onDidDismiss();
        if (data === true) {
          this.presentParticipateOptions(challenge);
        }
        return;
      }
      
      this.navigateToTab.emit({
        args: contents,
        extras: true,
        targetSegment: 'followed',
        targetReturn: 'challenge'
      });

    } catch (error) {
      console.error('[ChallengeComponent] onPlay error:', error);
      this.showToast('Erreur lors de l\'ouverture du contenu', 'danger');
    }
  }


  async presentParticipateOptions(challenge: Challenge): Promise<void> {
if (this.CurrentUserProfile.userInfo.memberShip) {
  const plan = this.CurrentUserProfile.userInfo.memberShip.plan.trim();
  const expirationDate = new Date(this.CurrentUserProfile.userInfo.memberShip.date).getTime();
  const isExpired = expirationDate <= Date.now();

  // On déclenche si c'est le plan Exhibition OU si le plan est expiré
  if (plan.toLowerCase().trim() === 'exhibition' || isExpired) {
    this.openPremiumLock();
    return;
  }
}

    const actionSheet = await this.actionSheetController.create({
      header: 'Participer au challenge',
      buttons: [
        {
          text: 'Ajouter un post existant',
          icon: 'add-sharp',
          handler: () => { this.addPost(challenge); }
        },
        {
          text: 'Créer un post',
          icon: 'create',
          handler: () => { this.createPost(challenge); }
        },
        {
          text: 'Annuler',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  async addPost(challenge: Challenge): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: ModalSelectPostComponent,
      componentProps: { currentUserProfile: this.CurrentUserProfile },
      handle: true
    });

    await modal.present();
    const { data } = await modal.onDidDismiss();
    
    if (data && data.selected) {
      const loading = await this.loadingController.create({
        message: 'Chargement...',
        spinner: 'crescent'
      });
      await loading.present();

      try {
        if (challenge?.entries_count && typeof challenge.entries_count === 'number') {
          if (challenge.participants_count && challenge.participants_count >= challenge.entries_count) {
            this.showToast('Le défi est complet', 'danger');
            await loading.dismiss();
            return;
          }
        }
        
        const chosenPost = data.post as Content;
        chosenPost.challengeId = challenge?.id || '';
        chosenPost.status = challenge?.is_acceptance_automatic ? ContentStatus.PUBLISHED : ContentStatus.DRAFT;
        
        this.creationService.updateContentChallengeId(chosenPost).subscribe({
          next: () => {
            if (challenge?.is_acceptance_automatic) {
              this.showToast(`Félicitations ! Vous faites désormais partie de ${challenge.name}`);
            } else {
              this.showToast('Votre participation a été soumise en attente de validation', 'warning');
            }
            this.refreshChallenges();
          },
          error: (error) => {
            console.error('[ChallengeComponent] addPost error:', error);
            this.showToast('Erreur lors de l\'ajout du post', 'danger');
          }
        });
      } catch (error) {
        console.error('[ChallengeComponent] addPost error:', error);
        this.showToast('Une erreur est survenue', 'danger');
      } finally {
        await loading.dismiss();
      }
    }
  }

  createPost(challenge: Challenge): void {
    this.navigateToTab.emit({
      args: [challenge],
      extras: true,
      targetSegment: 'upload',
      targetReturn: 'challenge'
    });
  }

  refreshChallenges(): void {
    const schoolId = this.getSchoolId();
    this.loadingSubject.next(true);
    this.auth.getAdminUID().pipe(
      switchMap((adminId: string) => {
        if (!schoolId && !adminId) return of(null);
        return this.challengeService.getActiveChallenges(schoolId, adminId);
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      error: (err) => {
        console.error('[ChallengeComponent] refreshChallenges error:', err);
        this.loadingSubject.next(false);
      }
    });
  }

  handleRefresh(event?: any): void {
    this.refreshChallenges();
    if (event) {
      setTimeout(() => {
        event.target.complete();
      }, 500);
    }
  }

  enterAnimation = (baseEl: HTMLElement) => {
    const root = baseEl.shadowRoot;
    const backdropAnimation = this.animationCtrl
      .create()
      .addElement(root!.querySelector('ion-backdrop')!)
      .fromTo('opacity', '0.01', 'var(--backdrop-opacity)');

    const wrapperAnimation = this.animationCtrl
      .create()
      .addElement(root!.querySelector('.modal-wrapper')!)
      .keyframes([
        { offset: 0, opacity: '0', transform: 'scale(0)' },
        { offset: 1, opacity: '0.99', transform: 'scale(1)' },
      ]);

    return this.animationCtrl
      .create()
      .addElement(baseEl)
      .easing('ease-out')
      .duration(500)
      .addAnimation([backdropAnimation, wrapperAnimation]);
  };

  leaveAnimation = (baseEl: HTMLElement) => {
    return this.enterAnimation(baseEl).direction('reverse');
  };

  private async showToast(message: string, color: 'success' | 'warning' | 'danger' = 'success'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}