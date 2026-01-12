// src/services/COMMENT/comment.service.ts
import { Injectable } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import { ApiJSON } from '../API/LOCAL/api-json';
import { Comment } from '../../models/Comment';

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  private readonly resource = 'comments';

  constructor(private api: ApiJSON) {}

  /**
   * Récupère les commentaires d'un contenu
   */
  getComments(contentId: string): Observable<Comment[]> {
    return this.api.getAll<Comment>(this.resource, {
      contentId,
      _sort: 'createdAt:desc'
    });
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
    return this.api.create<Comment>(this.resource, newComment);
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
/**
 * Like/Unlike un commentaire
 */
toggleLike(commentId: string, userId: string, isLiked: boolean): Observable<Comment> {
  // D'abord, récupérer le commentaire actuel
  return this.api.getById<Comment>(this.resource, commentId).pipe(
    switchMap(comment => {
      // Mettre à jour le nombre de likes localement
      const updatedLikes = isLiked ? comment.likes - 1 : comment.likes + 1;
      
      // Mettre à jour le commentaire avec le nouveau nombre de likes
      return this.api.patch<Comment>(this.resource, commentId, {
        likes: updatedLikes
      });
    })
  );
}
}