import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, delay, map, tap, throwError } from 'rxjs';
import { ApiJSON } from '../API/LOCAL/api-json';
import { User } from '../../models/User';
import * as bcrypt from 'bcryptjs';

export type AuthUser = Pick<
  User,
  'id' | 'email' | 'user_type' | 'status' | 'readonly'
>;


@Injectable({
  providedIn: 'root',
})
export class Auth {

  private readonly STORAGE_KEY = 'auth_user';
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes
  private loginAttempts = new Map<string, { attempts: number; lastAttempt: number }>();
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
    // Vérifier le verrouillage
    const userAttempts = this.loginAttempts.get(email);
    if (userAttempts && userAttempts.attempts >= this.MAX_ATTEMPTS) {
        const timeLeft = (userAttempts.lastAttempt + this.LOCKOUT_TIME) - Date.now();
        if (timeLeft > 0) {
            const minutesLeft = Math.ceil(timeLeft / (60 * 1000));
            return throwError(() => new Error('TOO_MANY_ATTEMPTS:' + minutesLeft));
        } else {
            this.loginAttempts.delete(email);
        }
    }

    // Validation de base
    if (!email || !password) {
        return throwError(() => new Error('MISSING_CREDENTIALS'));
    }

    return this.api.getAll<User>('users').pipe(
        delay(1000 + Math.random() * 1000),
        map(users => {
            // Vérification sensible à la casse de l'email
            const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
            
            if (!user) {
                this.recordFailedAttempt(email);
                throw new Error('AUTH_FAILED');
            }

            // Vérification du statut du compte
            if (user.status !== 'active') {
                throw new Error('ACCOUNT_INACTIVE');
            }

            // Vérification du mot de passe
            const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
            if (!isPasswordValid) {
                this.recordFailedAttempt(email);
                throw new Error('AUTH_FAILED');
            }

            // Réinitialisation des tentatives en cas de succès
            this.loginAttempts.delete(email);

            return {
                id: user.id,
                email: user.email,
                user_type: user.user_type,
                status: user.status,
                readonly: user.readonly,
            } as AuthUser;
        }),
        tap(authUser => {
            const safeUserData = {
                id: authUser.id,
                email: authUser.email,
                user_type: authUser.user_type,
                status: authUser.status,
                readonly: authUser.readonly,
                lastLogin: new Date().toISOString()
            };
            
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(safeUserData));
            this.currentUserSubject.next(authUser);
        }),
        catchError((error: Error) => {
            console.error('Login error:', error.message);
            return throwError(() => error);
        })
    );
}

  private recordFailedAttempt(email: string): void {
    const now = Date.now();
    const attempt = this.loginAttempts.get(email) || { attempts: 0, lastAttempt: 0 };
    
    // Réinitialiser le compteur si plus de 15 minutes se sont écoulées
    if (now - attempt.lastAttempt > this.LOCKOUT_TIME) {
      attempt.attempts = 0;
    }

    attempt.attempts++;
    attempt.lastAttempt = now;
    this.loginAttempts.set(email, attempt);

    console.warn(`Failed login attempt for ${email}. Attempt ${attempt.attempts}/${this.MAX_ATTEMPTS}`);
  }

  /* ======================
     LOGOUT
     ====================== */

  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.currentUserSubject.next(null);
    window.dispatchEvent(new Event('storage')); // Déclencher un événement de stockage
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
