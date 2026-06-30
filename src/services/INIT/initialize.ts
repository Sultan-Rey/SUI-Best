import { EventEmitter, Injectable } from '@angular/core';
import { ProfileService } from '../Service_profile/profile-service';
import { CreationService } from '../Service_content/creation-service';
import { Auth } from '../AUTH/auth';
import { WalletService } from '../Service_wallet/wallet-service';
import { ChallengeService } from '../Service_challenge/challenge-service';

@Injectable({
  providedIn: 'root',
})
export class Initialize {

   // EventEmitter pour les erreurs de connexion
  public connectionError = new EventEmitter<boolean>();
  public isOnline: boolean = false;
  constructor(private profileService: ProfileService, private walletService: WalletService,
              private authService: Auth, private contentService: CreationService, private challengeService: ChallengeService){
    // Écouter les événements de connexion du service API
    this.profileService['api'].connectionError.subscribe((isConnected: boolean) => {
      this.connectionError.emit(isConnected);
    });
  }


   public setupConnectionListeners() {
    // Initialiser l'état de connexion
    this.isOnline = navigator.onLine;

    // Écouter les événements de connexion du navigateur
    window.addEventListener('online', () => {
      this.refreshAllDataOnReconnect();
      return true;
      
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.checkCachedDataAvailability();
    });

    // Écouter les événements de connexion du service métier
    this.connectionError.subscribe((isConnected: boolean) => {
       this.isOnline = isConnected;
      // Si la connexion est rétablie via le service, recharger les données
      if (isConnected) {
       // console.log('Service connexion rétablie - Rechargement automatique des données...');
        this.refreshAllDataOnReconnect();
      }
    });
    
  }

  private async checkCachedDataAvailability(){
    const hasContent = await this.contentService.newContent$.toPromise();
    const hasProfile = await this.authService.currentProfile$.toPromise();
    const hasWallet =  await this.walletService.wallet$.toPromise();
    const hasChallenge = await this.challengeService.activeChallenges$.toPromise();

    if (!hasContent || !hasProfile || !hasWallet || !hasChallenge) {
      return false;
    }
    return true;
  }

  /**
   * Recharge automatiquement toutes les données quand la connexion est rétablie
   */
 
  public refreshAllDataOnReconnect(){
    this.walletService.reloadWallet();
    this.authService.getCurrentUser();
  }


}
