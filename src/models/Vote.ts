export interface Vote {
    id?: string;
    userId: string;
    contentId: string;
    nbVotes: number;
    createdAt: string;
}