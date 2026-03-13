import { Component, OnInit, Input, Output, EventEmitter, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ProfileService } from '../../../services/PROFILE_SERVICE/profile-service';
import { MessageService } from '../../../services/MESSAGE_SERVICE/message-service';
import { UserProfile } from '../../../models/User';
import { Conversation, GroupData } from '../../../models/Conversation';
import { addIcons } from 'ionicons';
import {
  chevronBack,
  checkmark,
  people,
  camera,
  close,
  checkmarkCircle,
  personAdd,
  search
} from 'ionicons/icons';

@Component({
  selector: 'app-modal-create-chat-group',
  templateUrl: './modal-create-chat-group.component.html',
  styleUrls: ['./modal-create-chat-group.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule
  ]
})
export class ModalCreateChatGroupComponent implements OnInit {
  // ─── UI ─────────────────────────────────────────────────────
  currentStep = 1;
  isLoading = false;
  searchQuery = '';
  
  // ─── Données ───────────────────────────────────────────────
  @Input() CurrentUser: UserProfile | null = null;
  @Input() isEditingMode: boolean = false;
  @Input() existingGroup: Conversation | null = null;
  myFans: UserProfile[] = [];
  myFollows: UserProfile[] = [];
  allParticipants: UserProfile[] = [];
  selectedParticipants: UserProfile[] = [];
  initialParticipants: UserProfile[] = []; // Participants initiaux pour le mode édition
  isPrivate: boolean = false;
  isAdminOnly: boolean = false;
  // ─── Formulaire ─────────────────────────────────────────────
  groupForm: FormGroup;
  groupAvatar: File | null = null;
  groupAvatarPreview: string | null = null;
  
  // ─── Événements ───────────────────────────────────────────
  @Output() groupCreated = new EventEmitter<Conversation>();

  @ViewChild('avatarInput') avatarInput!: ElementRef<HTMLInputElement>;

