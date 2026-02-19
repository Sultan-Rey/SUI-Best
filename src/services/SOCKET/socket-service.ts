import { Injectable } from '@angular/core';
import { ApiJSON } from '../API/LOCAL/api-json';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface Socket {
  id: string;
  last_update: string;
  socket: Array<{
    id: string;
    ping: number;
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private readonly SOCKETS_RESOURCE = 'sockets';

  constructor(private api: ApiJSON) {}

  // ==============================================================
  //  CRUD OPERATIONS
  // ==============================================================

  /**
   * Crée un nouveau socket pour une conversation
   */
  socketCreate(conversationId: string, participantIds: string[]): Observable<Socket> {
    const newSocket: Socket = {
      id: conversationId,
      last_update: new Date().toISOString(),
      socket: participantIds.map(id => ({
        id: id,
        ping: 0
      }))
    };

    return this.api.create<Socket>(this.SOCKETS_RESOURCE, newSocket).pipe(
      catchError(error => {
        console.error('[SocketService] Error creating socket:', error);
        return of(newSocket); // Retourner le socket local en cas d'erreur
      })
    );
  }

  /**
   * Met à jour le ping d'un participant dans un socket
   */
  socketPing(conversationId: string, participantId: string, ping: number): Observable<Socket | null> {
    return this.api.get<Socket[]>(this.SOCKETS_RESOURCE).pipe(
      map(sockets => {
        const socket = sockets.find(s => s.id === conversationId);
        if (!socket) {
          console.warn('[SocketService] Socket not found, creating new one');
          this.socketCreate(conversationId, [participantId]).subscribe();
          return null;
        }

        // Mettre à jour le ping du participant
        const participantIndex = socket.socket.findIndex(p => p.id === participantId);
        if (participantIndex !== -1) {
          socket.socket[participantIndex].ping = ping;
          socket.last_update = new Date().toISOString();
          
          // Sauvegarder les modifications
          this.api.patch(this.SOCKETS_RESOURCE, conversationId, socket).subscribe();
        }

        return socket;
      }),
      catchError(error => {
        console.error('[SocketService] Error updating ping:', error);
        return of(null);
      })
    );
  }

  /**
   * Supprime un socket
   */
  socketDelete(conversationId: string): Observable<void> {
    return this.api.delete(this.SOCKETS_RESOURCE,conversationId).pipe(
      catchError(error => {
        console.error('[SocketService] Error deleting socket:', error);
        return of();
      })
    );
  }

  /**
   * Trouve un socket par son ID
   */
  socketFind(conversationId: string): Observable<Socket | null> {
    return this.api.get<Socket[]>(this.SOCKETS_RESOURCE).pipe(
      map(sockets => sockets.find(s => s.id === conversationId) || null),
      catchError(error => {
        console.error('[SocketService] Error finding socket:', error);
        return of(null);
      })
    );
  }

  /**
   * Vérifie le ping d'un participant
   */
  socketPingCheck(conversationId: string, participantId: string): Observable<number> {
    return this.socketFind(conversationId).pipe(
      map(socket => {
        if (!socket) return 0;
        const participant = socket.socket.find(p => p.id === participantId);
        return participant ? participant.ping : 0;
      }),
      catchError(error => {
        console.error('[SocketService] Error checking ping:', error);
        return of(0);
      })
    );
  }

  /**
   * Nettoie les sockets inactifs (plus de 30 secondes)
   */
  socketClearance(): Observable<void> {
    return this.api.get<Socket[]>(this.SOCKETS_RESOURCE).pipe(
      map(sockets => {
        const now = new Date();
        const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);

        sockets.forEach(socket => {
          const lastUpdate = new Date(socket.last_update);
          const allPingsZero = socket.socket.every(p => p.ping === 0);
          
          if (allPingsZero && lastUpdate < thirtySecondsAgo) {
            this.socketDelete(socket.id).subscribe();
          }
        });
      }),
      catchError(error => {
        console.error('[SocketService] Error during clearance:', error);
        return of();
      })
    );
  }

  // ==============================================================
  //  UTILITAIRES
  // ==============================================================

  /**
   * Vérifie si l'autre participant est en train de taper
   */
  isOtherParticipantTyping(conversationId: string, currentUserId: string): Observable<boolean> {
    return this.socketFind(conversationId).pipe(
      map(socket => {
        if (!socket) return false;
        const otherParticipant = socket.socket.find(p => p.id !== currentUserId);
        return otherParticipant ? otherParticipant.ping === 1 : false;
      }),
      catchError(error => {
        console.error('[SocketService] Error checking typing status:', error);
        return of(false);
      })
    );
  }

  /**
   * Initialise ou récupère un socket pour une conversation
   */
  initializeSocket(conversationId: string, participantIds: string[]): Observable<Socket | null> {
    return this.socketFind(conversationId).pipe(
      map(existingSocket => {
        if (existingSocket) {
          // Réinitialiser les pings à 0
          existingSocket.socket.forEach(p => p.ping = 0);
          existingSocket.last_update = new Date().toISOString();
          this.api.patch(this.SOCKETS_RESOURCE, conversationId, existingSocket).subscribe();
          return existingSocket;
        } else {
          // Créer un nouveau socket
          this.socketCreate(conversationId, participantIds).subscribe();
          return null;
        }
      }),
      catchError(error => {
        console.error('[SocketService] Error initializing socket:', error);
        return of(null);
      })
    );
  }
}
