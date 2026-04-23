import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { NgIf, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { CameraService, MediaFile } from 'src/services/CAMERA/camera-service';
import { addIcons } from 'ionicons';
import * as bcrypt from 'bcryptjs';
import {
  shareSocialOutline,
  ellipsisVertical,
  addCircle,
  banOutline,
  flagOutline,
  checkmarkCircle,
  logOutOutline,
  keyOutline,
  star,
  linkOutline,
  calendarOutline,
  close,
  heart,
  warning,
  createOutline,
  settingsOutline,
  eyeOffOutline,
  giftOutline,
  imagesOutline,
  arrowForwardOutline,
  chevronForwardOutline,
  addOutline,
  checkmarkCircleOutline,
  musicalNotesOutline,
  search,
  trophy,
  chevronBackOutline,
  ellipsisHorizontal,
  checkmark,
  videocamOutline,
  eyeOutline,
  locationOutline,
  logoInstagram,
  logoTwitter,
  logoYoutube,
  globeOutline,
  chatbubbleOutline,
  personCircleOutline,
  walletOutline,
  homeOutline,
  compassOutline, cameraOutline, wifiOutline, refreshOutline
} from 'ionicons/icons';
import {
  IonImg,
  IonContent,
  IonButton,
  IonIcon, IonSpinner
} from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { ActionSheetController, AlertController, ToastController, LoadingController } from '@ionic/angular';
import { UserProfile } from 'src/models/User.js';
import { Content, ContentStatus } from 'src/models/Content.js';
import { ProfileService } from 'src/services/Service_profile/profile-service.js';
import { Auth } from 'src/services/AUTH/auth';
import { MediaUrlPipe } from '../utils/pipes/mediaUrlPipe/media-url-pipe';
import { ModalEditProfileComponent } from '../components/modal-edit-profile/modal-edit-profile.component.js';
import { ShortNumberPipe } from '../utils/pipes/shortNumberPipe/short-number-pipe.js';
import { FollowedViewComponent } from '../tab-home/containers/followed-panel/followed-view.component.js';
import { ModalFollowingComponent } from '../components/modal-following/modal-following.component.js';
import { HeaderComponentComponent } from '../components/header-component/header-component.component.js';
import { SettingsPage } from '../settings/settings.page.js';
import { UserService } from 'src/services/Service_user/user-service.js';
import { getRewardsForUserType } from 'src/interfaces/levelReward.data';
import { LevelRewardsComponent } from '../components/level-rewards-component/level-rewards-component.component';
import { AwardsGalleryComponent } from '../components/awards-gallery/awards-gallery.component';
import { RewardService } from 'src/services/Rewards/reward-service';
import { LevelReward } from 'src/models/LevelReward';
import { TransactionHistoryModalComponent } from '../components/modal-transaction-history/transaction-history-modal.component';
import { CreationService } from 'src/services/Service_content/creation-service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  providers: [ModalController],
  imports: [IonSpinner, NgIf,
    IonContent, IonButton,
    IonIcon, HeaderComponentComponent, IonImg,
    CommonModule, FormsModule, MediaUrlPipe, ShortNumberPipe
  ]
})
export class ProfilePage implements OnInit {

  // Définition des propriétés
  isOwnProfile: boolean = false;
  isLoading: boolean = false;
  isChangingCover: boolean = false;
  userProfile!: UserProfile;
  currentUserId: string | null = null;
  isBlocked: boolean = false;
  userContents: Content[] = [];
  isLoadingContents = false;
  isLess: boolean = true;
  pastAwards!: LevelReward[];
  reachedCount!: number;


