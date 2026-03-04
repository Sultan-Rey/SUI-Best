import { Injectable } from '@angular/core';
import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, updatePassword as firebaseUpdatePassword, reauthenticateWithCredential, EmailAuthProvider, user, User as FirebaseUser, updateProfile, GoogleAuthProvider, signInWithCredential, signInWithPopup, signInWithRedirect, getRedirectResult } from '@angular/fire/auth';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { Firestore, doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc } from '@angular/fire/firestore';

export type AuthUser = {
  id: string;
  email: string;
  user_type: string;
  status: string;
  readonly: boolean;
  displayName?: string;
  photoURL?: string;
};

interface SessionData {
  sessionId: string;
  deviceInfo: string;
  browserInfo: string;
  loginTime: string;
  isActive: boolean;
  lastLogin?: string;
}

@Injectable({
  providedIn: 'root',
})
export class FireAuth {
  private readonly STORAGE_KEY = 'best_auth_user';
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes
  private loginAttempts = new Map<string, { attempts: number; lastAttempt: number }>();
  private currentUserSubject = new BehaviorSubject<AuthUser | null>(this.loadUserFromStorage());
  
  /** Observable public */
  currentUser$: Observable<AuthUser | null> = this.currentUserSubject.asObservable();
  
  /** Firebase Auth User Observable */
  firebaseUser$: Observable<FirebaseUser | null> = user(this.auth);

  constructor(
    private auth: Auth,
    private firestore: Firestore
  ) {
    // Écouter les changements d'état de l'authentification Firebase
    this.firebaseUser$.subscribe(firebaseUser => {
      if (firebaseUser) {
        this.syncUserData(firebaseUser);
      } else {
        this.logout();
      }
    });
  }

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

