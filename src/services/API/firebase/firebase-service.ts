import { inject, Injectable, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore, collection, addDoc, doc, deleteDoc, updateDoc,
  query, where, getDocs, getDoc, setDoc, limit, orderBy,
  startAfter, endBefore, Timestamp, QueryConstraint, Query,
  CollectionReference, QueryDocumentSnapshot, DocumentData,
  serverTimestamp, onSnapshot, getCountFromServer
} from '@angular/fire/firestore';
import { from, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Storage, ref, uploadString, getDownloadURL, deleteObject, uploadBytes } from '@angular/fire/storage';
import { FirebaseError } from '@angular/fire/app';

// ─────────────────────────────────────────────
//  Types internes du cache
// ─────────────────────────────────────────────
interface CacheEntry<T> {
  data: T[];
  ts: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: string;
}

// ─────────────────────────────────────────────
//  TTL par collection (en ms)
//  Ajuster selon la volatilité de chaque collection
// ─────────────────────────────────────────────
const COLLECTION_TTL: Record<string, number> = {
  profiles:   10 * 60 * 1000,  // 5 min  — profils changent rarement
  posts:   30 * 1000,       // 30 sec — contenu plus dynamique
  default: 60 * 1000,       // 1 min  — fallback pour toute autre collection
};

// Nombre max de documents retournés si aucun limit() explicite
const DEFAULT_LIMIT = 50;

@Injectable({
  providedIn: 'root',
})
export class FirebaseService {
  private firestore = inject(Firestore);
  private storage   = inject(Storage);
  private injector  = inject(Injector);

  // ─────────────────────────────────────────────
  //  CACHE
  // ─────────────────────────────────────────────
  private readonly MAX_CACHE_SIZE = 100;
  private cache = new Map<string, CacheEntry<any>>();
  private _hits   = 0;
  private _misses = 0;

  /** Durée de vie pour une collection donnée */
  private getTTL(resource: string): number {
    return COLLECTION_TTL[resource] ?? COLLECTION_TTL['default'];
  }

  /** Clé de cache unique pour une collection + ses filtres */
  private cacheKey(resource: string, filters?: Record<string, any>): string {
    return `${resource}::${JSON.stringify(filters ?? {})}`;
  }

  /** Lire le cache — retourne null si absent ou expiré */
  private getCache<T>(key: string, resource: string): T[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    const expired = Date.now() - entry.ts > this.getTTL(resource);
    if (expired) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T[];
  }

