import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { IonIcon, IonButton, IonBadge } from "@ionic/angular/standalone";
import { MediaUrlPipe } from 'src/app/utils/pipes/mediaUrlPipe/media-url-pipe';
import { AsyncPipe } from '@angular/common';
import { NgIf, NgFor } from '@angular/common';
import { UserProfile } from 'src/models/User';
import { Router } from '@angular/router';
import { ModalController} from '@ionic/angular';
import { Challenge } from 'src/models/Challenge';
import { ModalChallengeComponent } from 'src/app/components/modal-challenge-view/modal-challenge.component';
import { Observable } from 'rxjs';
import { ChallengeService } from 'src/services/CHALLENGE_SERVICE/challenge-service';
@Component({
  selector: 'app-challenge-section',
  templateUrl: './challenge-section.component.html',
  styleUrls: ['./challenge-section.component.scss'],
  providers: [ModalController],
  imports: [ IonIcon, IonButton, IonBadge, MediaUrlPipe, NgIf, NgFor, AsyncPipe]
})
export class ChallengeSectionComponent  implements OnInit {
  @Input() UserProfile!: UserProfile;
  @Input() CurrentUserId!: string | null;
  @Output() activeChallengesCountChange = new EventEmitter<number>();
  activeChallengesCount : number = 0;
  activeChallenges$!: Observable<Challenge[]>;
  constructor(private router: Router, private modalCtrl: ModalController, private challengeService: ChallengeService) { }

  ngOnInit() {
    if (this.CurrentUserId) {
      this.loadActiveChallenges(this.CurrentUserId);
    }
}

    viewAllChallenges() {
    this.router.navigate(['/challenges']);
  }

  loadActiveChallenges(UerId: string){
    this.activeChallengesCount = 0;
    this.activeChallenges$ = this.challengeService.getChallengesByCreator(UerId);
    this.activeChallenges$.subscribe((challenges: Challenge[]) => {
      this.activeChallengesCount = challenges.filter((challenge)=> challenge.is_active).length;
      this.activeChallengesCountChange.emit(this.activeChallengesCount);
    });
  }

  // Méthode publique pour recharger les challenges depuis le parent
  reloadChallenges() {
    if (this.CurrentUserId) {
      this.loadActiveChallenges(this.CurrentUserId);
    }
  }

  async openChallengeModal(challenge: Challenge){
    const modal = await this.modalCtrl.create({
      component: ModalChallengeComponent,
      cssClass: 'auto-height',
      componentProps: {
        challenge: challenge, 
        currentUserProfile: this.UserProfile, 
        currentUserId: this.CurrentUserId
      },
    })
  
    await modal.present();
  }

   getChallengeStatus(challenge: Challenge): 'active' | 'ending-soon' | 'ended' {
      const daysRemaining = this.getDaysRemaining(challenge);
      if (daysRemaining <= 0) return 'ended';
      if (daysRemaining <= 3) return 'ending-soon';
      return 'active';
    }
  
    getDaysRemaining(challenge: Challenge): number {
      if (!challenge.end_date) return 0;
      
      const endDate = new Date(challenge.end_date);
      if (isNaN(endDate.getTime())) {
        console.error('Date de fin invalide:', challenge.end_date);
        return 0;
      }
      
      const now = new Date();
      const diffTime = endDate.getTime() - now.getTime();
      return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }
    getStatusBadgeColor(status: string): string {
      switch(status) {
        case 'active': return 'success';
        case 'ending-soon': return 'warning';
        case 'ended': return 'medium';
        default: return 'primary';
      }
    }
  
    getStatusText(status: string): string {
      switch(status) {
        case 'active': return 'EN COURS'; 
        case 'ending-soon': return 'BIENTÔT TERMINÉ';
        case 'ended': return 'TERMINÉ';
        default: return 'ACTIF';
      }
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
}
