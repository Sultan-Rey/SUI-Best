import { EventEmitter, Injectable } from '@angular/core';
import { environment } from 'src/environments/environment.prod';
import {
  HttpClient, HttpEvent, HttpHeaders, HttpParams, HttpErrorResponse
} from '@angular/common/http';
import {
  Observable, of, throwError, timer, from, forkJoin
} from 'rxjs';
import { catchError, retry, switchMap, tap, map, mergeMap } from 'rxjs/operators';
import { CacheItem, DataCache } from 'src/services/Cache/data-cache';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface RequestOptions {
  headers?: HttpHeaders;
  params?: HttpParams;
  responseType?: 'json' | 'blob' | 'text';
  reportProgress?: boolean;
}



export interface ApiError {
  message: string;
  status: number;
  error: any;
  timestamp: number;
  retryable: boolean;
}

export interface FilterOptions {
  filters?: Record<string, any>;
  options?: {
    limit?: number;
    offset?: number;
    page?: number;
    per_page?: number;
    sort?: Record<string, 'asc' | 'desc'>;
    include_meta?: boolean;
  };
}

export interface FilterResult<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    page: number;
    per_page: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}



// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ApiJSON {

  protected readonly BASE_URL = environment.apiUrl;

  // EventEmitter pour les erreurs de connexion
  public connectionError = new EventEmitter<boolean>();

  // Cache en mémoire pour accès rapide + cache persistant pour l'offline
  private memoryCache = new Map<string, CacheItem>();
  private persistentCache!: DataCache;
  private readonly DEFAULT_TTL = 30 * 60 * 1000; 
  private readonly OFFLINE_TTL = 24 * 60 * 60 * 1000; // 24h en offline
  
  // TTL spécifiques par type de ressource
  private readonly RESOURCE_TTL = {
    profiles: 30 * 1000,        // 30 secondes pour les profils
    users: 30 * 1000,           // 30 secondes pour les utilisateurs
    contents: 5 * 60 * 1000,       // 5 minutes pour les publications
    comments: 2 * 60 * 1000,    // 2 minutes pour les commentaires
    challenges: 10 * 60 * 1000,  // 10 minutes pour les challenges
    media: 30 * 60 * 1000,      // 30 minutes pour les médias
    default: 30 * 60 * 1000     // 30 minutes par défaut
  };
  
  // État de la connexion
  private isOnline = navigator.onLine;

  constructor(private http: HttpClient) {
    // Initialiser le cache persistant
    this.persistentCache = new DataCache();
    
    // Surveiller l'état de la connexion
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.connectionError.emit(true);
      console.log('🌐 Connexion rétablie');
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.connectionError.emit(false);
      console.log('📴 Hors ligne - utilisation du cache');
    });
    
    // Nettoyage périodique du cache mémoire
    setInterval(() => this.cleanExpiredMemoryCache(), 60_000);
    
    // Charger le cache persistant en mémoire au démarrage
    this.loadPersistentCacheToMemory();
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  getToken(): string {
    return localStorage.getItem('access_token') ?? '';
  }

  protected getAuthHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${this.getToken()}`,
      'Content-Type': 'application/json'
    });
  }

  // ── Cache amélioré ─────────────────────────────────────────────────────────────────

  /**
   * Récupère du cache (mémoire d'abord, puis persistant)
   */
  private async getCachedAsync<T>(key: string): Promise<T | null> {
    // 1. Vérifier le cache mémoire (plus rapide)
    const memoryItem = this.memoryCache.get(key);
    if (memoryItem && Date.now() - memoryItem.timestamp < memoryItem.ttl) {
      return memoryItem.data as T;
    }
    
    // 2. Vérifier le cache persistant
    const persistentItem = await this.persistentCache.get(key);
    if (persistentItem) {
      // Remettre en cache mémoire pour accès rapide
      this.memoryCache.set(key, persistentItem);
      return persistentItem.data as T;
    }
    
    return null;
  }

  /**
   * Sauvegarde dans les deux caches
   */
  private async setCacheAsync<T>(key: string, data: T, url: string, params?: any, ttl = this.DEFAULT_TTL): Promise<void> {
    const cacheItem: CacheItem = { data, timestamp: Date.now(), ttl, url, params };
    
    // Cache mémoire
    this.memoryCache.set(key, cacheItem);
    
    // Cache persistant (pour offline)
    await this.persistentCache.set(key, data, ttl, url, params);
  }

  private buildCacheKey(resource: string, params?: any): string {
    return params ? `${resource}:${JSON.stringify(params)}` : resource;
  }

  /**
   * Détermine le TTL selon la ressource
   */
  private getTtlForResource(resource: string): number {
    // Extraire le nom de la ressource (ex: "profiles" de "profiles/123")
    const resourceName = resource.split('/')[0].toLowerCase();
    
    return this.RESOURCE_TTL[resourceName as keyof typeof this.RESOURCE_TTL] || this.RESOURCE_TTL.default;
  }

  private cleanExpiredMemoryCache(): void {
    const now = Date.now();
    for (const [key, item] of this.memoryCache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.memoryCache.delete(key);
      }
    }
  }

  private async loadPersistentCacheToMemory(): Promise<void> {
    const stats = await this.persistentCache.getStats();
    //console.log(`📦 Cache persistant chargé: ${stats.size} éléments`);
  }

  async clearCache(resource?: string): Promise<void> {
    if (resource) {
      // Supprime des deux caches
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(resource)) this.memoryCache.delete(key);
      }
      await this.persistentCache.clear(resource);
    } else {
      this.memoryCache.clear();
      await this.persistentCache.clear();
    }
  }

  async getCacheStats(): Promise<{ memory: number; persistent: { size: number; keys: string[] } }> {
    const persistentStats = await this.persistentCache.getStats();
    return {
      memory: this.memoryCache.size,
      persistent: persistentStats
    };
  }

  // ── Erreurs améliorées avec gestion offline ───────────────────────────────────────────────

  protected handleError(error: HttpErrorResponse, cacheKey?: string): Observable<never> {
    
    // Détecter les erreurs de connexion
    const isConnectionError = error.status === 0 || 
      error.message?.includes('ERR_CONNECTION_REFUSED') ||
      error.message?.includes('ERR_NETWORK') ||
      error.message?.includes('Failed to fetch') ||
      !navigator.onLine;
    
     
    if (isConnectionError) {
     this.connectionError.emit(false);
      this.isOnline = false;
      
      if (cacheKey) {
        console.warn('📴 Tentative de récupération depuis le cache');
      }
    }
    
    const apiError: ApiError = {
      message: error.error?.error ?? error.message ?? 'Erreur inconnue',
      status: error.status ?? 0,
      error: error.error,
      timestamp: Date.now(),
      retryable: [0, 500, 502, 503, 504].includes(error.status ?? 0)
    };
    return throwError(() => apiError);
  }

  // ── Retry ─────────────────────────────────────────────────────────────────

  protected retryWithBackoff<T>(maxRetries = 3, delayMs = 1000) {
    return (source: Observable<T>) => source.pipe(
      retry({
        count: maxRetries,
        delay: (_err, retryIndex) => timer(delayMs * Math.pow(2, retryIndex)),
        resetOnSuccess: true
      })
    );
  }

  // ── CRUD avec cache persistant (Twitter-like) ──────────────────────────────────────────────────

  /**
   * GET avec cache persistant - Fonctionne comme Twitter/TikTok
   * Les données restent disponibles même hors ligne
   */
  get<T>(
    resource: string,
    params?: Record<string, string | number | boolean>,
    options?: { cache?: boolean; ttl?: number; forceRefresh?: boolean }
  ): Observable<T> {
    const cacheKey = this.buildCacheKey(resource, params);
    const shouldCache = options?.cache !== false; // cache par défaut à true
    
    // Fonction pour récupérer depuis le cache (async mais on retourne un Observable)
    const getFromCache = async (): Promise<T | null> => {
      if (shouldCache) {
        return await this.getCachedAsync<T>(cacheKey);
      }
      return null;
    };
    
    // Si forceRefresh, on ignore le cache
    if (options?.forceRefresh !== true) {
      // Créer un Observable à partir du cache
      return new Observable<T>(subscriber => {
        getFromCache().then(cachedData => {
          if (cachedData) {
            console.log(`📦 Cache hit (${this.isOnline ? 'online' : 'offline'}): ${resource}`);
            subscriber.next(cachedData);
            
            // Si on est en ligne, on rafraîchit en arrière-plan (comme Twitter)
            if (this.isOnline && !options?.forceRefresh) {
              this.fetchAndUpdateCache<T>(resource, params, cacheKey, shouldCache, options?.ttl)
                .then(freshData => {
                  if (freshData) {
                    subscriber.next(freshData);
                  }
                  subscriber.complete();
                })
                .catch(() => subscriber.complete());
            } else {
              subscriber.complete();
            }
          } else {
            // Pas de cache, on fait la requête
            this.fetchAndUpdateCache<T>(resource, params, cacheKey, shouldCache, options?.ttl)
              .then(data => {
                subscriber.next(data);
                subscriber.complete();
              })
              .catch(err => {
                subscriber.error(err);
              });
          }
        }).catch(() => {
          // Erreur de cache, on fait la requête
          this.fetchAndUpdateCache<T>(resource, params, cacheKey, shouldCache, options?.ttl)
            .then(data => {
              subscriber.next(data);
              subscriber.complete();
            })
            .catch(err => {
              subscriber.error(err);
            });
        });
      });
    }
    
    // Force refresh - on ignore le cache
    return new Observable<T>(subscriber => {
      this.fetchAndUpdateCache<T>(resource, params, cacheKey, shouldCache, options?.ttl)
        .then(data => {
          subscriber.next(data);
          subscriber.complete();
        })
        .catch(err => {
          subscriber.error(err);
        });
    });
  }
  
  /**
   * Fait la requête et met à jour le cache
   */
  private async fetchAndUpdateCache<T>(
    resource: string,
    params: Record<string, string | number | boolean> | undefined,
    cacheKey: string,
    shouldCache: boolean,
    customTtl?: number
  ): Promise<T> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => httpParams = httpParams.set(k, String(v)));
    }
    
    const url = `${this.BASE_URL}/${resource}`;
    
    try {
      const data = await this.http.get<T>(url, {
        headers: this.getAuthHeaders(),
        params: httpParams
      }).pipe(
        this.retryWithBackoff(),
        catchError(err => throwError(() => this.handleError(err)))
      ).toPromise();
      
      // Mettre en cache si demandé
      if (shouldCache && data) {
        const resourceTtl = this.getTtlForResource(resource);
        const ttl = customTtl ?? (this.isOnline ? resourceTtl : this.OFFLINE_TTL);
        await this.setCacheAsync(cacheKey, data, url, params, ttl);
       // console.log(`💾 Cache mis à jour: ${resource}`);
      }
      
      return data as T;
    } catch (error) {
      // En dernier recours, essayer le cache même si on avait pas au début
      const cached = await this.getCachedAsync<T>(cacheKey);
      if (cached) {
        console.warn(`⚠️ Échec réseau, utilisation du cache expiré: ${resource}`);
        return cached;
      }
      throw error;
    }
  }

  /** GET /resource/:id - Version améliorée avec cache */
  getById<T>(resource: string, id: string | number, options?: { cache?: boolean; ttl?: number }): Observable<T> {
    return this.get<T>(`${resource}/${id}`, undefined, options);
  }

  /** POST /resource - Invalide le cache après création */
  post<T>(resource: string, payload: any): Observable<T> {
    return this.http.post<T>(`${this.BASE_URL}/${resource}`, payload, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(() => this.clearCache(resource)),
      this.retryWithBackoff(),
      catchError(err => this.handleError(err))
    );
  }

  /** Alias sémantique de post() pour la création */
  create<T>(resource: string, payload: Partial<T>): Observable<T> {
    return this.post<T>(resource, payload);
  }

  /** PUT /resource/:id - Invalide le cache */
  update<T>(resource: string, id: string | number, payload: Partial<T>): Observable<T> {
    return this.http.put<T>(`${this.BASE_URL}/${resource}/${id}`, payload, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(() => this.clearCache(resource)),
      this.retryWithBackoff(),
      catchError(err => this.handleError(err))
    );
  }

  /** PATCH /resource/:id - Invalide le cache */
  patch<T>(resource: string, id: string | number, payload: Partial<T>): Observable<T> {
    return this.http.patch<T>(`${this.BASE_URL}/${resource}/${id}`, payload, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(() => this.clearCache(resource)),
      this.retryWithBackoff(),
      catchError(err => this.handleError(err))
    );
  }

  /** Requête HTTP avec méthode et URL libre — pour les routes imbriquées */
  request<T>(method: string, path: string, payload?: any): Observable<T> {
    return this.http.request<T>(method, `${this.BASE_URL}/${path}`, {
      headers: this.getAuthHeaders(),
      body: payload
    }).pipe(
      this.retryWithBackoff(),
      catchError(err => this.handleError(err))
    );
  }

  /** DELETE /resource/:id - Invalide le cache */
  delete(resource: string, id: string | number): Observable<void> {
    return this.http.delete<void>(`${this.BASE_URL}/${resource}/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(() => this.clearCache(resource)),
      this.retryWithBackoff(),
      catchError(err => this.handleError(err))
    );
  }

  // ── Filter avec cache ────────────────────────────────────────────────────────────────

  /**
   * POST /resource/filter - Version avec cache persistant
   */
  filter<T>(
    resource: string,
    body: FilterOptions = {},
    options?: { cache?: boolean; ttl?: number }
  ): Observable<FilterResult<T>> {
    const cacheKey = this.buildCacheKey(`${resource}/filter`, body);
    const shouldCache = options?.cache !== false;
    
    if (shouldCache) {
      return new Observable<FilterResult<T>>(subscriber => {
        this.getCachedAsync<FilterResult<T>>(cacheKey).then(cachedData => {
          if (cachedData) {
            subscriber.next(cachedData);
            
            // Rafraîchissement en arrière-plan si online
            if (this.isOnline) {
              this.fetchFilterAndCache<T>(resource, body, cacheKey)
                .then(data => {
                  subscriber.next(data);
                  subscriber.complete();
                })
                .catch(() => subscriber.complete());
            } else {
              subscriber.complete();
            }
          } else {
            this.fetchFilterAndCache<T>(resource, body, cacheKey)
              .then(data => {
                subscriber.next(data);
                subscriber.complete();
              })
              .catch(err => subscriber.error(err));
          }
        });
      });
    }
    
    // Sans cache
    return this.executeFilter<T>(resource, body);
  }
  
  private async fetchFilterAndCache<T>(
    resource: string,
    body: FilterOptions,
    cacheKey: string
  ): Promise<FilterResult<T>> {
    const data = await this.executeFilter<T>(resource, body).toPromise();
    if (data) {
      const filterTtl = this.getTtlForResource(resource);
      await this.setCacheAsync(cacheKey, data, `${resource}/filter`, body, filterTtl);
    }
    return data as FilterResult<T>;
  }
  
  private executeFilter<T>(resource: string, body: FilterOptions): Observable<FilterResult<T>> {
    const payload = {
      filters: body.filters ?? {},
      options: { include_meta: true, ...body.options }
    };
    
    return this.http.post<FilterResult<T>>(
      `${this.BASE_URL}/${resource}/filter`,
      payload,
      { headers: this.getAuthHeaders() }
    ).pipe(
      this.retryWithBackoff(),
      catchError(err => this.handleError(err))
    );
  }

  // ── Fichiers (inchangés mais compatibles) ──────────────────────────────────────────────

  upload<T>(
    file: File,
    path?: string,
    metadata?: Record<string, string>
  ): Observable<HttpEvent<T>> {
    const formData = new FormData();
    formData.append('file', file);
    if (path) formData.append('path', path);
    if (metadata) {
      Object.entries(metadata).forEach(([k, v]) => formData.append(k, v));
    }

    return this.http.post<T>(
      `${this.BASE_URL}/upload`,
      formData,
      {
        headers: new HttpHeaders({ 'Authorization': `Bearer ${this.getToken()}` }),
        reportProgress: true,
        observe: 'events'
      }
    ).pipe(
      this.retryWithBackoff(2, 2000),
      catchError(err => this.handleError(err))
    );
  }

  /**
 * Envoie un morceau de fichier spécifique au serveur.
 */
