import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, delay, map, tap, throwError, of, firstValueFrom } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ApiJSON } from '../API/LOCAL/api-json'; // ✅ Migration vers notre ApiJSON unifié
import { User, UserProfile } from '../../models/User'
import * as bcrypt from 'bcryptjs';
import { ProfileService } from '../Service_profile/profile-service';
import { stringify } from 'uuid';
import { Router } from '@angular/router';


export type AuthUser = Pick<
  User,
  'id' | 'email' | 'user_type' | 'status' | 'readonly'
>;



// Interface pour la réponse de register du backend
export interface RegisterResponse {
  success: boolean;
  message?: string;
  user_id?: string;
  error?: string;
}


@Injectable({
  providedIn: 'root',
})
export class Auth {

  private readonly STORAGE_KEY = 'best_auth_user';
  private readonly TOKEN_STORAGE_KEY = 'access_token';
  private readonly REFRESH_TOKEN_STORAGE_KEY = 'refresh_token';
  private readonly SETTING_STORAGE_KEY = 'best_user_settings';
  private readonly WALLET_STORAGE_KEY = 'best_user_wallet_cache';
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes
  private loginAttempts = new Map<string, { attempts: number; lastAttempt: number }>();
  private currentUserSubject =
    new BehaviorSubject<AuthUser | null>(this.loadUserFromStorage());
  
  /** Observable public */
  currentUser$: Observable<AuthUser | null> =
    this.currentUserSubject.asObservable();

    
  constructor(private api: ApiJSON, private router: Router, private profileService:ProfileService) {} // ✅ Migration vers notre ApiJSON unifié

  /* ======================
     SIGNUP
     ====================== */

  signup(userData: any): Observable<RegisterResponse> {
    // Validation de base
    if (!userData.email || !userData.password) {
      return throwError(() => new Error('MISSING_CREDENTIALS'));
    }

    // Validation de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      return throwError(() => new Error('INVALID_EMAIL'));
    }

    // Validation du mot de passe
    if (userData.password.length < 8) {
      return throwError(() => new Error('PASSWORD_TOO_SHORT'));
    }

