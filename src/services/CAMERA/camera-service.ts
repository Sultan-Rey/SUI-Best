import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource, Photo, GalleryPhoto } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

export interface MediaFile {
  file: File;
  previewUrl: string;
  mimeType: string;
  isVideo: boolean;
  isImage: boolean;
  duration?: number;
  width?: number;
  height?: number;
}

@Injectable({ providedIn: 'root' })
export class CameraService {

  // ── Caméra ───────────────────────────────────────────────────

  async takePhoto(): Promise<MediaFile> {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      correctOrientation: true
    });

    const file = await this.photoToFile(photo);
    return this.buildMediaFile(file, photo.webPath!);
  }

  // ── Galerie — sélection unique ────────────────────────────────

  async pickSingle(): Promise<MediaFile | null> {
    if (Capacitor.getPlatform() === 'web') {
      return this.pickSingleWeb();
    }

    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos,
      });
      const file = await this.photoToFile(photo);
      return this.buildMediaFile(file, photo.webPath!);
    } catch {
      return null;
    }
  }

  // ── Galerie — sélection multiple ──────────────────────────────
  // Sur mobile : picker natif du système (comme Instagram)
  // Sur web    : input file multiple

  async pickMultiple(): Promise<MediaFile[]> {
    if (Capacitor.getPlatform() === 'web') {
      return this.pickMultipleWeb();
    }

    try {
      await Camera.requestPermissions({ permissions: ['photos'] });
      const result = await Camera.pickImages({ quality: 90 });
      const photos = result.photos ?? [];

      const mediaFiles = await Promise.all(
        photos.map(async (p) => {
          const file = await this.galleryPhotoToFile(p);
          return this.buildMediaFile(file, p.webPath);
        })
      );

      return mediaFiles;
    } catch (err) {
      console.error('[CameraService] pickMultiple error:', err);
      return [];
    }
  }

  // ── Métadonnées vidéo ─────────────────────────────────────────

  async getVideoMetadata(file: File): Promise<{ duration: number; width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight });
      };
      video.onerror = () => reject(new Error('Impossible de lire les métadonnées vidéo'));
      video.src = URL.createObjectURL(file);
    });
  }

  // ── Helpers privés ────────────────────────────────────────────

  private async pickSingleWeb(): Promise<MediaFile | null> {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,video/*';

      input.onchange = async (e: any) => {
        const file: File = e.target?.files?.[0];
        if (!file) { resolve(null); return; }
        const url = URL.createObjectURL(file);
        resolve(await this.buildMediaFile(file, url));
      };

      input.oncancel = () => resolve(null);
      input.click();
    });
  }

  private async pickMultipleWeb(): Promise<MediaFile[]> {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,video/*';
      input.multiple = true;

      input.onchange = async (e: any) => {
        const files: File[] = Array.from(e.target?.files ?? []);
        if (!files.length) { resolve([]); return; }

        const mediaFiles = await Promise.all(
          files.map(async f => {
            const url = URL.createObjectURL(f);
            return this.buildMediaFile(f, url);
          })
        );
        resolve(mediaFiles);
      };

      input.oncancel = () => resolve([]);
      input.click();
    });
  }

  private async buildMediaFile(file: File, previewUrl: string): Promise<MediaFile> {
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    const media: MediaFile = {
      file,
      previewUrl,
      mimeType: file.type,
      isVideo,
      isImage,
    };

    if (isVideo) {
      try {
        const meta = await this.getVideoMetadata(file);
        media.duration = meta.duration;
        media.width    = meta.width;
        media.height   = meta.height;
      } catch { /* pas critique */ }
    }

    return media;
  }

  private async photoToFile(photo: Photo): Promise<File> {
    if (!photo.webPath) throw new Error('Pas de webPath');
    const res  = await fetch(photo.webPath);
    const blob = await res.blob();
    const ext  = this.mimeToExt(blob.type);
    return new File([blob], `media_${Date.now()}.${ext}`, { type: blob.type });
  }

  private async galleryPhotoToFile(photo: GalleryPhoto): Promise<File> {
    if (!photo.webPath) throw new Error('Pas de webPath');
    const res  = await fetch(photo.webPath);
    const blob = await res.blob();
    const ext  = this.mimeToExt(blob.type);
    return new File([blob], `media_${Date.now()}.${ext}`, { type: blob.type });
  }

  private mimeToExt(mime: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
      'image/gif': 'gif',  'image/webp': 'webp', 'image/svg+xml': 'svg',
      'video/mp4': 'mp4',  'video/quicktime': 'mov', 'video/webm': 'webm',
    };
    return map[mime] ?? 'jpg';
  }
}