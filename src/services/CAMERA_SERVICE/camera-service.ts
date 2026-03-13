import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource, Photo, GalleryPhoto } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root'
})
export class CameraService {
  constructor() {}

  // Prendre une photo avec la caméra
  async takePhoto(): Promise<Photo> {
    return await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      correctOrientation: true
    });
  }

  // Choisir depuis la galerie (une seule photo)
  async pickFromGallery(): Promise<Photo> {
    if (Capacitor.getPlatform() === 'web') {
      return this.pickSinglePhotoWeb();
    }
    return await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Photos,
    });
  }

  /**
   * Charge les photos récentes de la galerie.
   * Sur le web, retourne un tableau vide immédiatement (pas de chargement infini).
   * L'utilisateur doit utiliser pickFromGallery() ou takePhoto() sur le web.
   */
  async getGalleryPhotos(): Promise<GalleryPhoto[]> {
    // Sur le web, on ne peut pas accéder à la galerie sans interaction utilisateur.
    // On retourne un tableau vide pour éviter le spinner infini.
    if (Capacitor.getPlatform() === 'web') {
      return [];
    }

    try {
      const permissions = await Camera.requestPermissions({ permissions: ['photos'] });

      if (permissions.photos === 'denied') {
        console.warn('Permission galerie refusée');
        return [];
      }

      // iOS: getLimitedLibraryPhotos pour les photos déjà autorisées
      // Android: pickImages pour permettre la sélection multiple
      try {
        const result = await Camera.getLimitedLibraryPhotos();
        return result.photos || [];
      } catch {
        // Fallback: pickLimitedLibraryPhotos si getLimitedLibraryPhotos n'est pas disponible
        const result = await Camera.pickLimitedLibraryPhotos();
        return result.photos || [];
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des photos:', error);
      return [];
    }
  }

  /**
   * Sélectionne plusieurs photos depuis la galerie (avec interaction utilisateur).
   * Compatible web via un input file.
   */
  async pickMultipleFromGallery(): Promise<GalleryPhoto[]> {
    if (Capacitor.getPlatform() === 'web') {
      return this.pickMultiplePhotosWeb();
    }

    try {
      await Camera.requestPermissions({ permissions: ['photos'] });
      const result = await Camera.pickImages({ quality: 90 });
      return result.photos || [];
    } catch (error) {
      console.error('Erreur lors de la sélection multiple:', error);
      return [];
    }
  }

  // Sélectionner une seule photo sur le web via input file
  private pickSinglePhotoWeb(): Promise<Photo> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,video/*';

      let resolved = false;

      input.onchange = (event: any) => {
        const file = event.target?.files?.[0];
        if (!file) {
          reject(new Error('Aucun fichier sélectionné'));
          return;
        }
        resolved = true;
        const webPath = URL.createObjectURL(file);
        resolve({
          webPath,
          format: file.type.split('/')[1] || 'jpeg',
          saved: false,
          base64String: undefined,
          dataUrl: undefined,
          exif: undefined,
          path: undefined
        } as Photo);
      };

      input.oncancel = () => {
        if (!resolved) reject(new Error('Sélection annulée'));
      };

      // Cleanup si la fenêtre reprend le focus sans sélection
      const onFocus = () => {
        setTimeout(() => {
          if (!resolved) {
            window.removeEventListener('focus', onFocus);
            // Ne pas rejeter — l'utilisateur peut juste fermer sans choisir
          }
        }, 500);
      };
      window.addEventListener('focus', onFocus, { once: true });

      input.click();
    });
  }

  // Sélectionner plusieurs photos sur le web via input file
  private pickMultiplePhotosWeb(): Promise<GalleryPhoto[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;

      input.onchange = (event: any) => {
        const files: FileList = event.target?.files;
        if (!files || files.length === 0) {
          resolve([]);
          return;
        }

        const photos: GalleryPhoto[] = Array.from(files).map(file => ({
          webPath: URL.createObjectURL(file),
          format: file.type.split('/')[1] || 'jpeg',
          saved: false
        } as GalleryPhoto));

        resolve(photos);
      };

      input.oncancel = () => resolve([]);

      input.click();
    });
  }

  // Convertir une Photo ou GalleryPhoto en File
  async convertPhotoToFile(photo: Photo | GalleryPhoto): Promise<File> {
    if (!photo.webPath) {
      throw new Error('Pas de chemin web pour cette photo');
    }

    const response = await fetch(photo.webPath);
    const blob = await response.blob();
    const mimeType = blob.type || 'image/jpeg';
    const extension = this.getFileExtension(mimeType);

    return new File([blob], `media_${Date.now()}.${extension}`, { type: mimeType });
  }

  // Obtenir les métadonnées d'une vidéo
  async getVideoMetadata(videoFile: File): Promise<{ duration: number; width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight
        });
      };

      video.onerror = () => reject(new Error('Impossible de lire les métadonnées vidéo'));
      video.src = URL.createObjectURL(videoFile);
    });
  }

  private getFileExtension(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'video/webm': 'webm',
    };
    return map[mimeType] ?? 'jpg';
  }
}