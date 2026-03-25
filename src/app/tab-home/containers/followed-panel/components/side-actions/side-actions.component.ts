import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { IonIcon, IonButton, IonThumbnail, IonBadge, IonAvatar } from "@ionic/angular/standalone";
import { ToastController, ModalController, LoadingController } from '@ionic/angular';
import { Content } from 'src/models/Content';
import { Challenge } from 'src/models/Challenge';
import { VoteService } from 'src/services/Service_vote/vote-service';
import { CouponModalComponent } from 'src/app/components/modal-coupon/coupon-modal.component';
import { GiftModalComponent } from 'src/app/components/modal-gift/gift-modal.component';
import { ModalCommentComponent } from 'src/app/components/modal-comment/modal-comment.component';
import { UserProfile } from 'src/models/User';
import { Router } from '@angular/router';
import { NgIf, NgFor } from '@angular/common';
import { CreationService } from 'src/services/Service_content/creation-service';

@Component({
  selector: 'app-side-actions',
  templateUrl: './side-actions.component.html',
  styleUrls: ['./side-actions.component.scss'],
  providers: [ModalController],
  imports: [IonIcon, IonBadge, NgIf, NgFor]
})
export class SideActionsComponent  implements OnInit, OnChanges {
  @Input() Post!: Content;
  @Input() CurrentUserProfile!: UserProfile;
  @Input() UserAvatars: { [userId: string]: string } = {};
  @Input() CurrentChallenge: { [challengeId: string]: Challenge } = {};
  @Input() HasActiveChallenge!: boolean;
  @Input() CommentCount!: number;
  buttonAction: { [key: string]: string } = {};
  constructor(private toastController: ToastController, private creationService: CreationService,
    private modalController: ModalController, 
    private voteService: VoteService, private router: Router, private loadingController: LoadingController) { }

  // ✅ Stocker le résultat calculé
cachedActions: any[] = [];

// ✅ Icône du vote séparée
get voteIcon(): string {
  return this.Post.isVotedByUser 
    ? '../assets/icon/checked.gif' 
    : '../assets/icon/democracy.png';
}

ngOnInit() {
  this.buildActions(); // Calcul initial
}

ngOnChanges(changes: SimpleChanges) {
  if (changes['CommentCount']) {
    this.Post.commentCount = changes['CommentCount'].currentValue;
  }
  // ✅ Reconstruire seulement quand Post ou HasActiveChallenge changent
  if (changes['Post'] || changes['HasActiveChallenge']) {
    this.buildActions();
  }
}

// ✅ Renommée et privée — appelée uniquement quand nécessaire
private async buildActions() {
  const giftColor = this.Post.isGiftedByUser ? 'danger' : '';
  const buttons = [];

  try {
    if (this.HasActiveChallenge) {
      const voteStatus = { voteLabel: "Votez", voteIcon: "../assets/icon/democracy.png", voteColor: 'danger' };
      
      // Vérification si l'utilisateur peut voter
      if (this.CurrentUserProfile?.id && this.Post?.id && this.Post?.challengeId) {
        const canVote = await this.voteService.canUserVoteForChallenge(
          this.CurrentUserProfile.id, 
          this.Post.id, 
          this.Post.challengeId
        ).toPromise();

        if (canVote) {
          // Logique de vote corrigée
          if (canVote.canVote && this.Post.isVotedByUser) {
            voteStatus.voteLabel = "voter encore";
            voteStatus.voteIcon = "../assets/icon/democracy.png";
            voteStatus.voteColor = "warning";
          } else if (!canVote.canVote && this.Post.isVotedByUser) {
            voteStatus.voteLabel = "Déjà voté";
            voteStatus.voteIcon = "../assets/icon/checked.gif";
            voteStatus.voteColor = "success";
          } else if (canVote.canVote && !this.Post.isVotedByUser) {
            voteStatus.voteLabel = "Votez";
            voteStatus.voteIcon = "../assets/icon/democracy.png";
            voteStatus.voteColor = "danger";
          }
        }
      }

      buttons.push(
        { icon: 'vote', count: this.Post.voteCount || 0, votestatus: voteStatus, action: () => this.voteForArtist(this.Post) }
      );
      buttons.push(
        { icon: 'gift', count: this.Post.giftCount || 0, color: giftColor, action: () => this.giftPost(this.Post) }
      );
    }

    buttons.push(
      { icon: 'chatbubble', count: this.Post.commentCount || 0, action: () => this.openComments(this.Post) },
      { icon: 'share', count: this.Post.shareCount || 0, action: () => this.sharePost(this.Post) }
    );

    this.cachedActions = buttons;
  } catch (error) {
    console.error('Erreur dans buildActions:', error);
    // En cas d'erreur, on ajoute quand même les actions de base
    buttons.push(
      { icon: 'chatbubble', count: this.Post.commentCount || 0, action: () => this.openComments(this.Post) },
      { icon: 'share', count: this.Post.shareCount || 0, action: () => this.sharePost(this.Post) }
    );
    this.cachedActions = buttons;
  }
}

