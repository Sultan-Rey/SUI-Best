import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiJSON } from '../API/LOCAL/api-json';
import { Content, ContentStatus } from '../../models/Content';
import { Challenge } from '../../models/Challenge';

@Injectable({
  providedIn: 'root',
})
export class CreationService {
  private readonly contentResource = 'contents';
  private readonly challengeResource = 'challenges';

  constructor(private api: ApiJSON) {}

  // =====================
  // MÉTHODES POUR LES CONTENUS
  // =====================

  createContent(content: Omit<Content, 'id' | 'createdAt' | 'status' | 'viewCount' | 'likeCount' | 'commentCount' | 'downloadCount'>): Observable<Content> {
    const newContent = {
      ...content,
      createdAt: new Date().toISOString(),
      status: ContentStatus.DRAFT,
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      downloadCount: 0
    };
    return this.api.create<Content>(this.contentResource, newContent);
  }

  /**
 * Récupère les contenus d'un utilisateur spécifique
 * @param userId ID de l'utilisateur
 * @returns Observable<Content[]> Liste des contenus de l'utilisateur triés par date de création décroissante
 */
getUserContents(userId: string): Observable<Content[]> {
  return this.api.getAll<Content>(this.contentResource, {
    'user_id': userId,
    '_sort': 'created_at:desc'
  });
}

  // =====================
  // MÉTHODES POUR LES DÉFIS
  // =====================

  createChallenge(challengeData: Omit<Challenge, 'id' | 'created_at' | 'is_active'>): Observable<Challenge> {
    const challenge = {
      ...challengeData,
      created_at: new Date(Date.now()),
      is_active: true
    };
    return this.api.create<Challenge>(this.challengeResource, challenge);
  }

  /**
 * Récupère la liste des défis actifs
 * @returns Observable<Challenge[]> Liste des défis actifs
 */
getActiveChallenges(): Observable<Challenge[]> {
  return this.api.getAll<Challenge>(this.challengeResource, {
    is_active: 'true',
    _sort: 'created_at',
    _order: 'desc'
  });
}

  // =====================
  // MÉTHODES UTILITAIRES
  // =====================

  /**
 * Désactive un défi
 * @param id ID du défi à désactiver
 * @returns Observable<Challenge> Le défi mis à jour
 */
updateChallenge(id: string, updates: Partial<Challenge>): Observable<Challenge> {
  return this.api.update<Challenge>(this.challengeResource, id, updates);
}

  /**
   * Récupère un défi par son ID
   * @param id ID du défi à récupérer
   * @returns Observable<Challenge> Le défi correspondant à l'ID
   */
  getChallengeById(id: string): Observable<Challenge> {
    return this.api.getById<Challenge>(this.challengeResource, id);
  }

  /**
   * Récupère tous les défis créés par un utilisateur spécifique
   * @param creatorId ID du créateur des défis
   * @returns Observable<Challenge[]> Liste des défis créés par l'utilisateur
   */
  getChallengesByCreator(creatorId: string): Observable<Challenge[]> {
    return this.api.getAll<Challenge>(this.challengeResource, {
      creator_id: creatorId,
      _sort: 'created_at',
      _order: 'desc'
    });
  }

}