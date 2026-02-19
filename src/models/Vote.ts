export interface Vote {
    id?: string;
    userId: string;
    contentId: string;
    challengeId: string;
    nbVotes: number;
    createdAt: string;
}

export interface VoteStatusResponse {
  contentId: string;
  isVoted: boolean;
  isBlocked: boolean;
}