uploadChunk<T>(
  chunk: Blob,
  chunkInfo: { index: number; total: number; uuid: string; filename: string },
  path: string = 'contents'
): Observable<HttpEvent<T>> {
  const formData = new FormData();
  formData.append('file', chunk, chunkInfo.filename);
  formData.append('chunkIndex', chunkInfo.index.toString());
  formData.append('totalChunks', chunkInfo.total.toString());
  formData.append('uuid', chunkInfo.uuid);
  formData.append('filename', chunkInfo.filename);
  formData.append('path', path);

  return this.http.post<T>(
    `${this.BASE_URL}/upload-chunk`, // Nouvelle route dédiée
    formData,
    {
      headers: new HttpHeaders({ 'Authorization': `Bearer ${this.getToken()}` }),
      reportProgress: true, // Toujours utile pour le micro-feedback
      observe: 'events'
    }
  ).pipe(
    this.retryWithBackoff(3, 1000), // Plus de retries pour les chunks
    catchError(err => this.handleError(err))
  );
}

  getFile(filePath: string): Observable<Blob> {
    const params = new HttpParams().set('path', filePath);
    return this.http.get(`${this.BASE_URL}/download`, {
      headers: this.getAuthHeaders(),
      params,
      responseType: 'blob'
    }).pipe(
      catchError(err => this.handleError(err))
    );
  }

  getStreamUrl(filePath: string): string {
    const token = encodeURIComponent(this.getToken());
    return `${this.BASE_URL}/download?path=${encodeURIComponent(filePath)}&token=${token}`;
  }

  deleteFile(filePath: string): Observable<{ message: string; path: string }> {
    return this.http.delete<{ message: string; path: string }>(
      `${this.BASE_URL}/deletefile`,
      {
        headers: this.getAuthHeaders(),
        body: { path: filePath }
      }
    ).pipe(
      catchError(err => this.handleError(err))
    );
  }
}