    return new Observable<AuthUser>(observer => {
      signInWithEmailAndPassword(this.auth, email, password)
        .then(async (userCredential) => {
          const firebaseUser = userCredential.user;
          if (!firebaseUser) {
            throw new Error('AUTH_FAILED');
          }

          // Récupérer les données utilisateur depuis Firestore
          const userDoc = await getDoc(doc(this.firestore, 'users', firebaseUser.uid));
          const userData = userDoc.data() as any;

          if (!userData) {
            throw new Error('USER_NOT_FOUND');
          }

          // Vérification du statut du compte
          if (userData.status !== 'active') {
            throw new Error('ACCOUNT_INACTIVE');
          }

          // Réinitialisation des tentatives en cas de succès
          this.loginAttempts.delete(email);

          const authUser: AuthUser = {
            id: firebaseUser.uid,
            email: firebaseUser.email!,
            user_type: userData.user_type || 'user',
            status: userData.status || 'active',
            readonly: userData.readonly || false,
            displayName: firebaseUser.displayName || undefined,
            photoURL: firebaseUser.photoURL || undefined
          };

          // Sauvegarder dans localStorage
          const safeUserData = {
            ...authUser,
            lastLogin: new Date().toISOString(),
            sessionId: this.generateSessionId(),
            deviceInfo: this.getDeviceInfo(),
            browserInfo: this.getBrowserInfo(),
            loginTime: new Date().toISOString(),
            isActive: true
          };
          
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(safeUserData));
          this.currentUserSubject.next(authUser);
          
          // Créer la session dans Firestore
          await this.createSessionInFirestore(authUser.id, safeUserData);

          observer.next(authUser);
          observer.complete();
        })
        .catch((error) => {
          this.recordFailedAttempt(email);
          console.error('Login error:', error);
          let errorMessage = 'AUTH_FAILED';
          
          switch (error.code) {
            case 'auth/user-not-found':
              errorMessage = 'USER_NOT_FOUND';
              break;
            case 'auth/wrong-password':
              errorMessage = 'INVALID_PASSWORD';
              break;
            case 'auth/user-disabled':
              errorMessage = 'ACCOUNT_DISABLED';
              break;
            case 'auth/too-many-requests':
              errorMessage = 'TOO_MANY_REQUESTS';
              break;
          }
          
          observer.error(new Error(errorMessage));
        });
    }).pipe(
      catchError((error: Error) => {
        console.error('Login error:', error.message);
        return throwError(() => error);
      })
    );
  }

  /* ======================
     GOOGLE SIGN-IN
     ====================== */

  async signInWithGoogle(): Promise<{ user: FirebaseUser; isNewUser: boolean }> {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(this.auth, provider);
      const firebaseUser = result.user;

      // Vérifier si l'utilisateur existe déjà dans Firestore
      const userDoc = await getDoc(doc(this.firestore, 'users', firebaseUser.uid));
      const isNewUser = !userDoc.exists();

      if (isNewUser) {
        // Créer le document utilisateur pour les nouveaux utilisateurs
        const newUserData: AuthUser = {
          id: firebaseUser.uid,
          email: firebaseUser.email!,
          user_type: 'fan', // Par défaut
          status: 'active',
          readonly: false,
          displayName: firebaseUser.displayName || undefined,
          photoURL: firebaseUser.photoURL || undefined
        };

        await setDoc(doc(this.firestore, 'users', firebaseUser.uid), {
          ...newUserData,
          created_at: new Date(),
          updated_at: new Date()
        });

        // Sauvegarder dans localStorage
        const safeUserData = {
          ...newUserData,
          lastLogin: new Date().toISOString(),
          sessionId: this.generateSessionId(),
          deviceInfo: this.getDeviceInfo(),
          browserInfo: this.getBrowserInfo(),
          loginTime: new Date().toISOString(),
          isActive: true
        };
        
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(safeUserData));
        this.currentUserSubject.next(newUserData);
        
        // Créer la session dans Firestore
        await this.createSessionInFirestore(newUserData.id, safeUserData);
      } else {
        // Utilisateur existant - mettre à jour la session
        const userData = userDoc.data() as AuthUser;
        
        const authUser: AuthUser = {
          id: firebaseUser.uid,
          email: firebaseUser.email!,
          user_type: userData.user_type || 'fan',
          status: userData.status || 'active',
          readonly: userData.readonly || false,
          displayName: firebaseUser.displayName || userData.displayName,
          photoURL: firebaseUser.photoURL || userData.photoURL
        };

        // Sauvegarder dans localStorage
        const safeUserData = {
          ...authUser,
          lastLogin: new Date().toISOString(),
          sessionId: this.generateSessionId(),
          deviceInfo: this.getDeviceInfo(),
          browserInfo: this.getBrowserInfo(),
          loginTime: new Date().toISOString(),
          isActive: true
        };
        
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(safeUserData));
        this.currentUserSubject.next(authUser);
        
        // Créer la session dans Firestore
        await this.createSessionInFirestore(authUser.id, safeUserData);
      }

      return { user: firebaseUser, isNewUser };
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  }

  /* ======================
     GOOGLE SIGN-IN (REDIRECT)
     ====================== */

  async signInWithGoogleRedirect(): Promise<void> {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(this.auth, provider);
      // L'utilisateur sera redirigé vers Google, puis reviendra à l'app
      // Le résultat sera géré par handleRedirectResult()
    } catch (error: any) {
      console.error('Google redirect sign-in error:', error);
      throw error;
    }
  }

  async handleRedirectResult(): Promise<{ user: FirebaseUser; isNewUser: boolean } | null> {
    try {
      const result = await getRedirectResult(this.auth);
      
      if (!result) {
        return null; // Pas de redirection en cours
      }

      const firebaseUser = result.user;

      // Vérifier si l'utilisateur existe déjà dans Firestore
      const userDoc = await getDoc(doc(this.firestore, 'users', firebaseUser.uid));
      const isNewUser = !userDoc.exists();

      if (isNewUser) {
        // Créer le document utilisateur pour les nouveaux utilisateurs
        const newUserData: AuthUser = {
          id: firebaseUser.uid,
          email: firebaseUser.email!,
          user_type: 'fan', // Par défaut
          status: 'active',
          readonly: false,
          displayName: firebaseUser.displayName || undefined,
          photoURL: firebaseUser.photoURL || undefined
        };

        await setDoc(doc(this.firestore, 'users', firebaseUser.uid), {
          ...newUserData,
          created_at: new Date(),
          updated_at: new Date()
        });

        // Sauvegarder dans localStorage
        const safeUserData = {
          ...newUserData,
          lastLogin: new Date().toISOString(),
          sessionId: this.generateSessionId(),
          deviceInfo: this.getDeviceInfo(),
          browserInfo: this.getBrowserInfo(),
          loginTime: new Date().toISOString(),
          isActive: true
        };
        
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(safeUserData));
        this.currentUserSubject.next(newUserData);
        
        // Créer la session dans Firestore
        await this.createSessionInFirestore(newUserData.id, safeUserData);
      } else {
        // Utilisateur existant - mettre à jour la session
        const userData = userDoc.data() as AuthUser;
        
        const authUser: AuthUser = {
          id: firebaseUser.uid,
          email: firebaseUser.email!,
          user_type: userData.user_type || 'fan',
          status: userData.status || 'active',
          readonly: userData.readonly || false,
          displayName: firebaseUser.displayName || userData.displayName,
          photoURL: firebaseUser.photoURL || userData.photoURL
        };

        // Sauvegarder dans localStorage
        const safeUserData = {
          ...authUser,
          lastLogin: new Date().toISOString(),
          sessionId: this.generateSessionId(),
          deviceInfo: this.getDeviceInfo(),
          browserInfo: this.getBrowserInfo(),
          loginTime: new Date().toISOString(),
          isActive: true
        };
        
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(safeUserData));
        this.currentUserSubject.next(authUser);
        
        // Créer la session dans Firestore
        await this.createSessionInFirestore(authUser.id, safeUserData);
      }

      return { user: firebaseUser, isNewUser };
    } catch (error: any) {
      console.error('Handle redirect result error:', error);
      throw error;
    }
  }

  /* ======================
     REGISTER
     ====================== */

  register(email: string, password: string, userData: Partial<AuthUser>): Observable<AuthUser> {
    return new Observable<AuthUser>(observer => {
      createUserWithEmailAndPassword(this.auth, email, password)
        .then(async (userCredential) => {
          const firebaseUser = userCredential.user;
          if (!firebaseUser) {
            throw new Error('REGISTRATION_FAILED');
          }

          // Créer le document utilisateur dans Firestore
          const userDocData = {
            email: firebaseUser.email,
            user_type: userData.user_type || 'user',
            status: 'active',
            readonly: userData.readonly || false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          await setDoc(doc(this.firestore, 'users', firebaseUser.uid), userDocData);

          const authUser: AuthUser = {
            id: firebaseUser.uid,
            email: firebaseUser.email!,
            user_type: userDocData.user_type,
            status: userDocData.status,
            readonly: userDocData.readonly,
            displayName: firebaseUser.displayName || undefined,
            photoURL: firebaseUser.photoURL || undefined
          };

          observer.next(authUser);
          observer.complete();
        })
        .catch((error) => {
          console.error('Registration error:', error);
          let errorMessage = 'REGISTRATION_FAILED';
          
          switch (error.code) {
            case 'auth/email-already-in-use':
              errorMessage = 'EMAIL_ALREADY_EXISTS';
              break;
            case 'auth/weak-password':
              errorMessage = 'WEAK_PASSWORD';
              break;
            case 'auth/invalid-email':
              errorMessage = 'INVALID_EMAIL';
              break;
          }
          
          observer.error(new Error(errorMessage));
        });
    });
  }

  /* ======================
     PASSWORD RESET
     ====================== */

  resetPassword(email: string): Observable<void> {
    return new Observable<void>(observer => {
      sendPasswordResetEmail(this.auth, email)
        .then(() => {
          observer.next();
          observer.complete();
        })
        .catch((error) => {
          console.error('Password reset error:', error);
          let errorMessage = 'PASSWORD_RESET_FAILED';
          
          switch (error.code) {
            case 'auth/user-not-found':
              errorMessage = 'USER_NOT_FOUND';
              break;
            case 'auth/invalid-email':
              errorMessage = 'INVALID_EMAIL';
              break;
          }
          
          observer.error(new Error(errorMessage));
        });
    });
  }

  /* ======================
     UPDATE PASSWORD
     ====================== */

  updatePassword(newPassword: string, currentPassword?: string): Observable<void> {
    return new Observable<void>(observer => {
      const currentUser = this.auth.currentUser;
      if (!currentUser) {
        observer.error(new Error('USER_NOT_LOGGED_IN'));
        return;
      }

      const updatePasswordPromise = currentPassword 
        ? this.reauthenticateAndUpdatePassword(currentUser, currentPassword, newPassword)
        : firebaseUpdatePassword(currentUser, newPassword);

      updatePasswordPromise
        .then(() => {
          observer.next();
          observer.complete();
        })
        .catch((error: any) => {
          console.error('Update password error:', error);
          let errorMessage = 'PASSWORD_UPDATE_FAILED';
          
          switch (error.code) {
            case 'auth/weak-password':
              errorMessage = 'WEAK_PASSWORD';
              break;
            case 'auth/requires-recent-login':
              errorMessage = 'REQUIRES_RECENT_LOGIN';
              break;
            case 'auth/wrong-password':
              errorMessage = 'INVALID_CURRENT_PASSWORD';
              break;
          }
          
          observer.error(new Error(errorMessage));
        });
    });
  }

  private async reauthenticateAndUpdatePassword(user: FirebaseUser, currentPassword: string, newPassword: string): Promise<void> {
    const credential = EmailAuthProvider.credential(user.email!, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await firebaseUpdatePassword(user, newPassword);
  }

  /* ======================
     SESSION MANAGEMENT
     ====================== */

  private async createSessionInFirestore(userId: string, sessionData: any): Promise<void> {
    try {
      const sessionPayload = {
        userId,
        sessionId: sessionData.sessionId,
        deviceInfo: sessionData.deviceInfo,
        browserInfo: sessionData.browserInfo,
        loginTime: sessionData.loginTime,
        isActive: true,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(this.firestore, 'sessions', sessionData.sessionId), sessionPayload);
    } catch (error) {
      console.error('Erreur lors de la création de session:', error);
    }
  }

  getActiveSessionsCount(): Observable<number> {
    const currentUser = this.currentUserSubject.value;
    if (!currentUser) {
      return of(0);
    }

    return new Observable<number>(observer => {
      const q = query(
        collection(this.firestore, 'sessions'),
        where('userId', '==', currentUser.id),
        where('isActive', '==', true)
      );

      getDocs(q)
        .then((querySnapshot) => {
          observer.next(querySnapshot.size);
          observer.complete();
        })
        .catch((error) => {
          console.error('Erreur lors de la récupération des sessions:', error);
          observer.next(0);
          observer.complete();
        });
    });
  }

  async revokeAllOtherSessions(userId: string, currentSessionId: string): Promise<void> {
    try {
      const q = query(
        collection(this.firestore, 'sessions'),
        where('userId', '==', userId),
        where('sessionId', '!=', currentSessionId),
        where('isActive', '==', true)
      );

      const querySnapshot = await getDocs(q);
      const batch = querySnapshot.docs.map(doc => 
        updateDoc(doc.ref, { isActive: false, revokedAt: new Date().toISOString() })
      );

      await Promise.all(batch);
      console.log('Autres sessions révoquées avec succès');
    } catch (error) {
      console.error('Erreur lors de la révocation des sessions:', error);
    }
  }

  /* ======================
     LOGOUT
     ====================== */

  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
    } catch (error) {
      console.error('Firebase logout error:', error);
    } finally {
      localStorage.removeItem(this.STORAGE_KEY);
      this.currentUserSubject.next(null);
      window.dispatchEvent(new Event('storage'));
    }
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

  getCurrentFirebaseUser(): FirebaseUser | null {
    return this.auth.currentUser;
  }

  private async syncUserData(firebaseUser: FirebaseUser): Promise<void> {
    try {
      const userDoc = await getDoc(doc(this.firestore, 'users', firebaseUser.uid));
      const userData = userDoc.data() as any;

      if (userData) {
        const authUser: AuthUser = {
          id: firebaseUser.uid,
          email: firebaseUser.email!,
          user_type: userData.user_type || 'user',
          status: userData.status || 'active',
          readonly: userData.readonly || false,
          displayName: firebaseUser.displayName || undefined,
          photoURL: firebaseUser.photoURL || undefined
        };

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
          ...authUser,
          lastLogin: new Date().toISOString()
        }));
        
        this.currentUserSubject.next(authUser);
      }
    } catch (error) {
      console.error('Error syncing user data:', error);
    }
  }

  private recordFailedAttempt(email: string): void {
    const now = Date.now();
    const attempt = this.loginAttempts.get(email) || { attempts: 0, lastAttempt: 0 };
    
    if (now - attempt.lastAttempt > this.LOCKOUT_TIME) {
      attempt.attempts = 0;
    }

    attempt.attempts++;
    attempt.lastAttempt = now;
    this.loginAttempts.set(email, attempt);

    console.warn(`Failed login attempt for ${email}. Attempt ${attempt.attempts}/${this.MAX_ATTEMPTS}`);
  }

  private generateSessionId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private getDeviceInfo(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Mobile')) return 'Mobile';
    if (ua.includes('Tablet')) return 'Tablette';
    return 'Desktop';
  }

  private getBrowserInfo(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  private loadUserFromStorage(): AuthUser | null {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  getSessionInfo(): SessionData | null {
    const userData = this.loadUserFromStorage();
    return userData ? {
      sessionId: (userData as any).sessionId,
      deviceInfo: (userData as any).deviceInfo,
      browserInfo: (userData as any).browserInfo,
      loginTime: (userData as any).loginTime,
      isActive: (userData as any).isActive
    } : null;
  }
}