  constructor(
    private modalController: ModalController,
    private profileService: ProfileService,
    private messageService: MessageService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.groupForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(30)]],
      description: ['', Validators.maxLength(200)]
    });
    
    // Initialiser les icônes
    addIcons({
      chevronBack,
      checkmark,
      people,
      camera,
      close,
      checkmarkCircle,
      personAdd,
      search
    });
  }

  async ngOnInit() {
    await this.loadUserData();
  }

  // ==============================================================
  //  CHARGEMENT DES DONNÉES
  // ==============================================================
  
  private async loadUserData() {
    try {
      this.isLoading = true;
      
      if (this.CurrentUser) {
        if (this.isEditingMode && this.existingGroup) {
          // Mode édition : charger les participants du groupe existant
          await this.loadExistingGroupData();
        } else {
          // Mode création : charger les fans et follows pour invitation
          const [fansResult, followsResult] = await Promise.all([
            this.profileService.searchUserIdInMyFollows(this.CurrentUser.id).toPromise(),
            this.profileService.getProfileById(this.CurrentUser.id).toPromise()
          ]);
          
          // Récupérer les profils des fans
          const fans = fansResult?.results || [];
          
          // Récupérer les profils des follows depuis myFollows
          let follows: UserProfile[] = [];
          if (followsResult?.myFollows && followsResult.myFollows.length > 0) {
            follows = await this.profileService.getProfilesByIds(followsResult.myFollows).toPromise() || [];
          }
          
          this.myFans = fans;
          this.myFollows = follows;
          this.allParticipants = [...fans, ...follows];
          
          // Filtrer les doublons
          this.allParticipants = this.allParticipants.filter((user, index, self) => 
            index === self.findIndex(u => u.id === user.id)
          );
        }
      }
      
      this.isLoading = false;
      this.cdr.markForCheck();
    } catch (error) {
      console.error('[ModalCreateChatGroup] Load user data error:', error);
      this.isLoading = false;
    }
  }

  /**
   * Charge les données du groupe existant pour le mode édition
   */
  private async loadExistingGroupData() {
    if (!this.existingGroup?.groupData) return;

    const groupData = this.existingGroup.groupData;
    
    // Pré-remplir le formulaire avec les données du groupe
    this.groupForm.patchValue({
      name: groupData.name || '',
      description: groupData.description || ''
    });
    
    // Pré-remplir les options
    this.isPrivate = groupData.isPrivate || false;
    this.isAdminOnly = groupData.isOnlyAdmin || false;
    
    // Charger l'avatar si existant
    if (groupData.avatar && typeof groupData.avatar === 'string') {
      this.groupAvatarPreview = groupData.avatar;
    }
    
    // Charger les participants du groupe
    if (groupData.participants && groupData.participants.length > 0) {
      const participantProfiles = await this.profileService.getProfilesByIds(groupData.participants).toPromise() || [];
      this.allParticipants = participantProfiles;
      this.selectedParticipants = participantProfiles;
      this.initialParticipants = [...participantProfiles]; // Garder une copie pour comparaison
    }
  }
  
  // ==============================================================
  //  GESTION DES ÉTAPES
  // ==============================================================

  /**
   * Passe à l'étape suivante
   */
  nextStep() {
    if (this.currentStep < 3) {
      this.currentStep++;
      this.cdr.markForCheck();
    }
  }

  /**
   * Reviens à l'étape précédente
   */
  previousStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.cdr.markForCheck();
    }
  }

  // ==============================================================
  //  ÉTAPE 1: SÉLECTION DES PARTICIPANTS
  // ==============================================================

  /**
   * Filtre les participants selon la recherche
   */
  get filteredParticipants(): UserProfile[] {
    if (!this.searchQuery.trim()) {
      return this.allParticipants;
    }
    
    const query = this.searchQuery.toLowerCase().trim();
    return this.allParticipants.filter(user => 
      user.username?.toLowerCase().includes(query) ||
      user.userInfo?.first_name?.toLowerCase().includes(query) ||
      user.userInfo?.last_name?.toLowerCase().includes(query)
    );
  }

  /**
   * Vérifie si un participant est sélectionné
   */
  isParticipantSelected(userId: string): boolean {
    return this.selectedParticipants.some(p => p.id === userId);
  }

  /**
   * Bascule la sélection d'un participant
   */
  toggleParticipantSelection(participant: UserProfile) {
    const index = this.selectedParticipants.findIndex(p => p.id === participant.id);
    
    if (index === -1) {
      this.selectedParticipants.push(participant);
    } else {
      this.selectedParticipants.splice(index, 1);
    }
    
    this.cdr.markForCheck();
  }

  /**
   * Vérifie si on peut passer à l'étape 2
   */
  canGoToStep2(): boolean {
    return this.selectedParticipants.length >= 1; // Au moins 1 participant
  }

  // ==============================================================
  //  ÉTAPE 2: CONFIGURATION DU GROUPE
  // ==============================================================

  /**
   * Gère le changement d'avatar
   */
  onAvatarChange(event: any) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      this.groupAvatar = file;
      
      // Créer un aperçu
      const reader = new FileReader();
      reader.onload = (e) => {
        this.groupAvatarPreview = e.target?.result as string;
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(file);
    }
  }

  /**
   * Supprime l'avatar
   */
  removeAvatar() {
    this.groupAvatar = null;
    this.groupAvatarPreview = null;
    this.cdr.markForCheck();
  }

  /**
   * Déclenche le clic sur l'input file
   */
  triggerAvatarInput() {
    if (this.avatarInput) {
      this.avatarInput.nativeElement.click();
    }
  }

  /**
   * Vérifie si on peut passer à l'étape 3
   */
  canGoToStep3(): boolean {
    return this.groupForm.valid && this.selectedParticipants.length >= 1;
  }

  // ==============================================================
  //  ÉTAPE 3: ENVOI DES INVITATIONS
  // ==============================================================

  /**
   * Crée ou met à jour le groupe
   */
  async createGroup() {
    if (!this.CurrentUser || !this.groupForm.valid || this.selectedParticipants.length === 0) {
      return;
    }

    try {
      this.isLoading = true;

      // Préparer les données du groupe
      const groupData: GroupData = {
        name: this.groupForm.get('name')?.value,
        description: this.groupForm.get('description')?.value,
        participants: [this.CurrentUser.id, ...this.selectedParticipants.map(p => p.id)],
        admins: [this.CurrentUser.id], // Créateur admin par défaut
        isPrivate: this.isPrivate,
        isOnlyAdmin: this.isAdminOnly
      };

      // Uploader l'avatar si présent
      if (this.groupAvatar) {
        const uploadResult = await this.messageService.uploadFile(
          this.groupAvatar, 
          this.groupAvatar.name, 
          'group-avatar'
        ).toPromise();
        
        if (uploadResult) {
          groupData.avatar = uploadResult.url;
        }
      } else if (this.groupAvatarPreview && !this.groupAvatar) {
        // Conserver l'avatar existant si pas de nouveau fichier
        groupData.avatar = this.groupAvatarPreview;
      }

      let result: Conversation;

      if (this.isEditingMode && this.existingGroup) {
        // Mode édition : mettre à jour le groupe existant
        const updatedConversation: Conversation = {
          ...this.existingGroup,
          groupData,
          participantIds: groupData.participants
        };

        // Utiliser updateConversation pour la mise à jour
        result = await this.messageService.updateConversation(updatedConversation).toPromise() || updatedConversation;
      } else {
        // Mode création : créer nouvelle conversation
        const newConversation: Conversation = {
          id: `group-${Date.now()}`,
          groupData,
          participantIds: groupData.participants,
          messages: [],
          status: 'open',
          createdAt: new Date()
        };

        result = await this.messageService.createConversation(newConversation).toPromise() || newConversation;
      }

      // Émettre l'événement approprié
      if (this.isEditingMode) {
        this.groupCreated.emit(result);
      } else {
        this.groupCreated.emit(result);
      }
      
      // Fermer le modal
      await this.closeModal(true);
      
    } catch (error) {
      console.error('[ModalCreateChatGroup] Group operation error:', error);
      // TODO: Afficher une erreur à l'utilisateur
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  // ==============================================================
  //  NAVIGATION MODAL
  // ==============================================================

  /**
   * Ferme le modal
   */
  async closeModal(success: boolean = false) {
    await this.modalController.dismiss({
      success,
      groupCreated: success
    });
  }
}