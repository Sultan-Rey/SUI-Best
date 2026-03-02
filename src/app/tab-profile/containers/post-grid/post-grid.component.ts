import { Component, Input, OnInit } from '@angular/core';
import { IonSpinner, IonIcon } from "@ionic/angular/standalone";
import { Content } from 'src/models/Content';
import { ModalController } from '@ionic/angular';
import { UserProfile } from 'src/models/User';
import { FollowedViewComponent } from 'src/app/tab-home/containers/followed-panel/followed-view.component';
import { MediaUrlPipe } from 'src/app/utils/pipes/mediaUrlPipe/media-url-pipe';
import { NgIf, NgFor } from '@angular/common';
import { CreationService } from 'src/services/CREATION_SERVICE/creation-service';
import { ProfileService } from 'src/services/PROFILE_SERVICE/profile-service';
import { isNullOrUndefined } from 'html5-qrcode/esm/core';
@Component({
  selector: 'app-post-grid',
  templateUrl: './post-grid.component.html',
  styleUrls: ['./post-grid.component.scss'],
  standalone: true,
  providers: [ModalController],
  imports: [IonIcon, IonSpinner, MediaUrlPipe, NgIf, NgFor]
})
export class PostGridComponent  implements OnInit {
  @Input() LoggedUserId!: string | null;
  @Input() CurrentUserProfile!:UserProfile;
  userContents: Content[] = [];
  isLoadingContents = false;
  constructor(private modalCtrl: ModalController, 
     private profileService: ProfileService,
     private creationService: CreationService,) { }

  ngOnInit() {
    this.loadUserContents(this.CurrentUserProfile.id);
  }

  
  loadUserContents(userId: string) {
    this.isLoadingContents = true;
    this.creationService.getUserContents(userId).subscribe({
      next: (contents) => {
        this.userContents = contents;
        this.isLoadingContents = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des contenus', err);
        this.isLoadingContents = false;
      }
    });
  }

  async openContent(content: Content) {
    
    if (!content) {
          console.error('Content not found for item:', content);
          return;
        }
    if(isNullOrUndefined(this.LoggedUserId)){
       console.error('User Id not found for item:', this.LoggedUserId);
          return;
    }    
           const myUserProfile = await this.profileService.getProfileById(this.LoggedUserId as string).toPromise();
            const modal = await this.modalCtrl.create({
            component: FollowedViewComponent,
            componentProps: {
              currentUserProfile: myUserProfile,
              posts: [content],
              challengeName: '-'
            },
            animated: true,
            cssClass: 'followed-view-modal',
            handle: true
          });
          await modal.present();
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
