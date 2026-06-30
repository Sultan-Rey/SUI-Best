import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, delay, map, tap, throwError, of, firstValueFrom, from, forkJoin } from 'rxjs';
import { filter, first, switchMap, timeout } from 'rxjs/operators';
import { ApiJSON } from '../API/api-json';
import { User, UserProfile } from '../../models/User'
import { ProfileService } from '../Service_profile/profile-service';
import { Router } from '@angular/router';
import { isNullOrUndefined } from 'html5-qrcode/esm/core';



export type AuthUser = Pick<
  User,
  'id' | 'email' | 'user_type' | 'user_status' | 'status' | 'readonly'
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
  private readonly TOKEN_STORAGE_KEY = 'best_access_token';
  private readonly TOKEN_REFRESH_STORAGE_KEY = 'best_refresh_token';
  private readonly ADMIN_UID_STORAGE_KEY = 'best_admin_uid';
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes
  private loginAttempts = new Map<string, { attempts: number; lastAttempt: number }>();
  private currentUserSubject =
    new BehaviorSubject<AuthUser | null>(this.loadUserFromStorage());
  private currentProfileSubject = 
    new BehaviorSubject<UserProfile | null>(null);
  /** Observable public */
  currentUser$: Observable<AuthUser | null> =
    this.currentUserSubject.asObservable();
  currentProfile$: Observable<UserProfile | null> =
    this.currentProfileSubject.asObservable();
    
  constructor(private api: ApiJSON, private router: Router, private profileService:ProfileService) {
    if(!this.getCurrentUser() || this.getCurrentUser() == null) return;
    this.loadUserProfileFromBackend().then((profile)=>{
      this.currentProfileSubject.next(profile);
    })
  } // ✅ Migration vers notre ApiJSON unifié

  private generateUniqueId(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID(); // Génère un UUID v4 standard (ex: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed")
  }
  // Fallback si l'environnement ne supporte pas randomUUID
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

  /* ======================
     SIGNUP
     ====================== */

