import { Injectable } from '@angular/core';
import { ApiJSON, FilterOptions, FilterResult } from '../API/api-json';
import { Vote } from '../../models/Vote';
import { Challenge, VoteRule } from '../../models/Challenge';
import { Observable, of, throwError } from 'rxjs';
import { map, switchMap, catchError, tap } from 'rxjs/operators';
import { ChallengeService } from '../Service_challenge/challenge-service';

export interface VoteStats {
  total_votes: number;
  total_voters: number;
  average_votes_per_user: number;
}

export interface ContentVoteResults {
  contentId: string;
  statistics: VoteStats;
  votes: Vote[];
  votes_by_challenge: {
    challengeId: string;
    challengeTitle: string;
    votes: Vote[];
    total: number;
    voters: number;
  }[];
  votes_without_challenge: Vote[];
}

export interface ChallengeVoteResults {
  challengeId: string;
  statistics: VoteStats & {
    total_contents_voted: number;
  };
  votes_by_content: {
    contentId: string;
    contentTitle: string;
    contentDescription: string;
    contentThumbnail?: string;
    votes: Vote[];
    total: number;
    voters: number;
  }[];
  all_votes: Vote[];
}

export interface LeaderboardEntry {
  userId: string;
  userDisplayName: string;
  userAvatar: string;
  username: string;
  isVerified: boolean;
  userType: string;
  userLevel: number;
  totalVotes: number;
  votesCount: number;
  averageVotes: number;
  lastVoteDate: string;
  rank: number;
}

export interface LeaderboardResponse {
  contentId: string;
  statistics: {
    total_participants: number;
    total_votes: number;
    average_votes_per_participant: number;
  };
  leaderboard: LeaderboardEntry[];
}

