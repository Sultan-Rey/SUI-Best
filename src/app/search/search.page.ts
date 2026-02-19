import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MediaUrlPipe } from '../utils/pipes/mediaUrlPipe/media-url-pipe';
import { ShortNumberPipe } from '../utils/pipes/shortNumberPipe/short-number-pipe';
import { 
  IonContent, 
  IonHeader, 
  IonTitle, 
  IonToolbar,
  IonSearchbar,
  IonIcon,
  IonSkeletonText,
  IonButtons,
  IonBackButton,
  IonButton } from '@ionic/angular/standalone';
import { ProfileService } from '../../services/PROFILE_SERVICE/profile-service';
import { UserProfile } from '../../models/User';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import { searchOutline, personOutline, chevronForwardOutline, chevronForward, checkmarkCircle } from 'ionicons/icons';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { ModalConversationComponent } from '../components/modal-conversation/modal-conversation.component';
import { MessageService } from 'src/services/MESSAGE_SERVICE/message-service';
import { SocketService } from '../../services/SOCKET/socket-service';
@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss'],
  standalone: true,
  providers: [ModalController],
  imports: [IonButton, 
    IonContent, 
    IonHeader, 
    IonTitle, 
    IonToolbar,
    IonSearchbar,
    IonIcon,
    IonSkeletonText,
    IonButtons,
    IonBackButton,
    CommonModule, 
    FormsModule,
    ShortNumberPipe,
    MediaUrlPipe
  ]
})
export class SearchPage implements OnInit, OnDestroy, AfterViewInit {
  searchQuery = '';
  searchResults: UserProfile[] = [];
  isLoading = false;
  suggestionString:string = 'Profils populaires';
  searchSuggestions: UserProfile[] = [];
  @Input() currentUserId!:string;
  @Input() IsModal = false;
  private subscriptions: Subscription[] = [];
  
  @ViewChild('searchBar', { static: false }) searchBar!: IonSearchbar;

  constructor(private profileService: ProfileService, private messageService: MessageService,
    private socketService: SocketService, private router: Router, private modalController: ModalController) {
    addIcons({checkmarkCircle,chevronForward,chevronForwardOutline,personOutline,searchOutline});
  }

  ngOnInit() {
    this.suggestionString = this.IsModal ? 'Suggestions' : 'Profils populaires';
    this.setupSearchListeners();
    const limit = this.IsModal ? 2 : 5;
    this.loadSearchSuggestions(limit);
  }

  ngAfterViewInit() {
    // Focus automatique sur le champ de recherche après le chargement de la vue
    setTimeout(() => {
      if (this.searchBar) {
        this.searchBar.setFocus();
      }
    }, 100);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ==================== */
  //    SEARCH SETUP      */
  // ==================== */

  private setupSearchListeners() {
    // Écouter les résultats de recherche en temps réel
    this.subscriptions.push(
      this.profileService.getSearchResults().subscribe(results => {
        this.searchResults = results;
        this.isLoading = false;
      })
    );

    // Écouter la requête de recherche actuelle
    this.subscriptions.push(
      this.profileService.getSearchQuery().subscribe(query => {
        this.searchQuery = query;
        this.isLoading = query.length >= 2;
      })
    );
  }

  // ==================== */
  //    SEARCH ACTIONS    */
  // ==================== */

  onSearchInput(event: any) {
    const query = event.target.value;
    this.profileService.updateSearchQuery(query);
  }

  onSearchClear() {
    this.profileService.clearSearch();
    this.searchResults = [];
  }

  // ==================== */
  //    SUGGESTIONS      */
  // ==================== */

  private loadSearchSuggestions(limit: number) {
    this.subscriptions.push(
      this.profileService.getSearchSuggestions(limit).subscribe(suggestions => {
        this.searchSuggestions = suggestions;
      })
    );
  }

  // ==================== */
  //    NAVIGATION       */
  // ==================== */

  back() {
    if (this.IsModal) {
      this.modalController.dismiss();
    } else {
      window.history.back();
    }
  }

  async goToProfile(profile: UserProfile) {
    // Navigation vers le profil
    if (this.IsModal) {
      // Fermer le modal de recherche
      await this.modalController.dismiss();
      
      // Rechercher s'il existe une conversation entre les deux utilisateurs
      const conversationId = await this.messageService.findExistingConversationId([this.currentUserId, profile.id], this.currentUserId).toPromise();
      
      // Si la conversation existe, vérifier/créer le socket et réinitialiser les pings
      if (conversationId) {
        await this.initializeOrUpdateSocket(conversationId, [this.currentUserId, profile.id]);
      }

      // Ouvrir ModalConversationComponent pour une nouvelle conversation
      const modal = await this.modalController.create({
        component: ModalConversationComponent,
       componentProps: {
               conversationId: conversationId || "default-id",
               currentUserId: this.currentUserId,
               otherUser: {
                isVerified: profile.isVerified,
                username: profile.displayName,
               avatar: profile.avatar,
               receiverId: profile.id
               }},
        presentingElement: await this.modalController.getTop()
      });

      await modal.present();
    } else {
      this.router.navigate(['/profile', profile.id]);
    }
  }

  /**
   * Initialise ou met à jour le socket pour une conversation existante
   */
  private async initializeOrUpdateSocket(conversationId: string, participantIds: string[]) {
    try {
      // Vérifier si le socket existe
      const existingSocket = await this.socketService.socketFind(conversationId).toPromise();
      
      if (existingSocket) {
        // Socket existe : réinitialiser les pings à 0 pour tous les participants
        console.log('[SearchPage] Socket exists, resetting pings to 0');
        
        // Mettre à jour le socket avec tous les pings à 0
        const updatedSocket = {
          ...existingSocket,
          socket: existingSocket.socket.map(participant => ({
            ...participant,
            ping: 0
          })),
          last_update: new Date().toISOString()
        };
        
        await this.socketService.socketPing(conversationId, participantIds[0], 0).toPromise();
        await this.socketService.socketPing(conversationId, participantIds[1], 0).toPromise();
        
      } else {
        // Socket n'existe pas : en créer un nouveau
        console.log('[SearchPage] Socket does not exist, creating new one');
        await this.socketService.socketCreate(conversationId, participantIds).toPromise();
      }
    } catch (error) {
      console.error('[SearchPage] Error initializing socket:', error);
    }
  }

  goToAllProfiles() {
    // Navigation vers tous les profils
    console.log('Navigating to all profiles');
  }

  // ==================== */
  //    UTILS            */
  // ==================== */

  trackByProfileId(index: number, profile: UserProfile): string {
    return profile.id;
  }

  onAvatarError(event: any) {
    const imgElement = event.target as HTMLImageElement;
    imgElement.onerror = null;
    imgElement.src = 'assets/avatar-default.png';
  }
}
