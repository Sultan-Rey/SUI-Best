import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Storage } from '@ionic/storage-angular';

export interface UserPhoto {
  filepath: string;
  webviewPath?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CameraService {
  public photos: UserPhoto[] = [];
  private _storage: Storage | null = null;

  constructor(private storage: Storage) {
    this.init();
  }

  async init() {
    this._storage = await this.storage.create();
    this.photos = await this._storage.get('photos') || [];
  }

  /**
   * 1- OUVRE LA CAMERA
   */
  public async addNewToGallery() {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera, // Force la caméra
      quality: 100
    });

    return await this.saveAndStore(photo);
  }

  /**
   * 2- OUVRE LA GALLERIE DU TELEPHONE
   */
  public async getGalleryPhotos() {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Photos, // Force la galerie
      quality: 100
    });

    return await this.saveAndStore(photo);
  }

  // Logique commune pour sauvegarder physiquement l'image et mettre à jour le storage
  private async saveAndStore(photo: Photo): Promise<UserPhoto> {
    const savedImageFile = await this.savePicture(photo);
    this.photos.unshift(savedImageFile);
    await this._storage?.set('photos', this.photos);
    return savedImageFile;
  }

  private async savePicture(photo: Photo): Promise<UserPhoto> {
    const base64Data = await this.readAsBase64(photo);
    const fileName = new Date().getTime() + '.jpeg';
    
    await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Data
    });

    return {
      filepath: fileName,
      webviewPath: photo.webPath
    };
  }

  private async readAsBase64(photo: Photo) {
    const response = await fetch(photo.webPath!);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }

  // Pour charger la liste au démarrage sans ouvrir la caméra/galerie
  public async loadSavedPhotos(): Promise<UserPhoto[]> {
    if (!this._storage) await this.init();
    return this.photos;
  }
}