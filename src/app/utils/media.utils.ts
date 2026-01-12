// Dans un nouveau fichier src/app/utils/media.utils.ts
export function getMediaUrl(relativePath: string): string {
  if (!relativePath) return '';
  
  // Si c'est déjà une URL complète, on la retourne telle quelle
  if (relativePath.startsWith('http')) {
    return relativePath;
  }
  
  // Sinon, on construit l'URL complète avec le bon port
  return `http://localhost:3000/${relativePath.replace(/^\/+/, '')}`;
}