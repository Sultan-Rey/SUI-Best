import { Injectable } from '@angular/core';
import { ApiJSON } from '../API/LOCAL/api-json';
import { Vote } from '../../models/Vote';
import { Challenge, VoteRule } from '../../models/Challenge';
import { Content } from 'src/models/Content';
import { Observable, of, throwError } from 'rxjs';
import { map, switchMap, catchError, tap, take } from 'rxjs/operators';
import { ChallengeService } from '../CHALLENGE_SERVICE/challenge-service';

@Injectable({
  providedIn: 'root',
})
export class VoteService {
  private readonly CONTENT_URL = 'contents';
  private readonly VOTE_STATUS_URL = 'vote/status';
  private voteRule: VoteRule = VoteRule.ONE_VOTE_PER_USER; // Règle de vote par défaut
  
 

  // Helper pour créer un objet Vote
  private createVote(userId: string, contentId: string, voteValue: number = 1): Omit<Vote, 'id' | 'createdAt'> {
    return {
      userId,
      contentId,
      challengeId: '', // À remplir avec l'ID du défi si nécessaire
      nbVotes: voteValue
    };
  }

  constructor(private api: ApiJSON, private challengeService: ChallengeService) {}

  /**
   * Définit la règle de vote
   * @param rule Règle de vote (ONE_VOTE_PER_USER ou UNLIMITED_VOTES)
   */
  setVoteRule(rule: VoteRule): void {
    this.voteRule = rule;
  }

  /**
   * Récupère la règle de vote actuelle
   */
  getVoteRule(): VoteRule {
    return this.voteRule;
  }


  /**
   * Récupère les votes pour un contenu spécifique
   * @param contentId ID du contenu
   */
  getVotesForContent(contentId: string): Observable<Vote[]> {
    return this.api.get<Content>(this.CONTENT_URL, { id: contentId }).pipe(
      map(content => content.votersList || [])
    );
  }

  /**
   * Récupère le vote d'un utilisateur pour un contenu spécifique
   * @param userId ID de l'utilisateur
   * @param contentId ID du contenu
   */
  getUserVoteForContent(userId: string, contentId: string): Observable<Vote | undefined> {
    return this.api.get<Content>(this.CONTENT_URL, { id: contentId }).pipe(
      map(content => {
        if (!content.votersList) return undefined;
        return content.votersList.find(vote => vote.userId === userId);
      })
    );
  }

  /**
   * Supprime le vote d'un utilisateur pour un contenu spécifique
   * @param userId ID de l'utilisateur
   * @param contentId ID du contenu
   */
  removeVote(userId: string, contentId: string): Observable<Content> {
    return this.api.get<Content>(this.CONTENT_URL, { id: contentId }).pipe(
      switchMap(content => {
        if (!content.votersList) {
          return of(content);
        }
        
        const voteIndex = content.votersList.findIndex(vote => vote.userId === userId);
        if (voteIndex === -1) {
          return of(content);
        }
        
        const removedVote = content.votersList[voteIndex];
        content.votersList.splice(voteIndex, 1);
        content.voteCount = Math.max(0, (content.voteCount || 0) - removedVote.nbVotes);
        
        return this.api.update<Content>(this.CONTENT_URL, contentId, {
          votersList: content.votersList,
          voteCount: content.voteCount
        }).pipe(
          map(() => content)
        );
      })
    );
  }

  /**
   * Calcule le nombre total de votes pour un contenu
   * @param contentId ID du contenu
   */
  getTotalVotesForContent(contentId: string): Observable<number> {
    return this.api.get<Content>(this.CONTENT_URL, { id: contentId }).pipe(
      map(content => content.voteCount || 0)
    );
  }

  /**
   * Met à jour un vote existant (uniquement en mode MULTIPLE)
   * @param contentId ID du contenu contenant le vote
   * @param userId ID de l'utilisateur dont on veut mettre à jour le vote
   * @param newVoteValue Nouvelle valeur du vote
   */
  updateVote(contentId: string, userId: string, newVoteValue: number): Observable<Content> {
    if (this.voteRule === VoteRule.ONE_VOTE_PER_USER) {
      return throwError(() => new Error('La mise à jour des votes n\'est pas autorisée avec la règle ONE_VOTE_PER_USER'));
    }

    return this.api.get<Content>(this.CONTENT_URL, { id: contentId }).pipe(
      switchMap(content => {
        if (!content.votersList) {
          return throwError(() => new Error('Aucun vote trouvé pour ce contenu'));
        }
        
        const voteIndex = content.votersList.findIndex(vote => vote.userId === userId);
        if (voteIndex === -1) {
          return throwError(() => new Error('Vote non trouvé pour cet utilisateur'));
        }
        
        const oldVoteValue = content.votersList[voteIndex].nbVotes;
        content.votersList[voteIndex].nbVotes = newVoteValue;
        content.voteCount = (content.voteCount || 0) - oldVoteValue + newVoteValue;
        
        return this.api.update<Content>(this.CONTENT_URL, contentId, {
          votersList: content.votersList,
          voteCount: content.voteCount
        }).pipe(
          map(() => content)
        );
      })
    );
  }




}