  constructor(
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private profileService: ProfileService,
    private creationService: CreationService,
    private userService: UserService,
    private authservice: Auth,
    private rewardService: RewardService,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private toastController: ToastController,
    private actionSheetController: ActionSheetController,
    private modalCtrl: ModalController,
    private cameraService: CameraService) {
    this.userProfile = {} as UserProfile;
    this.userProfile.myFollows = [];
    this.userProfile.stats = {} as {
      posts: 0;
      fans: 0;
      votes: 0;
      stars: 0;
    };
    this.userProfile.userInfo = {} as any;
    this.userProfile.userInfo.memberShip = {} as any;
    this.pastAwards = [];
    addIcons({ cameraOutline, checkmark, settingsOutline, locationOutline, linkOutline, giftOutline, chevronForwardOutline, eyeOutline, imagesOutline, wifiOutline, refreshOutline, shareSocialOutline, ellipsisVertical, addCircle, banOutline, flagOutline, checkmarkCircle, logOutOutline, keyOutline, star, calendarOutline, close, heart, warning, createOutline, arrowForwardOutline, addOutline, checkmarkCircleOutline, musicalNotesOutline, search, trophy, chevronBackOutline, ellipsisHorizontal, videocamOutline, logoInstagram, logoTwitter, logoYoutube, globeOutline, chatbubbleOutline, personCircleOutline, homeOutline, compassOutline, eyeOffOutline, walletOutline });
  }

  ngOnInit() {
    const currentUser = this.authservice.getCurrentUser();
    this.currentUserId = currentUser?.id?.toString() || null;
    const param_id = this.route.snapshot.paramMap.get('id');

    if (param_id) {
      this.isOwnProfile = false;
      this.loadUserProfile(param_id);
      this.loadUserContents(param_id);
    } else {
      this.isOwnProfile = true;
      this.loadUserProfile(this.currentUserId as string);
      this.loadUserContents(this.currentUserId as string);
    }
  }

  async changeCover() {
    if (!this.isOwnProfile) return;
    try {
      // Utiliser le CameraService pour choisir une image depuis la galerie
      const mediaFile: MediaFile | null = await this.cameraService.pickSingle();

      if (mediaFile && mediaFile.file) {
        // Valider le ratio de l'image (doit être 16:9)
        const isValidRatio = await this.validateImageRatio(mediaFile.file, 16, 9);

        if (!isValidRatio) {
          this.showToast('L\'image doit avoir un ratio de 16:9', 'warning');
          return;
        }

        if (mediaFile.file.size > 1 * 1024 * 1024) {
          mediaFile.file = await this.cameraService.compressImage(mediaFile.file, 2048, 0.85);
        }

        // Démarrer le chargement
        this.isChangingCover = true;
        this.cdr.detectChanges();

        // Utiliser la méthode uploadCoverImage du ProfileService avec le fichier
        const result = await this.profileService.uploadCoverImage(
          this.userProfile.id,
          mediaFile.file
        ).toPromise();
        console.log("result : ",result);
        // Le profil est déjà mis à jour en base par uploadCoverImage, 
        // on met juste à jour l'affichage local
        this.userProfile.coverImg = result?.url || "";

        // Arrêter le chargement
        this.isChangingCover = false;
        this.cdr.detectChanges();

        // Afficher un message de succès
        this.showToast('Photo de couverture mise à jour avec succès', 'success');
      }
    } catch (error) {
      // Arrêter le chargement en cas d'erreur
      this.isChangingCover = false;
      this.cdr.detectChanges();

      console.error('Erreur lors du changement de la photo de couverture:', error);
      this.showToast('Erreur lors de la mise à jour de la photo de couverture', 'danger');
    }
  }

  /**
   * Valide que le ratio de l'image correspond au ratio attendu
   * @param width Largeur de l'image
   * @param height Hauteur de l'image
   * @param targetWidth Largeur cible (ex: 16)
   * @param targetHeight Hauteur cible (ex: 9)
   * @returns boolean true si le ratio est valide (avec petite tolérance)
   */
  private async validateImageRatio(file: File, targetWidth: number, targetHeight: number): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        const currentRatio = width / height;
        const targetRatio = targetWidth / targetHeight;

        // On garde ta tolérance de 5%
        const tolerance = 0.05;
        const isValid = currentRatio >= targetRatio * (1 - tolerance) &&
          currentRatio <= targetRatio * (1 + tolerance);

