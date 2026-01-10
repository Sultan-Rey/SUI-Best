import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
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

  // Choisir depuis la galerie
  async pickFromGallery(): Promise<Photo> {
    return await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Photos,
    });
  }

  // Convertir une photo en fichier
  async convertPhotoToFile(photo: Photo): Promise<File> {
    // Fetch the photo, read as a blob, then convert to a File
    const response = await fetch(photo.webPath!);
    const blob = await response.blob();
    return new File([blob], `photo_${new Date().getTime()}.jpg`, { 
      type: 'image/jpeg' 
    });
  }

  // Obtenir les métadonnées d'une vidéo
  async getVideoMetadata(videoFile: File): Promise<{ duration: number, width: number, height: number }> {
    return new Promise((resolve) => {
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
      
      video.src = URL.createObjectURL(videoFile);
    });
  }
}