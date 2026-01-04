import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import { ApiJSON } from '../API/LOCAL/api-json';
import { User } from '../../models/User';
import * as bcrypt from 'bcryptjs';

export type AuthUser = Pick<
  User,
  'id' | 'email' | 'user_type' | 'status'
>;


@Injectable({
  providedIn: 'root',
})
export class Auth {

  private readonly STORAGE_KEY = 'auth_user';

  private currentUserSubject =
    new BehaviorSubject<AuthUser | null>(this.loadUserFromStorage());

  /** Observable public */
  currentUser$: Observable<AuthUser | null> =
    this.currentUserSubject.asObservable();

  constructor(private api: ApiJSON) {}

  /* ======================
     LOGIN
     ====================== */

  login(email: string, password: string): Observable<AuthUser> {
    return this.api.getAll<any>('users', { email }).pipe(
      map(users => {
        if (!users.length) {
          throw new Error('USER_NOT_FOUND');
        }

        const user = users[0];

        // Comparaison synchrone des mots de passe hachés
      const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
            if (!isPasswordValid) {
        throw new Error('INVALID_PASSWORD');
      }

        if (user.status !== 'active') {
          throw new Error('USER_BLOCKED');
        }

        return {
          id: user.id,
          email: user.email,
          user_type: user.user_type,
          status: user.status,
        } as AuthUser;
      }),
      tap(authUser => {
        localStorage.setItem(
          this.STORAGE_KEY,
          JSON.stringify(authUser)
        );
        this.currentUserSubject.next(authUser);
      })
    );
  }

  /* ======================
     LOGOUT
     ====================== */

  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.currentUserSubject.next(null);
  }

  /* ======================
     HELPERS
     ====================== */

  isAuthenticated(): boolean {
    return !!this.currentUserSubject.value;
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  private loadUserFromStorage(): AuthUser | null {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }
}
