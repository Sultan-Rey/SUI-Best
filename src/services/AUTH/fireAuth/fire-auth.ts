import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, updatePassword as firebaseUpdatePassword, reauthenticateWithCredential, EmailAuthProvider, user, User as FirebaseUser, updateProfile, GoogleAuthProvider, signInWithCredential, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, UserProfile, sendEmailVerification } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc } from '@angular/fire/firestore';
import { BehaviorSubject, Observable, throwError, of, firstValueFrom } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { ProfileService } from 'src/services/PROFILE_SERVICE/profile-service';

export type AuthUser = {
  id: string;
  email: string;
  user_type: string;
  status: string;
  readonly: boolean;
  displayName?: string;
  photoURL?: string;
  plan?: any
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
  private readonly REDIRECT_KEY = 'best_google_redirect_pending';
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes
  private loginAttempts = new Map<string, { attempts: number; lastAttempt: number }>();
  private currentUserSubject = new BehaviorSubject<AuthUser | null>(this.loadUserFromStorage());
  
  /** Observable public */
  currentUser$: Observable<AuthUser | null> = this.currentUserSubject.asObservable();
  
  /** Firebase Auth User Observable */
  firebaseUser$: Observable<FirebaseUser | null> = runInInjectionContext(this.injector, () => user(this.auth));

  /** Événement pour notifier quand un utilisateur Google s'authentifie */
  private googleSignInSubject = new BehaviorSubject<FirebaseUser | null>(null);
  googleSignIn$: Observable<FirebaseUser | null> = this.googleSignInSubject.asObservable();

  constructor(
    private auth: Auth,
    private profileService: ProfileService,
    private firestore: Firestore,
    private injector: Injector
  ) {
    // Écouter les changements d'état de l'authentification Firebase
    // this.firebaseUser$.subscribe(firebaseUser => {
    //   if (firebaseUser) {
    //     this.syncUserData(firebaseUser);
    //   } else {
    //     this.logout();
    //   }
    // });
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
          const userDoc = await getDoc(doc(this.firestore, 'profiles', firebaseUser.uid));
          const userData = userDoc.data() as any;

          if (!userData) {
            throw new Error('PROFILE_NOT_FOUND');
          }

          // Vérification du statut du compte
          // if (!firebaseUser.emailVerified) {
          //   throw new Error('ACCOUNT_INACTIVE');
          // }

          // Réinitialisation des tentatives en cas de succès
          this.loginAttempts.delete(email);

          const authUser: AuthUser = {
            id: firebaseUser.uid,
            email: firebaseUser.email!,
            user_type: userData.type || 'user',
            status: firebaseUser.emailVerified ? 'active' : 'unactive',
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
            case 'auth/email-already-in-use':
              errorMessage = 'EMAIL_ALREADY_EXISTS';
              break;
              case 'auth/network-request-failed':
                errorMessage = 'NETWORK_REQUEST_FAILED';
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
     REGISTER
     ====================== */

  register(registrationData: any): Observable<AuthUser> {
    return new Observable<AuthUser>(observer => {
      createUserWithEmailAndPassword(this.auth, registrationData.email, registrationData.password)
        .then(async (userCredential) => {
          const firebaseUser = userCredential.user;
          if (!firebaseUser) {
            throw new Error('REGISTRATION_FAILED');
          }

          // Mettre à jour le profil Firebase avec displayName et photoURL
          const displayName = `${registrationData.first_name || ''} ${registrationData.last_name || ''}`.trim() || 'Utilisateur';
          await updateProfile(firebaseUser, {
            displayName: displayName,
            photoURL: 'default/avatar-default.png'
          });

          // Envoyer l'email de vérification
          await sendEmailVerification(firebaseUser);

          // Créer le document profile dans Firestore
           const userProfile = await this.createUserProfileModel(registrationData) ;
                delete (userProfile as any).id;
          
          await setDoc(doc(this.firestore, 'profiles', firebaseUser.uid), userProfile);
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
      const userDoc = await getDoc(doc(this.firestore, 'profiles', firebaseUser.uid));
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
  private async createUserProfileModel(registrationData: any): Promise<UserProfile> {
      if (!registrationData) {
        throw new Error('Aucune donnée d\'inscription disponible');
      }
  
      return {
        id: '',
        type: registrationData.user_type,
        myFollows: [],
        myBlackList: [],
        username: await this.generateUniqueUsername(
          registrationData.first_name || 'user',
          registrationData.last_name || registrationData.id
        ),
        displayName: `${registrationData.first_name || ''} ${registrationData.last_name || ''}`.trim() || 'Utilisateur',
        avatar: 'default/avatar-default.png',
        coverImg: 'default/cover_image_default.png',
        readonly: false,
        isFollowing: false,
        stats: {
          posts: 0,
          fans: 0,
          votes: 0,
          stars: 0
        },
        userInfo: {
          first_name: registrationData.first_name || '',
          last_name: registrationData.last_name || '',
          gender: registrationData.gender || '',
          birthDate: registrationData.birthDate || new Date(),
          age: registrationData.age || 0,
          email: registrationData.email || '',
          phone: registrationData.phone || '',
          address: registrationData.address || '',
          website: registrationData.website || '',
          memberShip: {date:registrationData.myPlan.startDate, plan: registrationData.myPlan.name},
          bio: registrationData.bio || '',
          school:  { id: registrationData.school.id, name: registrationData.school.name }
        }
      };
    }

    private async generateUniqueUsername(firstName: string, lastName: string): Promise<string> {
      // Nettoyer les caractères spéciaux et les accents
      const cleanString = (str: string) => {
        return str
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '') // Garde uniquement les lettres et chiffres
          .substring(0, 15); // Limite la longueur
      };
    
      const cleanFirstName = cleanString(firstName);
      const cleanLastName = cleanString(lastName);
      
      // Première tentative : prénom.nom
      let baseUsername = `${cleanFirstName}.${cleanLastName}`;
      let username = baseUsername;
      let counter = 1;
    
      // Vérifier si le nom d'utilisateur existe déjà
      const usernameExists = async (username: string): Promise<boolean> => {
        try {
          const profiles = await firstValueFrom(this.profileService.getProfiles());
          return profiles.some(profile => profile.username === username);
        } catch (error) {
          console.error('Erreur lors de la vérification du nom d\'utilisateur', error);
          return false; // En cas d'erreur, on considère que le nom est disponible
        }
      };
    
      // Tant que le nom d'utilisateur existe, on ajoute un numéro
      while (await usernameExists(username)) {
        username = `${baseUsername}${counter}`;
        counter++;
        
        // Limite de sécurité pour éviter les boucles infinies
        if (counter > 1000) {
          throw new Error('Impossible de générer un nom d\'utilisateur unique');
        }
      }
    
      return username;
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
