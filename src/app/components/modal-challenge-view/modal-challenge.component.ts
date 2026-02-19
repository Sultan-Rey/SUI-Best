import { Component, OnInit, Input } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { MediaUrlPipe } from '../../utils/pipes/mediaUrlPipe/media-url-pipe';
import { ShortNumberPipe } from '../../utils/pipes/shortNumberPipe/short-number-pipe.js';
import { Challenge } from 'src/models/Challenge.js';  
import { ActionSheetController, ModalController, AlertController, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  thumbsUp, eye, share, close, arrowForwardOutline, 
  trophyOutline, eyeOutline, personRemoveOutline, giftOutline,
  arrowBackOutline, refreshOutline, shareOutline, shareSocial,
  chevronBackOutline, chevronForwardOutline, link
} from 'ionicons/icons';
import { CreationService } from 'src/services/CREATION_SERVICE/creation-service';
import { UserProfile } from 'src/models/User';
import { Router } from '@angular/router';
import { GiftModalComponent } from '../modal-gift/gift-modal.component';
import { FollowedViewComponent } from '../view-followed/followed-view.component';
import { Content } from 'src/models/Content';
import { ProfileService } from 'src/services/PROFILE_SERVICE/profile-service.js';
import { ModalSelectPostComponent } from '../modal-select-post/modal-select-post.component';
import { UploadPage } from 'src/app/tab-upload/upload.page';
import { NotificationService } from 'src/services/NOTIFICATION_SERVICE/notification-service';

interface ParticipantWithStats extends UserProfile {
  voteCount?: number;
  viewCount?: number;
  shareCount?: number;
  rank?: number;
  contentId?: string;
}
@Component({
  selector: 'app-modal-challenge',
  templateUrl: './modal-challenge.component.html',
  styleUrls: ['./modal-challenge.component.scss'],
  standalone: true,
  providers: [ModalController],
  imports: [IonicModule, CommonModule, MediaUrlPipe, ShortNumberPipe]
})
export class ModalChallengeComponent  implements OnInit {
  @Input() challenge!: Challenge | null;
  @Input() currentUserProfile!: UserProfile;
  totalVotes: number = 0;
  totalViews: number = 0;
  totalShares: number = 0;
  participants: UserProfile[] = [];
  participantsWithStats: ParticipantWithStats[] = [];
  showParticipantsView = false;
  isLoadingParticipants = false;
  isParticiping:boolean = false;
  constructor(private actionSheetController: ActionSheetController, 
              private modalController : ModalController,
              private alertController: AlertController,
              private toastController: ToastController,
              private creationService: CreationService,
              private notificationService: NotificationService,
              private router: Router) { addIcons({
                'link': link,
                'share-social':shareSocial,
      'thumbs-up': thumbsUp,
      'eyes': eye, 
      'share': share,
      'close': close,
      'arrow-forward-outline': arrowForwardOutline,
      'trophy-outline': trophyOutline,
      'eye-outline': eyeOutline,
      'person-remove-outline': personRemoveOutline,
      'gift-outline': giftOutline,
      'arrow-back-outline': arrowBackOutline,
      'refresh-outline': refreshOutline,
      'share-outline': shareOutline,
      'chevron-back-outline': chevronBackOutline,
      'chevron-forward-outline': chevronForwardOutline
    }); }

  ngOnInit() {
    // Charger les participants en parallèle avec les statistiques
    this.loadParticipants();
    
    // Récupérer le total des votes pour ce challenge
    if (this.challenge?.id) {
      this.creationService.getTotalVotesForChallenge(this.challenge.id).subscribe(
        total => {
          this.totalVotes = total;
        }
      );
      this.creationService.getTotalViewsForChallenge(this.challenge.id).subscribe(
        total => {
          this.totalViews = total;
        }
      );
      this.creationService.getTotalSharesForChallenge(this.challenge.id).subscribe(
        total => {
          this.totalShares = total;
        }
      );
    }
  }