  /** Écrire dans le cache avec LRU */
  private setCache<T>(key: string, data: T[]): void {
    // Si le cache est plein, supprimer la première entrée (LRU simple)
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, { data, ts: Date.now() });
  }

  /**
   * Invalider toutes les entrées d'une collection.
   * À appeler après chaque create / update / delete.
   */
  invalidateCache(resource: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${resource}::`)) {
        this.cache.delete(key);
      }
    }
  }

  /** Stats de cache — utile en dev pour mesurer l'efficacité */
  getCacheStats(): CacheStats {
    const total = this._hits + this._misses;
    return {
      hits: this._hits,
      misses: this._misses,
      hitRate: total === 0 ? '0%' : `${((this._hits / total) * 100).toFixed(1)}%`,
    };
  }

  /** Vider tout le cache (ex: logout) */
  clearCache(): void {
    this.cache.clear();
    this._hits   = 0;
    this._misses = 0;
  }

  // ─────────────────────────────────────────────
  //  DIAGNOSTIC (Phase 1)
  //  Mettre enableDiagnostic = true en dev pour
  //  tracer chaque appel Firestore et son origine.
  //  Remettre à false avant de déployer en prod.
  // ─────────────────────────────────────────────
  private enableDiagnostic = true;

  private logRead(resource: string, source: 'CACHE' | 'FIRESTORE'): void {
    if (!this.enableDiagnostic) return;
    const style = source === 'CACHE'
      ? 'color: #1D9E75; font-weight: bold'
      : 'color: #E24B4A; font-weight: bold';
    console.warn(
      `%c[${source}] ${resource}`,
      style,
      new Error().stack?.split('\n').slice(2, 5).join('\n')
    );
  }

  // ─────────────────────────────────────────────
  //  CREATE
  // ─────────────────────────────────────────────
  create<T>(resource: string, payload: Partial<T>): Observable<T> {
    try {
      const colRef = collection(this.firestore, resource);
      const docPayload = {
        ...payload,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      };

      return from(
        runInInjectionContext(this.injector, () => addDoc(colRef, docPayload))
      ).pipe(
        map(docRef => ({ id: docRef.id, ...payload } as T)),
        tap(() => this.invalidateCache(resource)),   // ← invalider après write
        catchError(error => {
          console.error('💥 [FirebaseService/create]', resource, error);
          return throwError(() => error);
        })
      );
    } catch (error) {
      return throwError(() => error);
    }
  }

  // ─────────────────────────────────────────────
  //  READ — get()
  // ─────────────────────────────────────────────
  get<T>(
    resource: string,
    params?: Record<string, string | number | boolean>,
    maxResults: number = DEFAULT_LIMIT
  ): Observable<T[]> {
    const key = this.cacheKey(resource, params);
    const cached = this.getCache<T>(key, resource);

    if (cached) {
      this._hits++;
      this.logRead(resource, 'CACHE');
      return of(cached);
    }

    this._misses++;
    this.logRead(resource, 'FIRESTORE');

    const collectionRef = collection(this.firestore, resource);
    const constraints: QueryConstraint[] = [];

    if (params && Object.keys(params).length > 0) {
      Object.entries(params).forEach(([k, v]) => {
        constraints.push(where(k, '==', v));
      });
    }

    constraints.push(limit(maxResults)); // ← plafond de sécurité

    const q = query(collectionRef, ...constraints);

    return from(
      runInInjectionContext(this.injector, () => getDocs(q))
    ).pipe(
      map(snapshot =>
        snapshot.docs.map(d => ({ ...(d.data() as T), id: d.id }))
      ),
      tap(data => this.setCache(key, data)),
      catchError(error => {
        console.error('💥 [FirebaseService/get]', resource, error);
        return throwError(() => error);
      })
    );
  }

  getAll<T>(resource: string): Observable<T[]> {
    return this.get<T>(resource);
  }

  // ─────────────────────────────────────────────
  //  READ — filter()
  // ─────────────────────────────────────────────
  filter<T>(
    resource: string,
    filters?: Record<string, any>,
    maxResults: number = DEFAULT_LIMIT
  ): Observable<T[]> {
    if (!filters || Object.keys(filters).length === 0) {
      return this.get<T>(resource, undefined, maxResults);
    }

    const key = this.cacheKey(resource, filters);
    const cached = this.getCache<T>(key, resource);

    if (cached) {
      this._hits++;
      this.logRead(resource, 'CACHE');
      return of(cached);
    }

    this._misses++;
    this.logRead(resource, 'FIRESTORE');

    const colRef = collection(this.firestore, resource);
    const constraints: QueryConstraint[] = [];

    Object.entries(filters).forEach(([field, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.entries(value).forEach(([op, val]) => {
          switch (op) {
            case '==':             constraints.push(where(field, '==', val)); break;
            case '!=':             constraints.push(where(field, '!=', val)); break;
            case '>':              constraints.push(where(field, '>', val)); break;
            case '>=':             constraints.push(where(field, '>=', val)); break;
            case '<':              constraints.push(where(field, '<', val)); break;
            case '<=':             constraints.push(where(field, '<=', val)); break;
            case 'in':             constraints.push(where(field, 'in', val)); break;
            case 'array-contains': constraints.push(where(field, 'array-contains', val)); break;
          }
        });
      } else {
        constraints.push(where(field, '==', value));
      }
    });

    constraints.push(limit(maxResults)); // ← plafond de sécurité

    const q = query(colRef, ...constraints);

    return from(
      runInInjectionContext(this.injector, () => getDocs(q))
    ).pipe(
      map(snapshot =>
        snapshot.docs.map(d => ({ id: d.id, ...(d.data() as T) }))
      ),
      tap(data => this.setCache(key, data)),
      catchError(error => {
        console.error('💥 [FirebaseService/filter]', resource, error);
        return of([] as T[]);
      })
    );
  }

  // ─────────────────────────────────────────────
  //  READ — getById()
  // ─────────────────────────────────────────────
  getById<T>(resource: string, id: string): Observable<T | null> {
    // Cache doc individuel sous une clé dédiée
    const key = `${resource}::id::${id}`;
    const entry = this.cache.get(key);

    if (entry && Date.now() - entry.ts < this.getTTL(resource)) {
      this._hits++;
      this.logRead(resource, 'CACHE');
      return of(entry.data[0] as T);
    }

    this._misses++;
    this.logRead(resource, 'FIRESTORE');

    const docRef = doc(this.firestore, `${resource}/${id}`);

    return from(
      runInInjectionContext(this.injector, () => getDoc(docRef))
    ).pipe(
      map(snapshot => {
        if (!snapshot.exists()) return null;
        const data = { id: snapshot.id, ...snapshot.data() } as T;
        
        // Appliquer LRU si nécessaire pour getById aussi
        if (this.cache.size >= this.MAX_CACHE_SIZE) {
          const firstKey = this.cache.keys().next().value;
          if (firstKey) {
            this.cache.delete(firstKey);
          }
        }
        
        this.cache.set(key, { data: [data], ts: Date.now() });
        return data;
      }),
      catchError((error: FirebaseError) => {
        console.error('💥 [FirebaseService/getById]', resource, id, error);
        return of(null);
      })
    );
  }

  // ─────────────────────────────────────────────
  //  UPDATE — sans double lecture
  // ─────────────────────────────────────────────
  update<T>(resource: string, id: string, payload: Partial<T>): Observable<T> {
    const docRef = doc(this.firestore, `${resource}/${id}`);

    return from(
      runInInjectionContext(this.injector, () =>
        updateDoc(docRef, { ...payload, updated_at: Timestamp.now() })
      )
    ).pipe(
      map(() => {
        const updated = { id, ...payload } as T;

        // Mettre à jour l'entrée individuelle dans le cache
        const key = `${resource}::id::${id}`;
        const existing = this.cache.get(key);
        if (existing) {
          // Appliquer LRU si nécessaire
          if (this.cache.size >= this.MAX_CACHE_SIZE) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
              this.cache.delete(firstKey);
            }
          }
          this.cache.set(key, {
            data: [{ ...existing.data[0], ...payload, updated_at: Timestamp.now() }],
            ts: Date.now(),
          });
        }

        // Invalider les listes (elles contiennent peut-être ce doc)
        this.invalidateCache(resource);

        return updated;
      }),
      catchError(error => {
        console.error('💥 [FirebaseService/update]', resource, id, error);
        return throwError(() => error);
      })
    );
  }

  patch<T>(resource: string, id: string, payload: Partial<T>): Observable<T> {
    return this.update(resource, id, payload);
  }

  // ─────────────────────────────────────────────
  //  DELETE
  // ─────────────────────────────────────────────
  delete(resource: string, id: string): Observable<void> {
    const docRef = doc(this.firestore, `${resource}/${id}`);

    return from(
      runInInjectionContext(this.injector, () => deleteDoc(docRef))
    ).pipe(
      tap(() => {
        this.cache.delete(`${resource}::id::${id}`);
        this.invalidateCache(resource);
      }),
      catchError(error => {
        console.error('💥 [FirebaseService/delete]', resource, id, error);
        return throwError(() => error);
      })
    );
  }

  // ─────────────────────────────────────────────
  //  COUNT — sans charger les documents
  // ─────────────────────────────────────────────

  exists(resource: string, id: string): Observable<boolean> {
    return this.getById(resource, id).pipe(map(data => data !== null));
  }

  // ─────────────────────────────────────────────
  //  CONNECTION TEST
  // ─────────────────────────────────────────────
  testConnection(): Observable<boolean> {
    const testRef  = collection(this.firestore, 'plans');
    const testQuery = query(testRef, limit(1));

    return from(getDocs(testQuery)).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  // ─────────────────────────────────────────────
  //  UPLOAD
  // ─────────────────────────────────────────────
  private async compressImage(file: File): Promise<File> {
    return new Promise(resolve => {
      const canvas = document.createElement('canvas');
      const ctx    = canvas.getContext('2d');
      const img    = new Image();

      img.onload = () => {
        let { width, height } = img;
        const maxSize = 2000;
        if (width > maxSize || height > maxSize) {
          if (width > height) { height = (height * maxSize) / width; width = maxSize; }
          else                { width  = (width  * maxSize) / height; height = maxSize; }
        }
        canvas.width  = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          blob => resolve(blob ? new File([blob], file.name, { type: file.type, lastModified: Date.now() }) : file),
          file.type,
          0.85
        );
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  }

  private async compressFile(file: File): Promise<File> {
    if (file.type.startsWith('image/')) return this.compressImage(file);
    return file;
  }

  upload<T>(
    resource: string,
    file: File | string,
    fieldName: string = 'file',
    metadata?: any
  ): Observable<{ url: string; data: T }> {
    const uploadProcess = async () => {
      let processedFile: File | string = file;
      if (file instanceof File) {
        processedFile = await this.compressFile(file);
      }

      const fileName = typeof processedFile === 'string'
        ? `${Date.now()}_${fieldName}`
        : `${Date.now()}_${processedFile.name}`;

      const storageRef   = ref(this.storage, `${resource}/${fileName}`);
      const uploadPromise = typeof processedFile === 'string'
        ? uploadString(storageRef, processedFile, 'data_url', metadata)
        : uploadBytes(storageRef, processedFile);

      const snapshot = await uploadPromise;
      const url      = await getDownloadURL(snapshot.ref);
      return { url, data: { url, fileName } as unknown as T };
    };

    return from(
      runInInjectionContext(this.injector, () => uploadProcess())
    ).pipe(
      catchError(error => {
        console.error('💥 [FirebaseService/upload]', error);
        return throwError(() => error);
      })
    );
  }


  deleteFile(filePath: string): Observable<void> {
    const storageRef = ref(this.storage, filePath);
    return from(
      runInInjectionContext(this.injector, () => deleteObject(storageRef))
    ).pipe(
      catchError(error => throwError(() => error))
    );
  }

  // ─────────────────────────────────────────────
  //  PRÉSENCE EN LIGNE
  // ─────────────────────────────────────────────
  setUserOnline(userId: string): Observable<void> {
    return from(
      runInInjectionContext(this.injector, async () => {
        const userRef = doc(this.firestore, `online-users/${userId}`);
        await setDoc(userRef, { isOnline: true, lastSeen: serverTimestamp(), userId });
      })
    ).pipe(catchError(error => throwError(() => error)));
  }

  setUserOffline(userId: string): Observable<void> {
    return from(
      runInInjectionContext(this.injector, async () => {
        const userRef = doc(this.firestore, `online-users/${userId}`);
        await updateDoc(userRef, { isOnline: false, lastSeen: serverTimestamp() });
      })
    ).pipe(catchError(error => throwError(() => error)));
  }

  watchOnlineStatus(userId: string): Observable<{ isOnline: boolean; lastSeen: any }> {
    const userRef = doc(this.firestore, `online-users/${userId}`);
    return new Observable(subscriber => {
      const unsub = onSnapshot(
        userRef,
        snap => subscriber.next({
          isOnline: snap.exists() ? (snap.data()?.['isOnline'] ?? false) : false,
          lastSeen: snap.exists() ? (snap.data()?.['lastSeen'] ?? null) : null,
        }),
        err => subscriber.error(err)
      );
      return () => unsub();
    });
  }

  getOnlineStatus(userId: string): Observable<{ isOnline: boolean; lastSeen: any }> {
    return this.getById<{ isOnline: boolean; lastSeen: any }>('online-users', userId).pipe(
      map(data => ({ isOnline: data?.isOnline ?? false, lastSeen: data?.lastSeen ?? null })),
      catchError(() => of({ isOnline: false, lastSeen: null }))
    );
  }
}