    // Préparer les données pour le backend selon la structure attendue
    const payload = {
      email: userData.email.toLowerCase().trim(),
      password: userData.password,
      displayName: userData.first_name+" "+userData.last_name || userData.email,
      user_type: userData.user_type || 'fan',
      user_status: userData.user_status
    };
    // Utiliser la route d'inscription dédiée
    return this.api.post<any>('auth/register', payload).pipe(
      switchMap(async (response: any) => {
        

        // Le backend retourne: message et user_id
        const userId = response.user_id;
      
        // Créer le profil utilisateur avec le même ID
        try {
         
          const userProfile = await this.createUserProfileModel({
            ...userData,
            id: userId // Utiliser le même ID que l'utilisateur créé
          });
          
          // Sauvegarder le profil dans la base de données
          await firstValueFrom(this.profileService.createProfile(userProfile));
          
          /*console.log(' User profile created successfully:', {
            userId: userId,
            username: userProfile.username
          });*/
          
        } catch (profileError: any) {
          console.error(' Failed to create user profile:', profileError.message);
          // Continuer quand même l'inscription même si le profil échoue
        }

        return {
          success: true,
          message: response.message || 'Compte créé avec succès',
          user_id: userId
        } as RegisterResponse;
      }),
      catchError((error: Error) => {
        console.error('Signup error:', error.message);
        return throwError(() => error);
      })
    );
  }

  private async createUserProfileModel(registrationData: any): Promise<UserProfile> {
     const { getRewardsForUserType } = await import('src/interfaces/levelReward.data');
        if (!registrationData) {
          throw new Error('Aucune donnée d\'inscription disponible');
        }
    
        return {
          id: registrationData.id || '', // Utiliser l'ID fourni ou chaîne vide par défaut
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
          isVerified: false,
          level: 1,
          xpPercent: 0,
          level_rewards: getRewardsForUserType(registrationData.user_type, 1, 0),
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
                const profile = await firstValueFrom(this.profileService.getProfileByUsername(username));
                return profile !== null;
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

    // Utiliser la route d'authentification dédiée
    return this.api.post<any>('auth/login', { email, password }).pipe(
        map((loginResponse: any) => {

        
            // Vérifier la réponse du backend
            if (!loginResponse.user) {
            
                this.recordFailedAttempt(email);
                throw new Error(loginResponse || 'AUTH_FAILED');
            }

            const user = loginResponse.user;

            // Vérification du statut du compte
            if (user.status !== 'active') {
                throw new Error('ACCOUNT_INACTIVE');
            }

           
        
            
            // Réinitialisation des tentatives en cas de succès
            this.loginAttempts.delete(email);

            const authUser: AuthUser = {
                id: user.id,
                email: user.email,
                user_type: user.user_type,
                status: user.status,
                readonly: user.readonly,
            };

            // Sauvegarder les données de session et créer la session backend
            this.handleSuccessfulLogin(authUser, loginResponse);

            return authUser;
        }),
        catchError((error: Error) => {
            return throwError(() => error);
        })
    );
}

private handleSuccessfulLogin(authUser: AuthUser, loginResponse: any): void {
 
    const safeUserData = {
        // Données utilisateur de base
        id: authUser.id,
        email: authUser.email,
        user_type: authUser.user_type,
        status: authUser.status,
        readonly: authUser.readonly,
        lastLogin: new Date().toISOString(),
        
        // Informations de session enrichies
        sessionId: this.generateSessionId(),
        deviceInfo: this.getDeviceInfo(),
        browserInfo: this.getBrowserInfo(),
        loginTime: new Date().toISOString(),
        isActive: true
    };
    
    // Sauvegarder dans localStorage
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(safeUserData));
    localStorage.setItem('access_token', loginResponse.access_token)
     localStorage.setItem('refresh_token', loginResponse.access_token)
    this.currentUserSubject.next(authUser);
 
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
     SESSION MANAGEMENT (Mobile Native)
     ====================== */


  getActiveSessionsCount(): Observable<number> {
    const currentUser = this.currentUserSubject.value;
    if (!currentUser) {
      return of(0);
    }

    // Récupérer toutes les sessions actives pour cet utilisateur depuis le backend
    return this.api.get<any>('sessions').pipe(
      map((sessions: any[]) => {
        const userActiveSessions = sessions.filter(session => 
          session.userId === currentUser.id.toString() && 
          session.isActive === true
        );
        return userActiveSessions.length;
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des sessions:', error);
        return of(0);
      })
    );
  }

  getSessionInfo(): any {
    const userData = this.loadUserFromStorage();
    return userData ? {
      sessionId: (userData as any).sessionId,
      deviceInfo: (userData as any).deviceInfo,
      browserInfo: (userData as any).browserInfo,
      loginTime: (userData as any).loginTime,
      isActive: (userData as any).isActive
    } : null;
  }

  revokeAllOtherSessions(userId: string, currentSessionId: string): void {
    // Récupérer toutes les sessions depuis le backend
    this.api.get<any>('sessions').subscribe({
      next: (sessions: any[]) => {
        const otherSessions = sessions.filter(session => 
          session.userId === userId && 
          session.sessionId !== currentSessionId && 
          session.isActive === true
        );

        // Révoquer chaque autre session
        const revokePromises = otherSessions.map(session => {
          return this.api.patch('sessions', session.id, { isActive: false }).toPromise();
        });

        Promise.all(revokePromises)
          .then(() => {
            console.log('Autres sessions révoquées avec succès');
          })
          .catch((error: any) => {
            console.error('Erreur lors de la révocation des sessions:', error);
          });
      },
      error: (error: any) => {
        console.error('Erreur lors de la récupération des sessions:', error);
      }
    });
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

  /* ======================
     LOGOUT
     ====================== */

  logout(): void {
    // Supprimer les données d'authentification
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.TOKEN_STORAGE_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(this.SETTING_STORAGE_KEY);
    localStorage.removeItem(this.WALLET_STORAGE_KEY);
    
    // Supprimer tous les caches
    this.clearAllCaches();
    
    // Notifier les observateurs
    this.currentUserSubject.next(null);
    
    // Déclencher un événement de stockage pour les autres composants
    window.dispatchEvent(new Event('storage'));
    
    // Rediriger vers la page de login
    this.router.navigate(['/login']);
  }

  /**
   * Supprime tous les caches (data-cache, media-cache, etc.)
   */
  private clearAllCaches(): void {
    try {
      // 1. Supprimer le cache de données IndexedDB (Best_data_Cache)
      if ('indexedDB' in window) {
        const deleteRequest = indexedDB.deleteDatabase('Best_data_Cache');
        deleteRequest.onsuccess = () => {
          console.log('✅ Cache de données supprimé');
        };
        deleteRequest.onerror = () => {
          console.error('❌ Erreur suppression cache de données');
        };
      }

      // 2. Supprimer le cache média IndexedDB (best_media_cache)
      if ('indexedDB' in window) {
        const deleteRequest = indexedDB.deleteDatabase('best_media_cache');
        deleteRequest.onsuccess = () => {
          console.log('✅ Cache média supprimé');
        };
        deleteRequest.onerror = () => {
          console.error('❌ Erreur suppression cache média');
        };
      }

      // 3. Vider le cache du navigateur (Cache API)
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          return Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
          );
        }).then(() => {
          console.log('✅ Cache API du navigateur vidé');
        }).catch(error => {
          console.error('❌ Erreur vidage Cache API:', error);
        });
      }

      // 4. Nettoyer localStorage (au cas où)
      const localStorageKeys = Object.keys(localStorage);
      localStorageKeys.forEach(key => {
        if (key.includes('cache') || key.includes('temp')) {
          localStorage.removeItem(key);
        }
      });

      // 5. Nettoyer sessionStorage
      const sessionStorageKeys = Object.keys(sessionStorage);
      sessionStorageKeys.forEach(key => {
        if (key.includes('cache') || key.includes('temp')) {
          sessionStorage.removeItem(key);
        }
      });

      console.log('🧹 Tous les caches ont été supprimés après la déconnexion');
      
    } catch (error) {
      console.error('❌ Erreur lors de la suppression des caches:', error);
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

  private loadUserFromStorage(): AuthUser | null {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }


}