  private loadParticipants() {
    const challengeId = this.challenge?.id;
    if (!challengeId) return;

    this.isLoadingParticipants = true;
    
    this.creationService.getChallengeParticipantProfiles(challengeId).subscribe({
      next: (profiles) => {
        this.isParticiping = profiles.some(profile => profile.id === this.currentUserProfile.id);
        this.participants = profiles;
        this.isLoadingParticipants = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des participants:', error);
        this.participants = [];
        this.isLoadingParticipants = false;
      }
    });
  }

  async presentParticipateOptions() {
    const actionSheet = await this.actionSheetController.create({
      header: 'Participer au challenge',
      buttons: [
        {
          text: 'Ajouter un post existant',
          icon: 'link',
          handler: () => {
            this.addPost();
          }
        },
        {
          text: 'Creer un post',
          icon: 'share-social',
          handler: () => {
            this.createPost();
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

   onImageAvatarError(event: any) {
        const imgElement = event.target as HTMLImageElement;
       imgElement.onerror = null;
        imgElement.src = 'assets/avatar-default.png';
        imgElement.classList.add('is-default');
      }


  // Méthodes pour gérer l'affichage des participants
  getDisplayParticipants(): UserProfile[] {
    return this.participants.slice(0, 3);
  }

  getRemainingParticipantsCount(): number {
    return Math.max(0, this.participants.length - 3);
  }

  hasMoreParticipants(): boolean {
    return this.participants.length > 3;
  }

  goToParticipants() {
    console.log('goToParticipants called');
    console.log('Challenge ID:', this.challenge?.id);
    
    const challengeId = this.challenge?.id;
    if (!challengeId) {
      console.error('Challenge ID is missing');
      return;
    }

    // Charger les données des participants et afficher la vue
    this.loadParticipantsWithStats();
    this.showParticipantsView = true;
  }

  hideParticipantsView() {
    this.showParticipantsView = false;
  }

  async refreshParticipants() {
    const challengeId = this.challenge?.id;
    if (!challengeId) return;

    try {
      await this.loadParticipantsWithStats();
      this.showToast('Liste actualisée', 'success');
    } catch (error) {
      this.showToast('Erreur lors du rafraîchissement', 'danger');
    }
  }

  private async loadParticipantsWithStats() {
    const challengeId = this.challenge?.id;
    if (!challengeId) return;

    try {
      const participantsData = await this.creationService.getChallengeParticipants(challengeId).toPromise();
      
      if (!participantsData || participantsData.length === 0) {
        this.participantsWithStats = [];
        return;
      }
      
      // Transformer les données pour inclure les statistiques et calculer le rang
      this.participantsWithStats = participantsData.map((item, index) => {
        const participant: ParticipantWithStats = {
          ...item.profile,
          voteCount: item.content.voteCount || 0,
          viewCount: item.content.viewCount || 0,
          shareCount: item.content.shareCount || 0,
          contentId: item.content.id,
          rank: 0 // Sera calculé après le tri
        };
        return participant;
      });

      // Trier par voteCount décroissant et calculer les rangs
      this.sortParticipantsByVotes();
      
    } catch (error) {
      console.error('Erreur lors du chargement des participants:', error);
      this.participantsWithStats = [];
    }
  }

  private sortParticipantsByVotes() {
    // Trier par voteCount décroissant
    this.participantsWithStats.sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
    
    // Calculer les rangs
    this.participantsWithStats.forEach((participant, index) => {
      participant.rank = index + 1;
    });
  }

  // Getters pour le template
  get sortedParticipants(): ParticipantWithStats[] {
    return this.participantsWithStats;
  }

  trackByUserId(index: number, participant: ParticipantWithStats): string {
    return participant.id;
  }

  getRankClass(rank: number): Record<string, boolean> {
    return {
      'rank-first': rank === 1,
      'rank-second': rank === 2,
      'rank-third': rank === 3,
      'rank-other': rank > 3
    };
  }

  onImageError(event: any) {
    const imgElement = event.target as HTMLImageElement;
    imgElement.onerror = null;
    imgElement.src = 'assets/avatar-default.png';
    imgElement.classList.add('is-default');
  }

  //#region  Action Button
  // Actions des participants
  async viewParticipantContent(participant: ParticipantWithStats) {
    try {
      const challengeId = this.challenge?.id;
      if (!challengeId) {
        this.showToast('Challenge non trouvé', 'warning');
        return;
      }

      if (!participant.contentId) {
        this.showToast('Contenu non trouvé', 'warning');
        return;
      }

      // Récupérer tous les contenus du challenge
      const challengeContents = await this.creationService.getContentsByChallenge(challengeId).toPromise();
      
      if (!challengeContents || challengeContents.length === 0) {
        this.showToast('Aucun contenu trouvé pour ce challenge', 'warning');
        return;
      }
    

    

      // Mettre le contenu du participant en premier
      const participantContent = challengeContents.find(content => content.id === participant.contentId);
      const otherContents = challengeContents.filter(content => content.id !== participant.contentId);
      
      const orderedContents = participantContent 
        ? [participantContent, ...otherContents]
        : challengeContents;
   
     // Ouvrir le modal followed-view avec les contenus enrichis
      const modal = await this.modalController.create({
        component: FollowedViewComponent,
        componentProps: {
          currentUserProfile: this.currentUserProfile,
          posts: orderedContents,
          challengeName: this.challenge?.name || ''
        },
        animated: true,
        cssClass: 'followed-view-modal',
        handle: true
      });

      await modal.present();
      
    } catch (error) {
      console.error('Erreur lors de l\'ouverture du contenu:', error);
      this.showToast('Erreur lors de l\'ouverture du contenu', 'danger');
    }
  }

  async sendGiftToParticipant(participant: ParticipantWithStats) {
    try {
      const modal = await this.modalController.create({
        component: GiftModalComponent,
        cssClass: 'gift-modal',
        componentProps: {
          participant: participant
        },
        initialBreakpoint: 0.5,
      breakpoints: [0, 0.5, 1],
      });

      modal.onDidDismiss().then((result) => {
        if (result.data && result.data.gift) {
          this.showToast(`Cadeau "${result.data.gift.name}" envoyé à ${participant.displayName || participant.username}`, 'success');
        }
      });

      await modal.present();
    } catch (error) {
      console.error('Erreur lors de l\'ouverture du modal cadeau:', error);
      this.showToast('Erreur lors de l\'ouverture du modal cadeau', 'danger');
    }
  }

  async disqualifyParticipantAction(participant: ParticipantWithStats) {
    const alert = await this.alertController.create({
      header: 'Disqualifier le participant',
      message: `Êtes-vous sûr de vouloir disqualifier ${participant.displayName || participant.username} ? Cette action est irréversible.`,
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Disqualifier',
          role: 'destructive',
          handler: () => {
            this.processDisqualification(participant);
          }
        }
      ]
    });

    await alert.present();
  }

  private async processDisqualification(participant: ParticipantWithStats) {
    try {
      const challengeId = this.challenge?.id;
      if (!challengeId) return;
      
      console.log(`Disqualification du participant ${participant.id}`);
      
      // Récupérer tous les contenus de cet utilisateur associés au challenge
      const userContents = await this.creationService.getContentsByChallenge(challengeId).toPromise();
      const participantContents = userContents?.filter((content: any) => content.userId === participant.id) || [];
      
      if (participantContents.length > 0) {
        // Retirer le challengeId de tous les contenus de cet utilisateur
        const updatePromises = participantContents.map((content: any) => 
          this.creationService['api'].patch(this.creationService['contentResource'], content.id, { challengeId: null }).toPromise()
        );
        
        await Promise.all(updatePromises);
        //console.log(`ChallengeId retiré de ${participantContents.length} contenus pour l'utilisateur ${participant.id}`);
      }
      
      // Retirer de la liste locale
      this.participantsWithStats = this.participantsWithStats.filter(p => p.id !== participant.id);
      
      // Recalculer les rangs
      this.sortParticipantsByVotes();
      
      // Mettre à jour les statistiques du challenge
      await this.updateChallengeStats();
      
      this.showToast(`${participant.displayName || participant.username} a été disqualifié`, 'warning');
    } catch (error) {
      console.error('Erreur lors de la disqualification:', error);
      this.showToast('Erreur lors de la disqualification', 'danger');
    }
  }

  private async updateChallengeStats() {
    const challengeId = this.challenge?.id;
    if (!challengeId) return;

    try {
      // Recalculer les statistiques après disqualification
      const [votes, views, shares] = await Promise.all([
        this.creationService.getTotalVotesForChallenge(challengeId).toPromise(),
        this.creationService.getTotalViewsForChallenge(challengeId).toPromise(),
        this.creationService.getTotalSharesForChallenge(challengeId).toPromise()
      ]);

      this.totalVotes = votes || 0;
      this.totalViews = views || 0;
      this.totalShares = shares || 0;
      
      console.log('Statistiques du challenge mises à jour:', { votes, views, shares });
    } catch (error) {
      console.error('Erreur lors de la mise à jour des statistiques:', error);
    }
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger' = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
  async addPost() {
   const modal = await this.modalController.create({
      component:ModalSelectPostComponent,
      componentProps:{currentUserProfile: this.currentUserProfile},
      handle:true
    })

      await modal.present();
      const {data} = await modal.onDidDismiss();
      if(data && data.selected){
       if(this.challenge?.is_acceptance_automatic){
        // Vérifier si le défi est complet
        if (this.challenge.entries_count && typeof this.challenge.entries_count === 'number') {
          // Compter les participants actuels
          const currentEntriesCount = this.participants.length;
          
          if (currentEntriesCount >= this.challenge.entries_count) {
            this.showToast('Le défi est complet', 'danger');
            return;
          }
        }
        const choosenPost = data.post as Content;
          choosenPost.challengeId = this.challenge?.id || '';
          this.creationService.updateContentChallengeId(choosenPost);
        this.alertController.create({
          header:'Ouhah! '+this.currentUserProfile.displayName,
          subHeader:'Vous participer desormais au défi.',
          message:'Votre participation a été acceptée automatiquement',
          buttons: ['Félicitation !']
        }).then((alert) => {
          alert.present();
          
        });
       }else{
        this.alertController.create({
          header:'Participation au défis',
          subHeader:'Acceptation en cours de traitement',
          message:'Attendez de recevoir votre ticket d\'acceptance.',
          buttons: ['Merci !']
        }).then((alert) => {
          alert.present();
          this.notificationService.createNotification({
            title: 'Participation au défi',
            message: 'Votre participation est en cours de traitement',
            category: 'engagement',
            priority: 'medium',
            status: 'read',
            recipients: {
            type: 'creator',
            userIds: [this.challenge?.creator_id || '']},
            action: {
            type: 'response',
            label: 'Aprouvé le candidat',
            route: ['/profile', this.challenge?.id || '']},
            effects: {
            sound: 'default',
            vibration: true,
            badge: true
            }
          });
        });
       }
      }

  }
  createPost(){
      this.modalController.create({
        component:UploadPage,
        componentProps:{isModalMode:true, challengeId:this.challenge?.id, isAutomaticAcceptance:this.challenge?.is_acceptance_automatic, userId:this.currentUserProfile.id},
        handle:true
      }).then((modal) => {
        modal.present();
      });
  }
  dismiss(){
    this.modalController.dismiss();
  }
}
