import { environment } from "src/environments/environment.prod";


// Dans un nouveau fichier src/app/utils/media.utils.ts


export function getMediaUrl(relativePath: string): string {
  if (!relativePath) return '';
  
  // Si c'est déjà une URL complète, on la retourne telle quelle
  if (relativePath.startsWith('http') || relativePath.startsWith('https')) {
    return relativePath;
  }
  
  // Construire l'URL de base
  return `${environment.apiUrl}/${relativePath.replace(/^\/+/, '')}`;
}

// Nouvelle fonction pour obtenir les en-têtes d'authentification
export function getAuthHeaders(): { [header: string]: string } {
  return {
    'Authorization': `Bearer ${environment.authToken}`,
    'Content-Type': 'application/json'
  };
}