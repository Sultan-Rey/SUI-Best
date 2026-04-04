import { Component, Inject, OnInit, NgZone } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Platform } from '@ionic/angular';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  closeCircle,
  qrCodeOutline,
  warning,
  pencilOutline
} from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { NgIf } from '@angular/common';
import { 
  IonHeader, 
  IonToolbar, 
  IonIcon, 
  IonButton, 
  IonTitle,
  IonButtons,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-modal-qrscanner',
  templateUrl: './modal-qrscanner.component.html',
  styleUrls: ['./modal-qrscanner.component.scss'],
  standalone: true,
  providers: [ModalController],
  imports: [
    NgIf,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent
  ]
})
export class ModalQRscannerComponent implements OnInit {
  html5QrCode: Html5Qrcode | null = null;
  isScanning = false;
  isCameraAvailable = true;
  scanResult: string | null = null;
  errorMessage: string | null = null;

  constructor(
    private modalController: ModalController,
    private platform: Platform,
    private ngZone: NgZone
  ) {
    addIcons({
      'close-circle': closeCircle,
      'qr-code-outline': qrCodeOutline,
      'warning': warning,
      'pencil-outline': pencilOutline
    });
  }

  ngOnInit() {
    this.startScan();
  }

  async startScan() {
    const isMobile = this.platform.is('mobile') || 
                    this.platform.is('ios') || 
                    this.platform.is('android');
    const isWebNative = this.platform.is('desktop') && !this.platform.is('mobileweb');

    try {
      if (this.isScanning) return;
      
      // Pour web native, vérifier le contexte sécurisé
      if (isWebNative) {
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera API not available');
          }
          
          if (location.protocol !== 'https:' && 
              location.hostname !== 'localhost' && 
              location.hostname !== '127.0.0.1') {
            throw new Error('Camera access requires HTTPS or localhost');
          }
          
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "user" } 
          });
          stream.getTracks().forEach(track => track.stop());
        } catch (err: any) {
          console.error("Permission caméra refusée:", err);
          this.isCameraAvailable = false;
          this.errorMessage = 'L\'accès à la caméra nécessite HTTPS ou localhost. Veuillez utiliser le mode manuel.';
          return;
        }
      }

      // Vérifier la disponibilité de la caméra
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        this.isCameraAvailable = false;
        this.errorMessage = 'Aucune caméra détectée sur cet appareil.';
        return;
      }

      this.isScanning = true;
      this.isCameraAvailable = true;
      document.querySelector('ion-app')?.classList.add('scanner-active');
      
      // Attendre que le DOM soit mis à jour
      setTimeout(async () => {
        try {
          const qrReaderElement = document.getElementById('qr-reader-modal');
          if (!qrReaderElement) {
            throw new Error('HTML Element with id=qr-reader-modal not found');
          }
          
          this.html5QrCode = new Html5Qrcode('qr-reader-modal');
          
          const config = isWebNative 
            ? { facingMode: "user" }
            : isMobile 
              ? { facingMode: "environment" }
              : { facingMode: "user" };

          const scanConfig = isWebNative 
            ? {
                fps: 5,
                qrbox: { width: 200, height: 200 },
                aspectRatio: 1.0
              }
            : {
                fps: 10,
                qrbox: { width: 250, height: 250 }
              };

          await this.html5QrCode.start(
            config,
            scanConfig,
            (decodedText) => this.handleScanSuccess(decodedText),
            (errorMessage) => {
              if (!isWebNative) {
                console.warn('Scan error:', errorMessage);
              }
            }
          );
        } catch (err) {
          console.error("Erreur du scanner:", err);
          this.isCameraAvailable = false;
          this.errorMessage = 'Erreur lors de l\'initialisation du scanner. Veuillez utiliser le mode manuel.';
        }
      }, 100);

    } catch (error) {
      console.error('Erreur lors du démarrage du scan:', error);
      this.isCameraAvailable = false;
      this.errorMessage = 'Erreur inattendue. Veuillez utiliser le mode manuel.';
    }
  }

 private handleScanSuccess(decodedText: string) {
  this.ngZone.run(() => {
    this.scanResult = decodedText;
    this.stopScan();

    let finalResult: any = decodedText;

    // Tentative de parsing automatique
    try {
      // Si le texte ressemble à du JSON (commence par { ), on tente le parse
      if (decodedText.trim().startsWith('{')) {
        finalResult = JSON.parse(decodedText);
      }
    } catch (e) {
      console.warn("Le texte scanné n'est pas un JSON valide, renvoi tel quel.");
      finalResult = decodedText;
    }

    // Fermer le modal et retourner le résultat (objet ou string)
    this.modalController.dismiss({
      success: true,
      result: finalResult // Ici, 'result' sera un bel objet JS
    });
  });
}

  async stopScan() {
    try {
      if (this.html5QrCode && this.html5QrCode.isScanning) {
        await this.html5QrCode.stop();
      }
    } catch (error) {
      console.error('Erreur lors de l\'arrêt du scan:', error);
    } finally {
      this.html5QrCode = null;
      this.isScanning = false;
      document.querySelector('ion-app')?.classList.remove('scanner-active');
    }
  }

  async dismiss() {
    await this.stopScan();
    await this.modalController.dismiss({
      success: false,
      result: null
    });
  }

  async goToManualMode() {
    await this.dismiss();
    // Le composant parent gérera l'ouverture du mode manuel
  }
}