export interface UserVotesResponse {
  data: Vote[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface CheckVoteResponse {
  has_voted: boolean;
  has_voted_in_challenge: boolean;
  vote: Vote | null;
  user_id: string;
  content_id: string;
  challenge_id: string | null;
}

export interface GlobalVoteStats {
  global: {
    totalVotes: number;
    uniqueVoters: number;
    uniqueContents: number;
    uniqueChallenges: number;
    totalVoteCount: number;
  };
  top_contents: {
    contentId: string;
    voteCount: number;
    totalVotes: number;
  }[];
  top_users: {
    userId: string;
    votesCount: number;
    totalVotes: number;
  }[];
  daily_stats: {
    date: string;
    votesCount: number;
    totalVotes: number;
  }[];
}

export interface BulkVoteResult {
  message: string;
  total: number;
  success_count: number;
  failed_count: number;
  results: {
    success: { id: string; action: string }[];
    failed: any[];
  };
}

@Injectable({
  providedIn: 'root',
})
export class VoteService {
  private readonly VOTE_URL = 'votes';
  private voteRule: VoteRule = VoteRule.ONE_VOTE_PER_USER;

  constructor(
    private api: ApiJSON,
    private challengeService: ChallengeService
  ) {}

  // ─── Configuration ─────────────────────────────────────────────────────────

  setVoteRule(rule: VoteRule): void {
    this.voteRule = rule;
  }

  getVoteRule(): VoteRule {
    return this.voteRule;
  }

  // ─── Routes CRUD de base ──────────────────────────────────────────────────

  getVotes(limit: number = 50, offset: number = 0): Observable<Vote[]> {
    return this.api.get<Vote[]>(this.VOTE_URL, { limit, offset });
  }

  getVoteById(id: string): Observable<Vote> {
    return this.api.getById<Vote>(this.VOTE_URL, id);
  }

  filterVotes(filters: FilterOptions): Observable<FilterResult<Vote>> {
    return this.api.filter<Vote>(this.VOTE_URL, filters);
  }

  createVote(vote: Partial<Vote>): Observable<Vote> {
    return this.api.post<Vote>(this.VOTE_URL, vote);
  }

  updateVote(id: string, vote: Partial<Vote>): Observable<Vote> {
    return this.api.update<Vote>(this.VOTE_URL, id, vote);
  }

  deleteVote(id: string): Observable<void> {
    return this.api.delete(this.VOTE_URL, id);
  }

  // ─── Routes spécifiques aux votes (NOUVELLES ROUTES) ──────────────────────

  /**
   * Cast un vote (crée ou met à jour un vote existant) avec utilisation d'un coupon
   */
  castVote(
    userId: string,
    contentId: string,
    couponId: string,
    challengeId?: string,
    nbVotes: number = 1
  ): Observable<Vote> {
    const payload = {
      userId,
      contentId,
      couponId,
      challengeId: challengeId || null,
      usageValue: nbVotes
    };
    return this.api.post<Vote>(`${this.VOTE_URL}/cast`, payload);
  }

  /**
   * Vérifie si un utilisateur a déjà voté pour un contenu/défi
   */
  checkVote(userId: string, contentId: string, challengeId?: string): Observable<CheckVoteResponse> {
    const params: any = { userId, contentId };
    if (challengeId) params.challengeId = challengeId;
    return this.api.get<CheckVoteResponse>(`${this.VOTE_URL}/check`, params);
  }

  /**
   * Récupère les résultats de vote pour un contenu (NOUVELLE ROUTE avec paramètres query)
   */
  getContentResults(contentId: string): Observable<ContentVoteResults> {
    return this.api.get<ContentVoteResults>(
      `${this.VOTE_URL}/results`,
      { type: 'content', id: contentId }
    );
  }

  /**
   * Récupère les résultats de vote pour un défi (NOUVELLE ROUTE avec paramètres query)
   */
  getChallengeResults(challengeId: string): Observable<ChallengeVoteResults> {
    return this.api.get<ChallengeVoteResults>(
      `${this.VOTE_URL}/results`,
      { type: 'challenge', id: challengeId }
    );
  }

  /**
   * Récupère tous les votes d'un utilisateur (NOUVELLE ROUTE avec paramètres query)
   */
  getUserVotes(userId: string, limit: number = 50, offset: number = 0): Observable<UserVotesResponse> {
    return this.api.get<UserVotesResponse>(
      `${this.VOTE_URL}/user`,
      { userId, limit, offset }
    );
  }

  /**
   * Récupère le classement des utilisateurs pour un contenu (NOUVELLE ROUTE avec paramètres query)
   */
  /**
 * Récupère le classement pour un contenu
 */
getContentLeaderboard(contentId: string, limit: number = 20): Observable<LeaderboardResponse> {
  return this.api.get<LeaderboardResponse>(
    `${this.VOTE_URL}/leaderboard`,
    { type: 'content', id: contentId, limit }
  );
}

/**
 * Récupère le classement pour un challenge (tous contenus confondus)
 */
getChallengeLeaderboard(challengeId: string, limit: number = 20): Observable<{
  challengeId: string;
  statistics: {
    total_participants: number;
    total_votes: number;
    average_votes_per_participant: number;
  };
  leaderboard: LeaderboardEntry[];
}> {
  return this.api.get<{
    challengeId: string;
    statistics: {
      total_participants: number;
      total_votes: number;
      average_votes_per_participant: number;
    };
    leaderboard: LeaderboardEntry[];
  }>(
    `${this.VOTE_URL}/leaderboard`,
    { type: 'challenge', id: challengeId, limit }
  );
}

  /**
   * Récupère les statistiques globales des votes
   */
  getStats(): Observable<GlobalVoteStats> {
    return this.api.get<GlobalVoteStats>(`${this.VOTE_URL}/stats`);
  }

  /**
   * Vote en masse (admin uniquement)
   */
  bulkCast(votes: Array<{
    userId: string;
    contentId: string;
    challengeId?: string;
    nbVotes?: number;
  }>): Observable<BulkVoteResult> {
    return this.api.post<BulkVoteResult>(`${this.VOTE_URL}/bulk`, { votes });
  }

  // ─── Méthodes utilitaires ──────────────────────────────────────────────────

  getUserVoteForContent(userId: string, contentId: string, challengeId?: string): Observable<Vote | null> {
    return this.checkVote(userId, contentId, challengeId).pipe(
      map(response => response.vote)
    );
  }

  getTotalVotesForContent(contentId: string): Observable<number> {
    return this.getContentResults(contentId).pipe(
      map(results => results.statistics.total_votes)
    );
  }

  canUserVoteForChallenge(
    userId: string,
    contentId: string,
    challengeId: string
  ): Observable<{
    canVote: boolean;
    hasVotedInChallenge: boolean;
    voteRule: VoteRule;
    existingVote?: Vote;
  }> {
    return this.challengeService.getChallengeById(challengeId).pipe(
      switchMap(challenge => {
        const voteRule = challenge?.vote_rule as VoteRule || VoteRule.ONE_VOTE_PER_USER;

        if (voteRule === VoteRule.UNLIMITED_VOTES) {
          return of({ canVote: true, hasVotedInChallenge: false, voteRule });
        }

        return this.checkVote(userId, contentId, challengeId).pipe(
          map(response => ({
            canVote: !response.has_voted,
            hasVotedInChallenge: response.has_voted_in_challenge,
            voteRule,
            existingVote: response.vote || undefined
          }))
        );
      }),
      catchError(error => {
        console.error('Erreur lors de la vérification du droit de vote:', error);
        return of({
          canVote: false,
          hasVotedInChallenge: false,
          voteRule: VoteRule.ONE_VOTE_PER_USER
        });
      })
    );
  }

  addVoteToContent(vote: Vote, couponId: string, voteRule: VoteRule = VoteRule.UNLIMITED_VOTES): Observable<Vote> {
    if (voteRule === VoteRule.ONE_VOTE_PER_USER) {
      return this.checkVote(vote.userId, vote.contentId, vote.challengeId).pipe(
        switchMap(response => {
          if (response && response.has_voted) {
            return this.updateVote(response.vote!.id || '', {
              nbVotes: (response.vote?.nbVotes || 0) + (vote.nbVotes || 1)
            });
          } else {
            return this.castVote(
              vote.userId,
              vote.contentId,
              couponId,
              vote.challengeId,
              vote.nbVotes || 1
            );
          }
        })
      );
    }

    return this.castVote(
      vote.userId,
      vote.contentId,
      couponId,
      vote.challengeId,
      vote.nbVotes || 1
    );
  }

  removeVote(userId: string, contentId: string, challengeId?: string): Observable<void> {
    return this.checkVote(userId, contentId, challengeId).pipe(
      switchMap(response => {
        if (!response.has_voted || !response.vote) {
          return throwError(() => new Error('Aucun vote trouvé pour cet utilisateur'));
        }
        return this.deleteVote(response.vote.id ?? '');
      })
    );
  }

  updateUserVote(
    userId: string,
    contentId: string,
    newVoteValue: number,
    challengeId?: string
  ): Observable<Vote> {
    if (this.voteRule === VoteRule.ONE_VOTE_PER_USER) {
      return throwError(() =>
        new Error('La mise à jour des votes n\'est pas autorisée avec la règle ONE_VOTE_PER_USER')
      );
    }

    return this.checkVote(userId, contentId, challengeId).pipe(
      switchMap(response => {
        if (!response.has_voted || !response.vote) {
          return throwError(() => new Error('Aucun vote trouvé pour cet utilisateur'));
        }
        return this.updateVote(response.vote.id || '', { nbVotes: newVoteValue });
      })
    );
  }

  // ─── Méthodes de confort ───────────────────────────────────────────────────

  getLeaderboardWithUsers(contentId: string, limit: number = 20): Observable<LeaderboardEntry[]> {
    return this.getContentLeaderboard(contentId, limit).pipe(
      map(response => response.leaderboard)
    );
  }

  getContentStats(contentId: string): Observable<VoteStats> {
    return this.getContentResults(contentId).pipe(
      map(results => results.statistics)
    );
  }

  getChallengeVotesGroupedByContent(challengeId: string): Observable<ChallengeVoteResults> {
    return this.getChallengeResults(challengeId);
  }

  hasUserVoted(userId: string, contentId: string, challengeId?: string): Observable<boolean> {
    return this.checkVote(userId, contentId, challengeId).pipe(
      map(response => response.has_voted)
    );
  }
}