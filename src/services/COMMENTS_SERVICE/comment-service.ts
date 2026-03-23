// src/services/COMMENT/comment.service.ts
import { Injectable } from '@angular/core';
import { Observable, of, Subject } from 'rxjs';
import { map, catchError, switchMap, tap, take } from 'rxjs/operators';
import { ApiJSON } from '../API/LOCAL/api-json'; // ✅ Migration vers notre ApiJSON unifié
import { Comment } from '../../models/Comment';
import { Content } from 'src/models/Content';

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  private readonly resource = 'comments';

  constructor(private api: ApiJSON) {} // ✅ Migration vers notre ApiJSON unifié

  private commentAdded = new Subject<{contentId: string, increment: number}>();
  commentAdded$ = this.commentAdded.asObservable();

  /**
   * Récupère les commentaires d'un contenu avec agrégation et réponses
   */
  getComments(contentId: string, limit: number = 10, offset: number = 0, currentUserId?: string): Observable<Comment[]> {
    return this.api.filter<Comment>(this.resource, 
      {filters: {contentId: contentId}}).pipe(
      map((comments: any) => {
        // Convertir l'objet avec clés numériques en tableau si nécessaire
        if (!Array.isArray(comments) && typeof comments === 'object') {
          comments = Object.values(comments);
        }
        
        const commentsArray = comments as Comment[];
        
        // Calculer isLiked pour chaque commentaire
        const commentsWithLikeStatus = commentsArray.map(comment => ({
          ...comment,
          isLiked: currentUserId && comment.likedBy ? comment.likedBy.includes(currentUserId) : false
        }));
        
        // Trier par date de création
        commentsWithLikeStatus.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        
        // Organiser les commentaires en hiérarchie
        return this.organizeComments(commentsWithLikeStatus);
      })
    );
  }

  /**
   * Organise les commentaires en hiérarchie (réponses) et agrège les commentaires du même utilisateur
   */
  private organizeComments(comments: Comment[]): Comment[] {
    const topLevelComments: Comment[] = [];
    const repliesMap = new Map<string, Comment[]>();
    
    // Séparer les commentaires de niveau supérieur et les réponses
    comments.forEach(comment => {
      if (!comment.parentId) {
        topLevelComments.push(comment);
      } else {
        if (!repliesMap.has(comment.parentId)) {
          repliesMap.set(comment.parentId, []);
        }
        repliesMap.get(comment.parentId)!.push(comment);
      }
    });
    
    // Agréger les commentaires consécutifs du même utilisateur
    const aggregatedComments = this.aggregateUserComments(topLevelComments);
    
    // Attacher les réponses aux commentaires parents
    aggregatedComments.forEach(comment => {
      const replies = repliesMap.get(comment.id!);
      if (replies) {
        comment.replies = this.aggregateUserComments(replies);
        comment.replyCount = replies.length;
      }
    });
    
    return aggregatedComments;
  }

  /**
   * Agrège les commentaires consécutifs du même utilisateur
   */
  private aggregateUserComments(comments: Comment[]): Comment[] {
    if (comments.length === 0) return [];
    
    const aggregated: Comment[] = [];
    let currentGroup: Comment[] = [comments[0]];
    
    for (let i = 1; i < comments.length; i++) {
      const currentComment = comments[i];
      const lastComment = currentGroup[currentGroup.length - 1];
      
      // Si même utilisateur et pas trop de temps écoulé (5 minutes), agréger
      if (currentComment.userId === lastComment.userId && 
          this.isWithinAggregationWindow(lastComment.createdAt, currentComment.createdAt)) {
        currentGroup.push(currentComment);
      } else {
        // Finaliser le groupe précédent
        if (currentGroup.length > 1) {
          aggregated.push(this.createAggregatedComment(currentGroup));
        } else {
          aggregated.push(currentGroup[0]);
        }
        
        // Commencer un nouveau groupe
        currentGroup = [currentComment];
      }
    }
    
    // Traiter le dernier groupe
    if (currentGroup.length > 1) {
      aggregated.push(this.createAggregatedComment(currentGroup));
    } else {
      aggregated.push(currentGroup[0]);
    }
    
    return aggregated;
  }

  /**
   * Vérifie si deux commentaires sont dans la fenêtre d'agrégation (5 minutes)
   */
  private isWithinAggregationWindow(earlierTime: string, laterTime: string): boolean {
    const earlier = new Date(earlierTime).getTime();
    const later = new Date(laterTime).getTime();
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes en millisecondes
    return (later - earlier) <= fiveMinutes;
  }

  /**
   * Crée un commentaire agrégé à partir d'un groupe de commentaires
   */
  private createAggregatedComment(comments: Comment[]): Comment {
    const firstComment = comments[0];
    const lastComment = comments[comments.length - 1];
    
    return {
      ...firstComment,
      isAggregated: true,
      aggregatedComments: comments,
      userCommentCount: comments.length,
      text: comments.map(c => c.text).join('\n'),
      likes: comments.reduce((sum, c) => sum + c.likes, 0),
      createdAt: firstComment.createdAt,
      updatedAt: lastComment.updatedAt || lastComment.createdAt
    };
  }

  /**
   * Récupère plus de commentaires (pagination)
   */
  getMoreComments(contentId: string, limit: number = 10, offset: number = 0): Observable<Comment[]> {
    return this.getComments(contentId, limit, offset);
  }

  /**
   * Ajoute une réponse à un commentaire
   */
  addReply(parentComment: Comment, reply: Omit<Comment, 'id' | 'createdAt' | 'likes' | 'parentId'>): Observable<Comment> {
    const newReply = {
      ...reply,
      parentId: parentComment.id,
      likes: 0,
      createdAt: new Date().toISOString(),
      replies: []
    };
    
    return this.api.create<Comment>(this.resource, newReply).pipe(
      tap(createdReply => {
        this.commentAdded.next({
          contentId: reply.contentId, 
          increment: 1
        });
      })
    );
  }

  /**
   * Compte le nombre de commentaires pour un contenu
   */
  getCommentCount(contentId: string): Observable<number> {
    return this.api.filter<Comment>(this.resource, {filters:{contentId: contentId}}).pipe(
      map((comments: any) => {
        // Convertir l'objet avec clés numériques en tableau si nécessaire
        if (!Array.isArray(comments) && typeof comments === 'object') {
          comments = Object.values(comments);
        }
        return (comments as Comment[]).length || 0;
      }),
      tap((count)=> console.log("count : ", count))
    );
  }

  /**
   * Ajoute un nouveau commentaire
   */
  addComment(comment: Omit<Comment, 'id' | 'createdAt' | 'likes'>): Observable<Comment> {
  const newComment = {
    ...comment,
    likes: 0,
    createdAt: new Date().toISOString(),
    replies: []
  };
  
  return this.api.create<Comment>('comments', newComment).pipe(
    tap(createdComment => {
      this.commentAdded.next({
        contentId: comment.contentId, 
        increment: 1
      });
    })
  );
}

  private updateContentCommentCount(contentId: string, increment: number): void {
  this.api.getById<Content>('contents', contentId).pipe(
    take(1),
    switchMap(content => {
      const newCount = (content?.commentCount || 0) + increment;
      return this.api.update<Content>('contents', contentId, {
        commentCount: newCount
      });
    })
  ).subscribe({
    next: () => console.log('Comment count updated'),
    error: (err) => console.error('Failed to update comment count', err)
  });
}
  /**
   * Met à jour un commentaire existant
   */
  updateComment(commentId: string, updates: Partial<Comment>): Observable<Comment> {
    return this.api.patch<Comment>(this.resource, commentId, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Supprime un commentaire
   */
  deleteComment(commentId: string): Observable<void> {
    return this.api.delete(this.resource, commentId);
  }

  /**
   * Like/Unlike un commentaire
   */
toggleLike(commentId: string, userId: string, isLiked: boolean): Observable<Comment> {
  // D'abord, récupérer le commentaire actuel
  return this.api.getById<Comment>(this.resource, commentId).pipe(
    switchMap(comment => {
      // Mettre à jour le tableau likedBy et le nombre de likes
      let updatedLikedBy = comment?.likedBy || [];
      let updatedLikes = comment?.likes || 0;
      
      if (isLiked) {
        // Unlike: retirer l'utilisateur du tableau
        updatedLikedBy = updatedLikedBy.filter(id => id !== userId);
        updatedLikes = Math.max(0, updatedLikes - 1);
      } else {
        // Like: ajouter l'utilisateur au tableau
        if (!updatedLikedBy.includes(userId)) {
          updatedLikedBy.push(userId);
          updatedLikes = updatedLikes + 1;
        }
      }
      
      // Mettre à jour le commentaire avec le nouveau tableau et le nouveau nombre de likes
      return this.api.patch<Comment>(this.resource, commentId, {
        likedBy: updatedLikedBy,
        likes: updatedLikes
      });
    })
  );
}
}