signup(userData: any): Observable<RegisterResponse> {
  // 1. Validations de base obligatoires
  if (!userData?.email || !userData?.password) {
    return throwError(() => new Error('MISSING_CREDENTIALS'));
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(userData.email)) {
    return throwError(() => new Error('INVALID_EMAIL'));
  }

  if (userData.password.length < 8) {
    return throwError(() => new Error('PASSWORD_TOO_SHORT'));
  }

  // 🛠️ DEBUG SÉRIEUX : Normalisation et mise à plat de la structure des données
  // Si les infos arrivent encapsulées dans userInfo (provenant du payload de registration.page)
  // on les remonte à la racine pour satisfaire à la fois l'API et createUserProfileModel.
  const info = userData.userInfo || {};
  
  const currentStatus = userData.user_status || userData.status;
  const schoolData = info.school || userData.school || null;

  // 2. Détermination de l'ID Unique de manière évocatrice
  let generatedUserId = '';
  if (currentStatus === 'student') {
    generatedUserId = `STU_${this.generateUniqueId()}`;
  } else if (currentStatus === 'university' || currentStatus === 'institution') {
    const schoolId = schoolData?.id || this.generateUniqueId();
    generatedUserId = `INS_${schoolId}`;
  } else {
    generatedUserId = `FAN_${this.generateUniqueId()}`;
  }

  // 📦 Reconstruction d'un objet userData parfait et "plat"
  // Ainsi, createUserProfileModel trouvera userData.school.id ET userData.first_name sans planter !
  const normalizedUserData = {
    ...userData,
    id: generatedUserId,
    user_status: currentStatus || 'fan',
    first_name: info.first_name || userData.first_name || '',
    last_name: info.last_name || userData.last_name || '',
    birthDate: info.birthDate || userData.birthDate || '',
    age: info.age || userData.age || null,
    school: {
      id: schoolData?.id || '',
      name: schoolData?.name || '',
      level: schoolData?.level || ''
    }
  };

  // 3. Transformation asynchrone pour générer le modèle de profil complet
  return from(this.createUserProfileModel(normalizedUserData)).pipe(
    switchMap((profileModel) => {
      const platformInfo = this.detectPlatform();

      // Extraction propre pour correspondre au format d'entrée strict attendu par ton API PHP
      const payload = {
        user_id: generatedUserId,
        email: normalizedUserData.email.toLowerCase().trim(),
        password: normalizedUserData.password,
        qr_code: normalizedUserData.qr_proof || normalizedUserData.qr_code || '',
        user_status: normalizedUserData.user_status,
        user_type: normalizedUserData.type || 'fan',
        displayName: profileModel?.displayName || `${normalizedUserData.first_name} ${normalizedUserData.last_name}`.trim() || normalizedUserData.email,
        platform: platformInfo.type,
        device_info: platformInfo.info,
        profile_payload: profileModel 
      };

      // Un seul et unique appel HTTP vers ton contrôleur PHP
      return this.api.post<any>('auth/register', payload);
    }),
    switchMap((response: any) => {
      return [{
        success: response?.success !== false,
        message: response?.message || 'Compte créé avec succès.',
        user_id: response?.user_id || generatedUserId
      } as RegisterResponse];
    }),
    catchError((error: any) => {
      console.error('❌ Erreur finale interceptée dans le flux de la méthode signup:', error.message || error);
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
          type: registrationData.type,
          myFollows: registrationData.follows,
          myFans: [],
          memberShip: registrationData.myPlan,
          myBlackList: [],
          username: await this.generateUniqueUsername(
            registrationData.first_name || 'user',
            registrationData.last_name || registrationData.id
          ),
          displayName: `${registrationData.first_name || ''} ${registrationData.last_name || ''}`.trim() || 'Utilisateur',
          avatar: 'default/avatar-default.png',
          coverImg: 'default/cover_image_default.png',
          level: 1,
          xpPercent: 500,
          confidence_level: 0,
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
            memberShip: {date:registrationData.myPlan.startDate, plan: registrationData.myPlan.name},
            bio: registrationData.bio || '',
            school:  { id: registrationData.school.id, name: registrationData.school.name, level: registrationData.school.level }
          }
        };
      }

 private async generateUniqueUsername(firstName: string, lastName: string): Promise<string> {
  const clean = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
  
  const f = clean(firstName);
  const l = clean(lastName);

  // 1. Stratégies de génération (ordre de préférence)
  const candidates = [
    `${f}${l.charAt(0)}`,       // jdoe
    `${f.charAt(0)}${l}`,       // jdoe
    `${f}.${l}`,                // john.doe
    `${f}${l}`,                 // johndoe
  ];

  // Essayer les combinaisons naturelles d'abord
  for (const candidate of candidates) {
    if (candidate.length >= 3 && !(await this.usernameExists(candidate))) {
      return candidate;
    }
  }

  // 2. Si tout est pris, on passe au mode "Modern Suffix"
  // On prend une base courte + un suffixe hexadécimal ou alphanumérique court
  let isUnique = false;
  let finalUsername = '';
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    const base = `${f}${l.charAt(0)}`.substring(0, 10);
    const suffix = Math.random().toString(36).substring(2, 5); // ex: '7ax'
    finalUsername = `${base}_${suffix}`;
    
    if (!(await this.usernameExists(finalUsername))) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) throw new Error('Generation failed');
  return finalUsername;
}

  // Vérifier si le nom d'utilisateur existe déjà
  private async usernameExists(username: string): Promise<boolean> {
    try {
      const profile = await firstValueFrom(this.profileService.getProfileByUsername(username));
      return profile !== null;
    } catch (error) {
      console.error('Erreur lors de la vérification du nom d\'utilisateur', error);
      return false; // En cas d'erreur, on considère que le nom est disponible
    }
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
                user_status: user.user_status,
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
    localStorage.setItem(this.TOKEN_STORAGE_KEY, loginResponse.access_token);
    localStorage.setItem(this.TOKEN_REFRESH_STORAGE_KEY, loginResponse.refresh_token);
    this.permanentFollows(authUser);
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


  /**
 * Vérifie et force l'abonnement permanent à l'école et/ou à l'administrateur
 * selon le statut de l'utilisateur (student ou university).
 */
private async permanentFollows(authUser: AuthUser): Promise<void> {

  try {
    // 1. Récupérer l'adminUID (via le flux Observable existant converti en Promesse)
    const adminUID = await firstValueFrom(this.getAdminUID());

    // 2. Récupérer le profil complet de l'utilisateur connecté pour inspecter 'myFollows'
    const userProfile = await firstValueFrom(this.profileService.getProfileById(authUser.id));
    if (!userProfile) return;

    const myFollows = Array.isArray(userProfile.myFollows) ? userProfile.myFollows : [];
    const promisesToExecute: Promise<any>[] = [];

    // Cas 1 : L'utilisateur est un étudiant (student)
    if (authUser.user_status === 'student') {
      const schoolId = userProfile.userInfo?.school?.id;
      
      // Vérification et abonnement à l'école déclarée
      if (schoolId && !myFollows.includes(schoolId)) {
        console.log(`[PermanentFollow] Inscription de l'étudiant à son école : ${schoolId}`);
        promisesToExecute.push(this.profileService.followProfile(authUser.id, schoolId));
      }

      // Vérification et abonnement à l'administrateur de la plateforme
      if (adminUID && !myFollows.includes(adminUID)) {
        console.log(`[PermanentFollow] Inscription de l'étudiant à l'admin : ${adminUID}`);
        promisesToExecute.push(this.profileService.followProfile(authUser.id, adminUID));
      }
    }

    // Cas 2 : L'utilisateur est une université / institution
    if (authUser.user_status === 'university') {
      // Vérification et abonnement à l'administrateur de la plateforme
      if (adminUID && !myFollows.includes(adminUID)) {
        console.log(`[PermanentFollow] Inscription de l'institution à l'admin : ${adminUID}`);
        promisesToExecute.push(this.profileService.followProfile(authUser.id, adminUID));
      }
    }

    // 3. Exécuter tous les abonnements requis en parallèle
    if (promisesToExecute.length > 0) {
      await Promise.all(promisesToExecute);
      console.log('✅ Tous les abonnements permanents obligatoires ont été vérifiés/appliqués.');
    }

  } catch (error) {
    console.error('❌ Erreur lors de l’exécution de permanentFollows:', error);
  }
}

  /* ======================
     PLATFORM DETECTION
     ====================== */

  private detectPlatform(): { type: string; info: any } {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isTablet = /ipad|android(?!.*mobile)/i.test(userAgent);
    const isIOS = /iphone|ipad|ipod/i.test(userAgent);
    const isAndroid = /android/i.test(userAgent);
    
    // Détection si c'est l'app mobile (Ionic/Capacitor)
    const isApp = this.isCapacitorApp();
    
    let platformType: string;
    let deviceInfo: any = {
      userAgent: navigator.userAgent,
      isMobile: isMobile,
      isTablet: isTablet,
      isIOS: isIOS,
      isAndroid: isAndroid
    };
    
    if (isApp && isMobile) {
      platformType = 'mobile_app';
      deviceInfo.appVersion = this.getAppVersion();
    } else if (isMobile) {
      platformType = 'mobile_web';
      deviceInfo.browser = this.getBrowserInfo();
    } else {
      platformType = 'desktop';
      deviceInfo.browser = this.getBrowserInfo();
    }
    
    return {
      type: platformType,
      info: deviceInfo
    };
  }

  private isCapacitorApp(): boolean {
    // Vérifie si l'app tourne dans Capacitor/Ionic
    return !!(window as any).Capacitor || !!(window as any).cordova;
  }

  private getAppVersion(): string {
    try {
      return (window as any).Capacitor?.getPlatform() || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /* ======================
     PASSWORD RESET
     ====================== */

  reset(email: string): Observable<any> {
    // Validation de base
    if (!email) {
      return throwError(() => new Error('MISSING_EMAIL'));
    }

    // Validation de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return throwError(() => new Error('INVALID_EMAIL'));
    }

    // Détection de la plateforme
    const platform = this.detectPlatform();
    
    // Préparer les données pour le backend
    const payload = {
      email: email.toLowerCase().trim(),
      platform: platform.type,        // 'web', 'mobile_app', 'mobile_web', 'desktop'
      device_info: platform.info       // informations supplémentaires
    };

    // Utiliser la route de reset de mot de passe
    return this.api.post<any>('auth/reset', payload).pipe(
      map((response: any) => {
        // Retourner la réponse du backend
        return {
          success: true,
          message: response.message || 'Email de réinitialisation envoyé avec succès'
        };
      }),
      catchError((error: Error) => {
        console.error('Password reset error:', error.message);
        return throwError(() => error);
      })
    );
  }

  confirmReset(token: string, password: string): Observable<any> {
    // Validation de base
    if (!token) {
      return throwError(() => new Error('MISSING_TOKEN'));
    }

    if (!password) {
      return throwError(() => new Error('MISSING_PASSWORD'));
    }

    // Validation du mot de passe
    if (password.length < 8) {
      return throwError(() => new Error('PASSWORD_TOO_SHORT'));
    }

    // Préparer les données pour le backend
    const payload = {
      token: token.trim(),
      password: password
    };

    // Utiliser la route de confirmation de reset de mot de passe
    return this.api.post<any>('auth/reset/confirm', payload).pipe(
      map((response: any) => {
        // Vérifier si le backend a retourné un succès
        if (response.success === false) {
          throw new Error(response.message || 'Échec de la réinitialisation du mot de passe');
        }
        
        // Retourner la réponse du backend
        return {
          success: true,
          message: response.message || 'Mot de passe réinitialisé avec succès'
        };
      }),
      catchError((error: Error) => {
        console.error('Password reset confirmation error:', error.message);
        return throwError(() => error);
      })
    );
  }
   /* ======================
     VERIFICATION MAIL
     ====================== */
  resend(email:string): Observable<any>{
     if (!email) {
      return throwError(() => new Error('MISSING_EMAIL'));
    }

    // Validation de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return throwError(() => new Error('INVALID_EMAIL'));
    }
    const payload = {
      email: email.toLowerCase().trim()
    };
     return this.api.post<any>('auth/resend', payload).pipe(
      map((response: any) => {
        // Retourner la réponse du backend
        return {
          success: true,
          message: response.message || 'Email de réinitialisation envoyé avec succès'
        };
      }),
      catchError((error: Error) => {
        console.error('Password reset error:', error.message);
        return throwError(() => error);
      })
    );
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
        if (key.includes('cache') || key.includes('best')) {
          localStorage.removeItem(key);
        }
      });

      // 5. Nettoyer sessionStorage
      const sessionStorageKeys = Object.keys(sessionStorage);
      sessionStorageKeys.forEach(key => {
        if (key.includes('cache') || key.includes('best')) {
          sessionStorage.removeItem(key);
        }
      });
      
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

 /**
 * Récupère l'adminUID depuis les profiles admin avec cache local
 */