  // Méthode publique pour incrémenter le compteur de commentaires
  incrementCommentCount() {
    if (this.Post) {
      this.Post.commentCount = (this.Post.commentCount || 0) + 1;
    }
  }

    



    
      //#region User Actions & Modal Management
      
    
      
    
      async voteForArtist(post: any) {
        const loading = await this.loadingController.create({
          message: 'Vérification en cours...',
          spinner: 'crescent'
        });
        
        await loading.present();
        
        this.voteService.canUserVoteForChallenge(this.CurrentUserProfile?.id, post.id, post.challengeId).subscribe({
          next: async (result) => {
            await loading.dismiss();
            
            if (result.canVote) {
              this.openVoteModal(post);
            } else {
              this.showToast('Vous avez déjà voté pour ce contenu dans ce défi');
            }
          },
          error: async (error) => {
            await loading.dismiss();
            console.error('Erreur lors de la vérification du vote:', error);
            this.showToast('Erreur lors de la vérification du vote');
          }
        });
      }
      
    
      private async openVoteModal(post: Content) {
        const modal = await this.modalController.create({
          component: CouponModalComponent,
          cssClass: 'vote-modal',
          breakpoints: [0, 0.7, 0.85],
          initialBreakpoint: 0.85,
          backdropDismiss: true,
          componentProps: {
            artistName: post.username || 'Utilisateur',
            artistAvatar: this.UserAvatars[post.userId] || 'assets/avatar-default.png',
            challengeName: this.CurrentChallenge[post.challengeId]?.name || 'Challenge',
            postId: post.id,
            userId: this.CurrentUserProfile?.id,
            challengeId: post.challengeId,
            usageRule: this.CurrentChallenge[post.challengeId]?.vote_rule 
          }
        });
    
        await modal.present();
        const { data } = await modal.onWillDismiss();
        
        if (data && data.success) {
           await this.voteService.getTotalVotesForContent(post.id as string).toPromise().then((votecount)=>{
            this.Post.voteCount = Number(votecount);
            post.isVotedByUser = true;
            this.buildActions();
          })
          this.showToast('Vote enregistré!', 'dark');
        }
      }
    
      
    
      async giftPost(post: Content) {
        if(post.userId === this.CurrentUserProfile.id){
          return;
        }
        const modal = await this.modalController.create({
          component: GiftModalComponent,
          componentProps: { post },
          cssClass: 'auto-height',
          initialBreakpoint: 0.5,
          breakpoints: [0, 0.5, 1],
          handle: true
        });
    
        await modal.present();
    
        const { data } = await modal.onWillDismiss();
        if (data?.gift) {
           this.buildActions();
        }
      }
    
      async openComments(post: Content) {
        if (!this.CurrentUserProfile) {
          this.router.navigate(['/login']);
          return;
        }
    
        
const modal = await this.modalController.create({
  component: ModalCommentComponent,
  componentProps: {
    currentUser: this.CurrentUserProfile,
    contentId: post.id
  },
  cssClass: 'comment-modal',   
  handle: true
});
        await modal.present();
    
        modal.onDidDismiss().then((data)=>{
            if(data && data.data.isPost && this.Post.commentCount!== undefined){
              this.Post.commentCount++;
               this.buildActions();
            }
        });
        
      }
    
      async sharePost(post: Content) {
        try {
          const shareData = {
          
            text: post.description || 'Regardez ce contenu intéressant',
            url: post.fileUrl //A modifier lorsqu'on aura l'adresse web
          };
    
          if (navigator.share) {
            try {
              await navigator.share(shareData);
              // ✅ Partage réussi - incrémenter le compteur
              this.Post.shareCount = (this.Post.shareCount || 0) + 1;
              
              // Mettre à jour le post via le service
              this.creationService['api'].patch('content', this.Post.id as string, {
                shareCount: this.Post.shareCount
              }).subscribe({
                next: () => {
                  console.log('Share count updated successfully');
                },
                error: (err: any) => {
                  console.error('Error updating share count:', err);
                }
              });
              
              const toast = await this.toastController.create({
                message: 'Contenu partagé !',
                duration: 2000,
                position: 'bottom'
              });
              await toast.present();
            } catch (error: any) {
              // ❌ Partage annulé ou échoué
              if (error.name !== 'AbortError') {
                console.error('Erreur lors du partage:', error);
              }
            }
          } else {
            await this.copyToClipboard(shareData.url);
            const toast = await this.toastController.create({
              message: 'Lien copié dans le presse-papier',
              duration: 2000,
              position: 'bottom'
            });
            await toast.present();
          }
        } catch (error) {
          console.error('Erreur lors du partage:', error);
        }
      }
    
      private async copyToClipboard(text: string): Promise<void> {
        try {
          await navigator.clipboard.writeText(text);
        } catch (err) {
          console.error('Erreur lors de la copie dans le presse-papier:', err);
          const textArea = document.createElement('textarea');
          textArea.value = text;
          document.body.appendChild(textArea);
          textArea.select();
          try {
            document.execCommand('copy');
          } catch (err) {
            console.error('Fallback copy method failed:', err);
          }
          document.body.removeChild(textArea);
        }
      }

       getButtonImage(post: Content, action: any): string {
    // Le vote n'est plus dans les actions, donc cette méthode ne gère plus le cas thumbs-up
    return action.voteIcon;
  }
      //#endregion
    
       private async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color: color
    });
    await toast.present();
  }

}
