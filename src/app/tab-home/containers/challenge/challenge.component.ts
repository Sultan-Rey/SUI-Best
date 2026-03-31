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
  IonContent, IonIcon, IonFab, IonFabButton, IonSkeletonText, IonModal, IonList, IonItem, IonLabel, IonButton } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  starOutline, star, ellipse, addCircleOutline, close, create,
  notificationsOutline, personCircleOutline, searchOutline,
  trophyOutline, timeOutline, informationCircleOutline, addSharp
} from 'ionicons/icons';
import { ModalController, ToastController, AnimationController, LoadingController, ActionSheetController } from '@ionic/angular';
import { Subscription, forkJoin, of, switchMap, map } from 'rxjs';
import { Challenge } from 'src/models/Challenge';
import { ChallengeService } from 'src/services/Service_challenge/challenge-service';
import { CreationService } from 'src/services/Service_content/creation-service';
import { ChallengeFormComponent } from 'src/app/components/modal-challenge-form/challenge-form.component';
import { FollowedViewComponent } from '../followed-panel/followed-view.component';
import { MediaUrlPipe} from '../../../utils/pipes/mediaUrlPipe/media-url-pipe';
import { DatePipe } from '@angular/common';
import { UserProfile } from 'src/models/User';
import { ModalSelectPostComponent } from 'src/app/components/modal-select-post/modal-select-post.component';
import { Content, ContentStatus } from 'src/models/Content';
import { Segment } from 'src/models/Segment';
@Component({
  selector: 'app-challenge',
  templateUrl: './challenge.component.html',
  styleUrls: ['./challenge.component.scss'],
  providers: [ModalController],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonButton, IonModal, IonContent, IonIcon, IonFab, IonFabButton, IonSkeletonText, CommonModule, FormsModule, DatePipe, MediaUrlPipe],
})

export class ChallengeComponent implements OnInit, OnDestroy {
  
  @Input() CurrentUserProfile!: UserProfile;
  @ViewChild('modal') modal!: IonModal;
  @Output() navigateToTab = new EventEmitter<{
    args?: any[];
    extras ?: any;
    targetSegment: Segment;
    targetReturn: Segment;
  }>();
  // ─── Données (tableaux directs — pas d'Observables dans le template) ──────
  forYouChallenges:   Challenge[] = [];
  exploreChallenges:  Challenge[] = [];

  // ─── États UI ─────────────────────────────────────────────────────────────
  forYouLoading  = true;
  exploreLoading = true;
  forYouEmpty    = false;
  exploreEmpty   = false;

  private subscriptions: Subscription[] = [];

  readonly trackByChallengeId: TrackByFunction<Challenge> = (_, c) => c.id;
  readonly trackBySkeletonIndex: TrackByFunction<number>  = (i) => i;

  constructor(
    private challengeService: ChallengeService,
    private creationService:  CreationService,
    private modalCtrl:        ModalController,
    private toastController:  ToastController,
    private loadingController: LoadingController,
    private actionSheetController: ActionSheetController,
    private animationCtrl: AnimationController,
    private cdr:              ChangeDetectorRef,
    private auth:             Auth
  ) {
    addIcons({
      starOutline, star, ellipse, addCircleOutline, create, addSharp,
      notificationsOutline, personCircleOutline, searchOutline,
      trophyOutline, timeOutline, informationCircleOutline, close
    });

    
  }

