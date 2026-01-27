import { Injectable } from '@angular/core';
import { ApiJSON } from '../API/LOCAL/api-json';
import { Vote } from '../../models/Vote';
import { VoteRule } from '../../models/Challenge';
import { Observable, of, throwError } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { ChallengeService } from '../CHALLENGE_SERVICE/challenge-service';

@Injectable({
  providedIn: 'root',
})
export class VoteService {
  private readonly BASE_URL = 'votes';
  private voteRule: VoteRule = VoteRule.ONE_VOTE_PER_USER; // Règle de vote par défaut
  
  // Type pour les paramètres de requête
  private getVotesParams(userId?: string, contentId?: string): any {
    const params: any = {};
    if (userId) params.userId = userId;
    if (contentId) params.contentId = contentId;
    return params;
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
 * Ajoute un vote pour un contenu
 * @param userId ID de l'utilisateur qui vote
 * @param contentId ID du contenu à voter
 * @param voteValue Valeur du vote (par défaut: 1)
 */
addVote(userId: string, contentId: string, voteValue: number = 1): Observable<Vote> {
  // Si la règle est ONE_VOTE_PER_USER, on vérifie si l'utilisateur a déjà voté
  if (this.voteRule === VoteRule.ONE_VOTE_PER_USER) {
    return this.api.getAll<Vote>(this.BASE_URL, this.getVotesParams(userId, contentId)).pipe(
      switchMap((votes: any) => {
        if (votes && votes.length > 0) {
          return throwError(() => new Error('Vous avez déjà voté pour ce contenu'));
        }
        
        const newVote: Omit<Vote, 'id' | 'createdAt'> = {
          userId,
          contentId,
          nbVotes: voteValue
        };
        
        // Créer le vote et mettre à jour le compteur
        return this.api.create<Vote>(this.BASE_URL, newVote).pipe(
          switchMap(vote => {
            // Mettre à jour le compteur de votes du contenu
            return this.api.patch<any>('contents', contentId, {
              voteCount: 1 // On incrémente de 1 pour ONE_VOTE_PER_USER
            }).pipe(
              map(() => vote) // On retourne le vote créé
            );
          })
        );
      })
    );
  } else {
    // En mode UNLIMITED_VOTES, on incrémente le vote existant ou on en crée un nouveau
    return this.api.getAll<Vote>(this.BASE_URL, this.getVotesParams(userId, contentId)).pipe(
      switchMap((votes: any) => {
        if (votes && votes.length > 0) {
          // Mise à jour du vote existant
          const existingVote = votes[0];
          return this.api.update<Vote>(
            this.BASE_URL, 
            existingVote.id, 
            { nbVotes: (existingVote.nbVotes || 0) + voteValue }
          ).pipe(
            switchMap(updatedVote => {
              // Mettre à jour le compteur de votes du contenu
              return this.api.patch<any>('contents', contentId, {
                $inc: { voteCount: voteValue } // On incrémente de voteValue
              }).pipe(
                map(() => updatedVote) // On retourne le vote mis à jour
              );
            })
          );
        } else {
          // Création d'un nouveau vote
          const newVote: Omit<Vote, 'id' | 'createdAt'> = {
            userId,
            contentId,
            nbVotes: voteValue
          };
          
          return this.api.create<Vote>(this.BASE_URL, newVote).pipe(
            switchMap(vote => {
              // Mettre à jour le compteur de votes du contenu
              return this.api.patch<any>('contents', contentId, {
                $inc: { voteCount: voteValue } // On incrémente de voteValue
              }).pipe(
                map(() => vote) // On retourne le vote créé
              );
            })
          );
        }
      })
    );
  }
}

  /**
   * Récupère les votes pour un contenu spécifique
   * @param contentId ID du contenu
   */
  getVotesForContent(contentId: string): Observable<Vote[]> {
    return this.api.getAll<Vote>(this.BASE_URL, this.getVotesParams(undefined, contentId));
  }

  /**
   * Récupère le vote d'un utilisateur pour un contenu spécifique
   * @param userId ID de l'utilisateur
   * @param contentId ID du contenu
   */
  getUserVoteForContent(userId: string, contentId: string): Observable<Vote | undefined> {
    return this.api.getAll<Vote>(this.BASE_URL, this.getVotesParams(userId, contentId)).pipe(
      map((votes: any) => votes[0] || undefined)
    );
  }

  /**
   * Supprime le vote d'un utilisateur pour un contenu spécifique
   * @param userId ID de l'utilisateur
   * @param contentId ID du contenu
   */
  removeVote(userId: string, contentId: string): Observable<void> {
    return this.api.getAll<Vote>(this.BASE_URL, this.getVotesParams(userId, contentId)).pipe(
      switchMap((votes: any) => {
        if (!votes || votes.length === 0) {
          return of(undefined);
        }
        // Suppression du vote avec l'ID spécifié
        return this.api.delete(this.BASE_URL, votes[0].id);
      })
    );
  }

  /**
   * Calcule le nombre total de votes pour un contenu
   * @param contentId ID du contenu
   */
  getTotalVotesForContent(contentId: string): Observable<number> {
    return this.getVotesForContent(contentId).pipe(
      map(votes => votes.reduce((total, vote) => total + vote.nbVotes, 0))
    );
  }

  /**
   * Met à jour un vote existant (uniquement en mode MULTIPLE)
   * @param voteId ID du vote à mettre à jour
   * @param newVoteValue Nouvelle valeur du vote
   */
  updateVote(voteId: string, newVoteValue: number): Observable<Vote> {
    if (this.voteRule === VoteRule.ONE_VOTE_PER_USER) {
      return throwError(() => new Error('La mise à jour des votes n\'est pas autorisée avec la règle ONE_VOTE_PER_USER'));
    }

    return this.api.update<Vote>(
      this.BASE_URL, 
      voteId, 
      { nbVotes: newVoteValue }
    );
  }


/**
 * Vérifie le statut de vote d'un utilisateur pour un contenu
 * @param userId ID de l'utilisateur
 * @param contentId ID du contenu
 * @returns Observable avec { isVoted: boolean, isBlocked: boolean }
 */
checkUserVoteStatus(userId: string, contentId: string): Observable<{ isVoted: boolean, isBlocked: boolean }> {
  // 1. Vérifier si l'utilisateur a déjà voté pour ce contenu
  return this.api.getAll<Vote>(`${this.BASE_URL}?userId=${userId}&contentId=${contentId}`).pipe(
    switchMap((votes: Vote[]) => {
      const hasVoted = votes.length > 0;
      
      // 2. Récupérer le contenu pour avoir le challengeId
      return this.api.getById<any>('contents', contentId).pipe(
        switchMap(content => {
          // 3. Récupérer le challenge pour avoir la règle de vote
          return this.challengeService.getChallengeById(content.challengeId).pipe(
            map(challenge => {
              // 4. Vérifier si l'utilisateur est bloqué selon la règle de vote
              const isBlocked = hasVoted && challenge?.vote_rule === VoteRule.ONE_VOTE_PER_USER;
              return { 
                isVoted: hasVoted, 
                isBlocked 
              };
            })
          );
        })
      );
    }),
    catchError((error) => {
      console.error('Erreur lors de la vérification du statut de vote:', error);
      return of({ isVoted: false, isBlocked: false });
    })
  );
}
}