getAdminUID(): Observable<string> {
  // 1. Vérifier d'abord le cache local
  const cachedAdminUID = localStorage.getItem(this.ADMIN_UID_STORAGE_KEY);

  if (cachedAdminUID) {
    // Si c'était stocké proprement en string simple, on le renvoie directement
    return of(cachedAdminUID);
  }

  // 2. Sinon, appeler l'API (on type temporairement avec 'any' ou ton interface d'objet si tu l'as)
  return this.api.filter<any>('profiles', { filters: { type: 'admin' } }, { cache: false }).pipe(
    map(response => {
      // Vérifier si response.data existe et contient des objets profils
      if (response && response.data && Array.isArray(response.data) && response.data.length > 0) {
        const adminProfile = response.data[0];
        
        const adminUID = adminProfile.id;
        
        if (adminUID) {
          // Sauvegarder uniquement la string de l'ID dans le localStorage (pas besoin de JSON.stringify)
          localStorage.setItem(this.ADMIN_UID_STORAGE_KEY, adminUID);
          return adminUID;
        }
      }
      
      // Si aucun admin ou ID trouvé, retourner une chaîne vide
      return '';
    }),
    catchError(error => {
      console.error('❌ Erreur récupération adminUID:', error);
      // En cas d'erreur, retourner une chaîne vide dans le flux RxJS
      return of('');
    })
  );
}

  private loadUserFromStorage(): AuthUser | null {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  private async loadUserProfileFromBackend(): Promise<UserProfile | null> {

    const raw = await this.profileService.getProfileById(this.getCurrentUser()?.id || '').toPromise();
    if(raw){
      return raw;
    }
    return null;
  }


}