  ngOnInit(): void {
    this.loadChallenges();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
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

  // ==============================================================
  //  CHARGEMENT
  // ==============================================================

  loadChallenges(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
    this.subscriptions = [];

    this.forYouLoading  = true;
    this.exploreLoading = true;
    this.forYouEmpty    = false;
    this.exploreEmpty   = false;
    this.cdr.markForCheck();

    // Une seule souscription par section — les données vont directement
    // dans des tableaux, le template utilise *ngFor sans | async
    this.subscriptions.push(
      this.auth.getAdminUID().pipe(
        switchMap(adminId => {
          if (!adminId) {
            // Si pas d'admin, retourner un tableau vide
            return of([]);
          }
          return this.challengeService.getChallengesBySingleCreator(adminId);
        })
      ).subscribe({
        next: challenges => {
          this.forYouChallenges = challenges;
          this.forYouLoading    = false;
          this.forYouEmpty      = challenges.length === 0;
          this.cdr.markForCheck();
        },
        error: () => {
          this.forYouLoading = false;
          this.forYouEmpty   = true;
          this.cdr.markForCheck();
        }
      }),

      this.auth.getAdminUID().pipe(
        switchMap(adminId => {
          return this.challengeService.getActiveChallenges().pipe(
            map(challenges => {
              // Filtrer les challenges pour exclure ceux créés par l'admin
              let filteredChallenges = challenges.filter(challenge => challenge.creator_id !== adminId);
              
              // Filtrer également pour n'afficher que les défis créés par les utilisateurs suivis
              if (this.CurrentUserProfile && this.CurrentUserProfile.myFollows) {
                const followedCreatorIds = this.CurrentUserProfile.myFollows;
                filteredChallenges = filteredChallenges.filter(challenge => 
                  followedCreatorIds.includes(challenge.creator_id)
                );
              }
              
              return filteredChallenges;
            })
          );
        })
      ).subscribe({
        next: challenges => {
          this.exploreChallenges = challenges;
          this.exploreLoading    = false;
          this.exploreEmpty      = challenges.length === 0;
          this.cdr.markForCheck();
        },
        error: () => {
          this.exploreLoading = false;
          this.exploreEmpty   = true;
          this.cdr.markForCheck();
        }
      })
    );
  }

  // ==============================================================
  //  ACTIONS
  // ==============================================================

  async createChallenge(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: ChallengeFormComponent,
      componentProps: { challenge: null, profileId: this.CurrentUserProfile.id},
      cssClass: 'auto-height',
      backdropDismiss: false
    });
    await modal.present();

    const { data } = await modal.onDidDismiss();
    if (data) this.loadChallenges();
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
          args:contents,
          extras: true,
          targetSegment: 'followed',
          targetReturn: 'challenge'
        });

    } catch {
      this.showToast('Erreur lors de l\'ouverture du contenu', 'danger');
    }
  }

  async presentParticipateOptions(challenge: Challenge) {
    const actionSheet = await this.actionSheetController.create({
      header: 'Participer au challenge',
      buttons: [
        {
          text: 'Ajouter un post existant',
          icon: 'add-sharp',
          handler: () => {
            this.addPost(challenge);
          }
        },
        {
          text: 'Creer un post',
          icon: 'create',
          handler: () => {
          this.createPost(challenge);
          }
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

  async addPost(challenge: Challenge) {
         const modal = await this.modalCtrl.create({
        component: ModalSelectPostComponent,
        componentProps: { currentUserProfile: this.CurrentUserProfile },
        handle: true
      });
  
      await modal.present();
      const { data } = await modal.onDidDismiss();
      
      if (data && data.selected) {
        // Afficher le loading seulement si des données sont sélectionnées
        const loading = await this.loadingController.create({
          message: 'Chargement...',
          spinner: 'crescent'
        });
        await loading.present();
  
        try {
          // Vérifier si le défi est complet
          if (challenge?.entries_count && typeof challenge.entries_count === 'number') {
           
            if (challenge.participants_count && challenge.participants_count >= challenge.entries_count) {
              this.showToast('Le défi est complet', 'danger');
              return;
            }
          }
          
          const choosenPost = data.post as Content;
          choosenPost.challengeId = challenge?.id || '';
          choosenPost.status = challenge?.is_acceptance_automatic ? ContentStatus.DRAFT : ContentStatus.PUBLISHED;
          this.creationService.updateContentChallengeId(choosenPost);
          
          if (challenge?.is_acceptance_automatic) {
            this.showToast('Félicitation! vous faites desormais partie de '+challenge.name);
           
          } else {
            // Mise à jour du loading pendant la création de la notification
            loading.message = 'Envoi de la notification...';
          
           
          }
        } catch (error) {
          console.error('Erreur lors de l\'ajout du post:', error);
          this.showToast('Une erreur est survenue', 'danger');
        } finally {
          // Masquer le loading dans tous les cas
          await loading.dismiss();
        }
      }
    }

    createPost(challenge: Challenge){
        this.navigateToTab.emit({
          args:[challenge],
          extras: true,
          targetSegment: 'upload',
          targetReturn: 'challenge'
        })
    }
  // ==============================================================
  //  UTILS
  // ==============================================================

  private async showToast(message: string, color: 'success' | 'warning' | 'danger' = 'success'): Promise<void> {
    const toast = await this.toastController.create({ message, duration: 2000, color, position: 'bottom' });
    await toast.present();
  }
}