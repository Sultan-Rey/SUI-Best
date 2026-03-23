import { Injectable } from '@angular/core';
import { ApiJSON } from '../API/LOCAL/api-json'; // ✅ Migration vers notre ApiJSON unifié
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

  constructor(private api: ApiJSON, private challengeService: ChallengeService) {} // ✅ Migration vers notre ApiJSON unifié

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
    return this.api.getById<Content>(this.CONTENT_URL, contentId).pipe(
      map(content => content?.votersList || [])
    );
  }

  /**
   * Récupère le vote d'un utilisateur pour un contenu spécifique
   * @param userId ID de l'utilisateur
   * @param contentId ID du contenu
   */
  getUserVoteForContent(userId: string, contentId: string): Observable<Vote | undefined> {
    return this.api.getById<Content>(this.CONTENT_URL,contentId).pipe(
      map(content => {
        if (!content?.votersList) return undefined;
        return content.votersList.find(vote => vote.userId === userId);
      })
    );
  }

  /**
   * Supprime le vote d'un utilisateur pour un contenu spécifique
   * @param userId ID de l'utilisateur
   * @param contentId ID du contenu
   */
  removeVote(userId: string, contentId: string): Observable<Content | null> {
    return this.api.getById<Content | null>(this.CONTENT_URL,contentId).pipe(
      switchMap(content => {
        if (!content?.votersList) {
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
    return this.api.getById<Content>(this.CONTENT_URL,  contentId ).pipe(
      map(content => content?.voteCount || 0)
    );
  }

  /**
   * Met à jour un vote existant (uniquement en mode MULTIPLE)
   * @param contentId ID du contenu contenant le vote
   * @param userId ID de l'utilisateur dont on veut mettre à jour le vote
   * @param newVoteValue Nouvelle valeur du vote
   */
  updateVote(contentId: string, userId: string, newVoteValue: number): Observable<Content | null> {
    if (this.voteRule === VoteRule.ONE_VOTE_PER_USER) {
      return throwError(() => new Error('La mise à jour des votes n\'est pas autorisée avec la règle ONE_VOTE_PER_USER'));
    }

    return this.api.getById<Content | null>(this.CONTENT_URL, contentId).pipe(
      switchMap(content => {
        if (!content?.votersList) {
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

 /**
   * Ajoute un vote au tableau votersList d'un contenu
   * @param vote Le vote à ajouter
   * @param voteRule La règle de vote (par défaut UNLIMITED_VOTES)
   * @returns Observable<Content> Le contenu mis à jour
   */
  addVoteToContent(vote: Vote, voteRule: VoteRule = VoteRule.UNLIMITED_VOTES): Observable<Content> {
    return this.api.getById<Content>(this.CONTENT_URL, vote.contentId).pipe(
      switchMap(content => {
        const currentVotersList = [...(content?.votersList || [])];
        
        if (voteRule === VoteRule.UNLIMITED_VOTES) {
          // Mode UNLIMITED_VOTES: on cherche si l'utilisateur a déjà voté POUR CE CONTENU
          // currentVotersList contient uniquement les votes du contenu actuel (vote.contentId)
          const existingVoteIndex = currentVotersList.findIndex(v => v.userId === vote.userId && v.challengeId === vote.challengeId);
          
          if (existingVoteIndex !== -1) {
            // L'utilisateur a déjà voté, on incrémente le vote existant
            currentVotersList[existingVoteIndex] = {
              ...currentVotersList[existingVoteIndex],
              nbVotes: currentVotersList[existingVoteIndex].nbVotes + vote.nbVotes
            };
          } else {
            // L'utilisateur n'a pas encore voté, on crée un nouveau vote
            const newVote: Vote = {
              ...vote,
              createdAt: vote.createdAt || new Date().toISOString()
            };
            currentVotersList.push(newVote);
          }
        } else {
          // Autres règles de vote ONE_VOTE_PER_USER
          // Pour l'instant, on ajoute simplement le vote
          const newVote: Vote = {
            ...vote,
            createdAt: vote.createdAt || new Date().toISOString()
          };
          currentVotersList.push(newVote);
        }
        
        // Calcul du nombre total de votes
        const totalVotes = currentVotersList.reduce((sum, v) => sum + v.nbVotes, 0);
        
        return this.api.patch<Content>(this.CONTENT_URL, vote.contentId, {
          votersList: currentVotersList,
          voteCount: totalVotes
        });
      }),
      catchError(error => {
        console.error('Erreur lors de l\'ajout du vote:', error);
        return throwError(() => new Error('Impossible d\'ajouter le vote. Veuillez réessayer.'));
      })
    );
  }

  /**
   * Vérifie si un utilisateur peut voter pour un contenu dans un challenge spécifique
   * @param userId ID de l'utilisateur
   * @param contentId ID du contenu
   * @param challengeId ID du challenge
   * @returns Observable<{canVote: boolean, voteRule: VoteRule, existingVote?: Vote}>
   */
  canUserVoteForChallenge(userId: string, contentId: string, challengeId: string): Observable<{
    canVote: boolean;
    voteRule: VoteRule;
    existingVote?: Vote;
  }> {
    // Récupérer le challenge pour connaître la règle de vote
    return this.challengeService.getChallengeById(challengeId).pipe(
      switchMap(challenge => {
        const voteRule = challenge?.vote_rule as VoteRule;
        
        // Si la règle est UNLIMITED_VOTES, l'utilisateur peut toujours voter
        if (voteRule === VoteRule.UNLIMITED_VOTES) {
          return of({ canVote: true, voteRule });
        }
        
        // Pour ONE_VOTE_PER_USER, on vérifie si l'utilisateur a déjà voté
        return this.api.getById<Content>(this.CONTENT_URL, contentId).pipe(
          map(content => {
            const existingVote = (content?.votersList || []).find(v => 
              v.userId === userId && v.challengeId === challengeId
            );
            
            return {
              canVote: !existingVote,
              voteRule,
              existingVote
            };
          })
        );
      }),
      catchError(error => {
        console.error('Erreur lors de la vérification du droit de vote:', error);
        return of({ 
          canVote: false, 
          voteRule: VoteRule.ONE_VOTE_PER_USER 
        });
      })
    );
  }


}
