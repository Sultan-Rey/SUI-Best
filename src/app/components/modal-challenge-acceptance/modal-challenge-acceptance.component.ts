import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { forkJoin, of, switchMap, map } from 'rxjs';
import { addIcons } from 'ionicons';
import { 
  closeOutline, chevronDownOutline, chevronUpOutline, 
  checkmarkCircleOutline, closeCircleOutline, playCircleOutline, 
  checkmarkDoneCircleOutline 
} from 'ionicons/icons';

import { Challenge } from 'src/models/Challenge';
import { ParticipantRequest } from 'src/models/ParticipantRequest';
import { ChallengeService } from 'src/services/Service_challenge/challenge-service';
import { Auth } from 'src/services/AUTH/auth';

interface ChallengeRequestsGroup {
  challenge: Challenge;
  requests: ParticipantRequest[];
}

@Component({
  selector: 'app-modal-challenge-acceptance',
  templateUrl: './modal-challenge-acceptance.component.html',
  styleUrls: ['./modal-challenge-acceptance.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModalChallengeAcceptanceComponent implements OnInit {
  
  @Input() profileId!:string;
  creatorChallengesWithRequests: ChallengeRequestsGroup[] = [];
  selectedChallengeId: string | null = null;
  isLoading = true;
  isProcessingAction = false;

  constructor(
    private modalCtrl: ModalController,
    private challengeService: ChallengeService,
    private authService: Auth,
    private toastCtrl: ToastController,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({
      closeOutline, chevronDownOutline, chevronUpOutline,
      checkmarkCircleOutline, closeCircleOutline, playCircleOutline,
      checkmarkDoneCircleOutline
    });
  }

  ngOnInit() {
    this.loadPendingRequests();
  }

loadPendingRequests() {
  this.isLoading = true;
  this.cdr.markForCheck();

  
  
  // 1]. Appel de votre vraie méthode du service (qui renvoie maintenant directement un Challenge[])
  this.challengeService.getChallengesBySingleCreator(this.profileId).pipe(
    switchMap((challenges: Challenge[]) => {
      if (!challenges || challenges.length === 0) {
        return of([]); // Aucun challenge trouvé, on renvoie un tableau vide
      }

      // 2. Pour chaque challenge actif, on va interroger ses requêtes de participations 'pending'
      const requestsObservables = challenges.map(challenge => 
        this.challengeService.getPendingRequestsByChallengeId(challenge.id).pipe(
          map((requests: ParticipantRequest[]) => ({ challenge, requests }))
        )
      );
      
      return forkJoin(requestsObservables);
    })
  ).subscribe({
    next: (groupedData: ChallengeRequestsGroup[]) => {
      // 3. On filtre pour ne garder que les challenges qui ont réellement des demandes en attente
      this.creatorChallengesWithRequests = groupedData.filter(
        item => item.requests && item.requests.length > 0
      );
      
      this.isLoading = false;
      
      // On déplie automatiquement le premier challenge de la liste s'il y en a
      if (this.creatorChallengesWithRequests.length > 0) {
        this.selectedChallengeId = this.creatorChallengesWithRequests[0].challenge.id;
      }
      
      this.cdr.markForCheck();
    },
    error: (err) => {
      console.error('Erreur lors du chargement de la modale de validation :', err);
      this.showToast('Erreur lors du chargement des demandes', 'danger');
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  });
}

  toggleChallengeExpand(challengeId: string) {
    this.selectedChallengeId = this.selectedChallengeId === challengeId ? null : challengeId;
    this.cdr.markForCheck();
  }

  approveCandidate(challenge: Challenge, request: ParticipantRequest) {
    if (!request.id) return;
    this.isProcessingAction = true;
    this.cdr.markForCheck();

    this.challengeService.acceptParticipantRequest(request.id).subscribe({
      next: async () => {
        await this.showToast(`@${request.userProfile?.username || 'L\'utilisateur'} a rejoint votre challenge !`, 'success');
        this.removeRequestFromUi(challenge.id, request.id!);
      },
      error: () => {
        this.showToast('Impossible d\'approuver la demande.', 'danger');
        this.isProcessingAction = false;
        this.cdr.markForCheck();
      }
    });
  }

  rejectCandidate(challenge: Challenge, request: ParticipantRequest) {
    if (!request.id) return;
    this.isProcessingAction = true;
    this.cdr.markForCheck();

    this.challengeService.rejectParticipantRequest(request.id).subscribe({
      next: async () => {
        await this.showToast('Demande refusée.', 'warning');
        this.removeRequestFromUi(challenge.id, request.id!);
      },
      error: () => {
        this.showToast('Une erreur est survenue lors du refus.', 'danger');
        this.isProcessingAction = false;
        this.cdr.markForCheck();
      }
    });
  }

  private removeRequestFromUi(challengeId: string, requestId: string) {
    this.isProcessingAction = false;
    const groupIndex = this.creatorChallengesWithRequests.findIndex(item => item.challenge.id === challengeId);
    
    if (groupIndex !== -1) {
      this.creatorChallengesWithRequests[groupIndex].requests = 
        this.creatorChallengesWithRequests[groupIndex].requests.filter(req => req.id !== requestId);
      
      // Si plus aucune demande sur ce challenge, on nettoie la section de l'écran avec fluidité
      if (this.creatorChallengesWithRequests[groupIndex].requests.length === 0) {
        this.creatorChallengesWithRequests.splice(groupIndex, 1);
        this.selectedChallengeId = this.creatorChallengesWithRequests.length > 0 ? this.creatorChallengesWithRequests[0].challenge.id : null;
      }
    }
    this.cdr.markForCheck();
  }

  previewSubmittedMedia(content: any) {
    // Si votre objet Content utilise l'URL ou un format spécifique pour la vidéo/image :
    if (content) {
       // Logique premium pour ouvrir un lecteur natif ou modal vidéo plein écran
       console.log("Lecture du média : ", content);
    }
  }

  dismissModal() {
    this.modalCtrl.dismiss();
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2200,
      color,
      position: 'bottom',
      cssClass: 'premium-toast'
    });
    await toast.present();
  }

  trackByChallengeId(index: number, item: ChallengeRequestsGroup) { return item.challenge.id; }
  trackByRequestId(index: number, request: ParticipantRequest) { return request.id; }
}