        // Nettoyage mémoire
        URL.revokeObjectURL(img.src);
        resolve(isValid);
      };

      img.onerror = () => resolve(false);
      img.src = URL.createObjectURL(file);
    });
  }

  async toggleFollow() {
    if (!this.currentUserId || !this.userProfile) return;
    this.isLoading = true;

    try {
      let result;
      if (this.userProfile.isFollowing) {
        result = await this.profileService.unfollowProfile(this.currentUserId, this.userProfile.id);
      } else {
        result = await this.profileService.followProfile(this.currentUserId, this.userProfile.id);
      }

      if (result) {
        this.userProfile.isFollowing = !this.userProfile.isFollowing;
        if (result.profile) {
          this.userProfile.stats = this.userProfile.stats || { fans: 0, following: 0 };
          this.userProfile.stats.fans = result.profile.stats?.fans || 0;
        }
      }
    } catch (err) {
      console.error('Erreur lors de la mise à jour du suivi', err);
      await this.showToast('Erreur lors de la mise à jour du suivi', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  async openSettings() {
    const currentUser = this.authservice.getCurrentUser();

    if (!currentUser || !this.userProfile) {
      console.error('Utilisateur ou profil non disponible pour les paramètres');
      return;
    }

    const modal = await this.modalCtrl.create({
      component: SettingsPage,
      cssClass: 'auto-height',
      initialBreakpoint: 0.75,
      breakpoints: [0, 0.75, 1],
      handle: true
    });

    await modal.present();
  }

  async loadUserProfile(userId: string) {
    if (!userId) {
      this.router.navigate(['/login']);
      return;
    }

    this.isLoading = true;

    try {
      const profile = await this.profileService.getProfileById(userId).toPromise();
      if (!profile) {
        throw new Error('Profil non trouvé');
      }
      if (this.currentUserId !== profile.id) {
        const myUserProfile = await this.profileService.getProfileById(this.currentUserId as string).toPromise();
        profile.isFollowing = myUserProfile?.myFollows.some((id) => id == profile.id) || false;
        this.isBlocked = myUserProfile?.myBlackList.some((id) => id == profile.id) || profile.myBlackList.some((id) => id == myUserProfile?.id) || false;
      }

      this.userProfile = profile;
      this.isOwnProfile = this.currentUserId === userId;

      // Charger les informations XP une seule fois après le chargement du profil
      this.resolveNextXp();
      this.getCollectedReward();
      this.cdr.detectChanges();

    } catch (error) {
      console.error('Erreur lors du chargement du profil:', error);
      this.router.navigate(['/home']);
    } finally {
      this.isLoading = false;
    }
  }

  async loadUserContents(userId: string){
    if(!this.isBlocked){
     
      const contents = await this.creationService
        .getContents({ userId: userId, status: ContentStatus.PUBLISHED }, { cache: false })
        .toPromise();

   
      if(contents){
       
        this.userContents = contents;
      }
    }
  }

  isVideo(post: Content): boolean {
      if (!post.fileUrl) return false;
      const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv'];
      return videoExtensions.some(ext => post.fileUrl!.toLowerCase().includes(ext));
    }
  /**
   * XP Management
   */

  async getCollectedReward() {
    if (!this.userProfile || !this.userProfile.id) {
      console.error('Aucun profil utilisateur trouvé');
      return;
    }
    try {
      const rewards = await this.rewardService.getCollectedRewards(this.userProfile.id).toPromise();
      this.pastAwards = rewards?.reverse() || [];
      if (this.pastAwards.length > 0) {
        const reachedby = await this.rewardService.getCollectedRewardsTotalCount(this.pastAwards[0].name, this.userProfile.xpPercent).toPromise();
        this.reachedCount = reachedby || 0;
      }
    } catch (error) {
      console.error('Erreur lors de l\'ouverture des récompenses debloquer:', error);
      await this.showToast('Erreur lors du chargement des récompenses debloquer', 'danger');
    }
  }
  async openLevelReward() {
    if (!this.userProfile || !this.userProfile.id) {
      console.error('Aucun profil utilisateur trouvé');
      return;
    }

    try {
      // Récupérer les récompenses calculées via le RewardService
      const userRewards = await this.rewardService.getCalculatedRewards(this.userProfile.id).toPromise();

      if (!userRewards) {
        console.error('Impossible de récupérer les récompenses');
        return;
      }

      const modal = await this.modalCtrl.create({
        component: LevelRewardsComponent,
        componentProps: {
          userXp: this.userProfile.xpPercent,
          userType: this.userProfile.type,
          currentLevel: this.userProfile.level,
          rewards: userRewards // 🎯 Transmettre les rewards du service
        },
        cssClass: 'auto-height',
        initialBreakpoint: 0.95,
        breakpoints: [0, 0.95, 1],
        handle: true
      });

      await modal.present();
    } catch (error) {
      console.error('Erreur lors de l\'ouverture des récompenses de niveau:', error);
      await this.showToast('Erreur lors du chargement des récompenses', 'danger');
    }
  }

  // XP requis pour passer au niveau suivant (à brancher sur votre modèle réel)
  xpPercentRequired: number = 0;

  private resolveNextXp(): void {
    if (!this.userProfile || !this.userProfile.id) {
      this.xpPercentRequired = 0;
      return;
    }

    // Récupérer les récompenses via le service
    this.rewardService.getUserRewards(this.userProfile.id).subscribe(rewards => {
      const next = rewards.find(r =>
        this.userProfile.level && r.level === this.userProfile.level + 1
      );
      this.xpPercentRequired = next?.xpRequired ?? 0;
    }, error => {
      console.error('Erreur lors de la récupération des récompenses pour resolveNextXp:', error);
      this.xpPercentRequired = 0;
    });
  }
  /**
   * Retourne le pourcentage de remplissage de la pill (0–100).
   * = xpPercent de l'utilisateur − xpPercent requis pour le niveau en cours,
   *   normalisé entre 0 et 100, clampé pour rester dans les bornes.
   */
  getXpFillPercent(): number {
    // NE PAS appeler resolveNextXp() ici - déjà appelé dans loadUserProfile
    const current = this.userProfile?.xpPercent ?? 0;
    const required = this.xpPercentRequired ?? 0;
    const fill = current - required;
    return Math.min(100, Math.max(0, fill));
  }

  async OpenAwards() {

    const modal = await this.modalCtrl.create({
      component: AwardsGalleryComponent,
      cssClass: 'auto-height',
      initialBreakpoint: 0.95,
      breakpoints: [0, 0.95, 1],
      handle: true
    });

    await modal.present();
  }


  async presentMoreOptions() {
    const isOwnProfile = this.userProfile?.id === this.authservice.getCurrentUser()?.id;
    const buttons = [];

    if (isOwnProfile) {
      buttons.push(
        {
          text: 'Mes Transactions',
          icon: 'wallet-outline',
          handler: async () => {
            try {
              const modal = await this.modalCtrl.create({
                component: TransactionHistoryModalComponent,
                cssClass: 'auto-height',
                initialBreakpoint: 0.95,
                breakpoints: [0, 0.95, 1],
                handle: true
              });

              await modal.present();
            } catch (error) {
              console.error('Erreur lors de l\'ouverture de la modale following:', error);
              await this.showToast('Erreur lors du chargement des abonnements', 'danger');
            }
          }
        },
        {
          text: 'BlackList',
          icon: 'eye-off-outline',
          handler: () => {
            this.modalCtrl.dismiss();
            this.router.navigate(['/blacklist']);
          }
        },
        {
          text: 'Modifier le profil',
          icon: 'create-outline',
          handler: () => this.editProfile()
        },
        {
          text: 'Changer le mot de passe',
          icon: 'key-outline',
          handler: () => this.changePassword()
        },
        {
          text: 'Deconnexion',
          icon: 'log-out-outline',
          handler: () => this.logout()
        }
      );
    } else {
      buttons.push(
        {
          text: 'Signaler',
          icon: 'flag-outline',
          role: 'destructive',
          handler: () => this.reportUser()
        },
        {
          text: this.isBlocked ? 'Debloquer' : 'Bloquer',
          icon: 'ban-outline',
          role: 'destructive',
          handler: () => this.blockUser(this.isBlocked)
        }
      );
    }

    buttons.push(
      {
        text: 'Partager le profile',
        icon: 'share-social-outline',
        handler: () => this.shareProfile(this.userProfile)
      },
      {
        text: 'Copier le lien',
        icon: 'link-outline',
        handler: () => this.copyProfileLink(this.userProfile)
      },
      {
        text: 'Annuler',
        icon: 'close',
        role: 'cancel'
      }
    );

    const actionSheet = await this.actionSheetController.create({
      header: isOwnProfile ? 'Options du profil' : 'Options',
      buttons: buttons
    });

    await actionSheet.present();
  }

  async logout() {
    const alert = await this.alertController.create({
      header: 'Se déconnecter',
      message: 'Êtes-vous sûr de vouloir vous déconnecter ?',
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel',
        },
        {
          text: 'Déconnexion',
          handler: async () => {
            const loading = await this.loadingController.create({
              message: 'Déconnexion en cours...',
              spinner: 'crescent',
              cssClass: 'logout-loading'
            });

            await loading.present();

            try {
              this.authservice.logout();
              await new Promise(resolve => setTimeout(resolve, 800));

              await loading.dismiss();
              window.location.href = '/login';

            } catch (error) {
              await loading.dismiss();
              console.error('Erreur lors de la déconnexion:', error);
              await this.showToast('Erreur lors de la déconnexion', 'danger');
            }
          },
        },
      ],
    });

    await alert.present();
  }

  async changePassword() {
    const alert = await this.alertController.create({
      header: 'Changer le mot de passe',
      message: 'Vous allez recevoir un email pour réinitialiser votre mot de passe.',
      inputs: [
        {
          name: 'currentPassword',
          type: 'password',
          placeholder: 'Mot de passe actuel',
        },
        {
          name: 'newPassword',
          type: 'password',
          placeholder: 'Nouveau mot de passe',
        },
        {
          name: 'confirmPassword',
          type: 'password',
          placeholder: 'Confirmer le mot de passe',
        },
      ],
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel',
        },
        {
          text: 'Modifier',
          handler: (data) => {
            if (data.newPassword !== data.confirmPassword) {
              this.showToast('Les mots de passe ne correspondent pas', 'danger');
              return false;
            }
            // Appel API pour changer le mot de passe
            this.handlePasswordChange(data.currentPassword, data.newPassword);
            return true;
          },
        },
      ],
    });

    await alert.present();
  }

  private async handlePasswordChange(currentPassword: string, newPassword: string) {
    try {
      const user = await this.userService.getUserById(this.currentUserId as string).toPromise();
      if (!user) {
        this.showToast('Erreur: utilisateur non trouvé', 'danger');
        return;
      }

      if (!user.password_hash) {
        //console.error('❌ PASSWORD_HASH MANQUANT');
        this.showToast('Erreur: hash du mot de passe non disponible', 'danger');
        return;
      }

      // 1. Vérifier que le hash bcrypt du currentPassword correspond au password_hash du User
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);

      if (!isPasswordValid) {
        this.showToast('Mot de passe actuel incorrect', 'danger');
        return;
      }

      // 2. Si le mot de passe est valide, hasher le nouveau mot de passe
      const saltRounds = await bcrypt.genSalt(10);
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // 3. Utiliser updatePasswordHash de UserService pour mettre à jour le mot de passe
      const result = await this.userService.updatePasswordHash(user.id as string, newPasswordHash).toPromise();

      // 4. Mettre à jour le user local avec le nouveau hash
      user.password_hash = newPasswordHash;

      this.showToast('Mot de passe modifié avec succès', 'success');
    } catch (error) {
      console.error('❌ Erreur lors du changement de mot de passe:', error);
      console.error('❌ STACK TRACE:', (error as any)?.stack);

      // Message d'erreur plus spécifique
      let errorMessage = 'Erreur lors du changement de mot de passe';
      if ((error as any)?.message?.includes('bcrypt')) {
        errorMessage = 'Erreur lors du hashage du mot de passe';
      } else if ((error as any)?.status) {
        errorMessage = `Erreur serveur: ${(error as any).status}`;
      }

      this.showToast(errorMessage, 'danger');
    }
  }



  private async editProfile() {
    const modal = await this.modalCtrl.create({
      component: ModalEditProfileComponent,
      componentProps: {
        profile: this.userProfile
      },
      cssClass: 'auto-height',
      initialBreakpoint: 0.9,
      breakpoints: [0, 0.9, 1]
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();

    if (data?.success && data?.profile) {
      this.userProfile = data.profile;
      this.cdr.detectChanges();

      const toast = await this.toastController.create({
        message: 'Profil mis à jour avec succès',
        duration: 2000,
        position: 'bottom',
        color: 'success'
      });
      await toast.present();
    }
  }
  private async reportUser() {
    const alert = await this.alertController.create({
      header: 'Signaler un utilisateur',
      message: 'Pourquoi souhaitez-vous signaler cet utilisateur ?',
      inputs: [
        {
          name: 'reason',
          type: 'text',
          placeholder: 'Raison du signalement'
        }
      ],
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Envoyer',
          handler: (data) => {
            if (data.reason) {
              console.log('Signalement envoyé :', data.reason);
              this.showToast('Signalement envoyé avec succès', 'success');
              return true;
            } else {
              this.showToast('Veuillez indiquer une raison', 'warning');
              return false;
            }
          }
        }
      ]
    });
    await alert.present();
  }

  private async blockUser(status: boolean) {
    const alert = await this.alertController.create({
      header: 'Confirmer',
      message: `Voulez-vous vraiment ${status ? 'bloquer' : 'débloquer'} cet utilisateur ?`,
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: status ? 'Bloquer' : 'Débloquer',
          role: 'destructive',
          handler: async () => {
            if (!this.userProfile) return;

            try {
              if (!status) {
                await this.profileService.unfollowProfile(String(this.currentUserId), String(this.userProfile.id));
                await this.profileService.blackListProfile(String(this.currentUserId), String(this.userProfile.id));
                this.showToast('Utilisateur bloqué avec succès', 'success');
              } else {
                await this.profileService.unblackListProfile(String(this.currentUserId), String(this.userProfile.id));
                this.showToast('Utilisateur débloqué avec succès', 'success');
              }
              await this.loadUserProfile(String(this.userProfile.id));
            } catch (error) {
              console.error('Erreur lors du blocage:', error);
              this.showToast('Erreur lors de l\'opération', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  copyProfileLink(profile: UserProfile) {
    const link = `https://datafire-681e8.firebaseapp.com/profile/${profile.id}`;
    navigator.clipboard.writeText(link);
    console.log('Link copied:', link);
  }

  async shareProfile(profile: UserProfile) {
    const shareData = {
      title: `${profile.displayName} - Best Academy`,
      text: `Découvrez le profil de ${profile.displayName}${profile.userInfo?.bio ? ': ' + profile.userInfo.bio : ''}`,
      url: `https://datafire-681e8.firebaseapp.com/profile/${profile.id}`
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        console.log('Profile shared successfully');
      } else {
        await this.copyProfileLink(profile);
        await this.showToast('Lien du profil copié dans le presse-papiers', 'success');
      }
    } catch (error: unknown) {
      console.error('Error sharing profile:', error);

      const errorName = error instanceof Error ? error.name : 'UnknownError';
      if (errorName !== 'AbortError') {
        await this.copyProfileLink(profile);
        await this.showToast('Lien du profil copié dans le presse-papiers', 'success');
      }
    }
  }

  async openContent(content: Content) {
    if (!content) {
      console.error('Content not found for item:', content);
      return;
    }

    const myUserProfile = await this.profileService.getProfileById(this.currentUserId as string).toPromise();
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

  onImageAvatarError(event: any) {
    const imgElement = event.target as HTMLImageElement;
    imgElement.onerror = null;
    imgElement.src = 'assets/avatar-default.png';
    imgElement.classList.add('is-default');
  }

  onImageCover(event: any) {
    const imgElement = event.target as HTMLImageElement;
    imgElement.onerror = null;
    imgElement.src = 'assets/default-thumbnail.jpg';
    imgElement.classList.add('is-default');
  }


  onImageContentError(event: any) {
    const imgElement = event.target as HTMLImageElement;
    imgElement.onerror = null;
    imgElement.src = 'assets/splash.png';
    imgElement.classList.add('is-default');
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      position: 'top',
      color,
      cssClass: 'custom-toast',
    });
    await toast.present();
  }

  /**
   * Ouvre la modale des abonnements (following/fans)
   */
  async openModalFollowing() {
    if (!this.userProfile || !this.userProfile.id) {
      console.error('Aucun profil utilisateur trouvé');
      return;
    }

    try {
      const modal = await this.modalCtrl.create({
        component: ModalFollowingComponent,
        componentProps: {
          CurrentUserId: this.userProfile.id
        },
        cssClass: 'auto-height',
        initialBreakpoint: 0.95,
        breakpoints: [0, 0.95, 1],
        handle: true
      });

      await modal.present();
    } catch (error) {
      console.error('Erreur lors de l\'ouverture de la modale following:', error);
      await this.showToast('Erreur lors du chargement des abonnements', 'danger');
    }
  }


}