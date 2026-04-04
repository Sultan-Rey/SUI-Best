import { Injectable } from '@angular/core';
import { ApiJSON } from '../API/api-json';
import { firstValueFrom } from 'rxjs';
 
// ─── Config ───────────────────────────────────────────────────────────────────
 
const DB_NAME    = 'best_media_cache';
const DB_VERSION = 1;
const STORE_NAME = 'blobs';
 
// Seuil max du cache en octets (défaut 300 MB)
const DEFAULT_MAX_BYTES = 300 * 1024 * 1024;
 
// Taille max d'un fichier individuel mis en cache (défaut 50 MB)
// Les fichiers plus lourds sont streamés sans mise en cache
const DEFAULT_MAX_FILE_BYTES = 50 * 1024 * 1024;
 
// ─── Interfaces ───────────────────────────────────────────────────────────────
 
export interface CacheEntry {
  path: string;          // clé — chemin relatif du fichier
  blob: Blob;
  size: number;          // en octets
  lastAccessed: number;  // timestamp ms — utilisé pour LRU
  createdAt: number;
}
 
export interface CacheConfig {
  maxBytes?: number;       // limite totale du cache
  maxFileBytes?: number;   // limite par fichier individuel
}
 
export interface CacheStats {
  count: number;
  totalBytes: number;
  maxBytes: number;
  maxFileBytes: number;
  usagePercent: number;
}

@Injectable({
  providedIn: 'root',
})
export class MediaCacheService {
 
  private db: IDBDatabase | null = null;
  private dbReady: Promise<void>;
 
  // ObjectURLs actifs en mémoire — évite de recréer un URL pour un blob déjà chargé
  private objectUrls = new Map<string, string>();
 
  private maxBytes     = DEFAULT_MAX_BYTES;
  private maxFileBytes = DEFAULT_MAX_FILE_BYTES;
  
  // TTL pour synchronisation avec DataCache (24 heures)
  private readonly MEDIA_TTL = 24 * 60 * 60 * 1000;
 
  constructor(private api: ApiJSON) {
    this.dbReady = this.openDB();
  }
 
  /**
   * Configure les seuils du cache.
   * À appeler dans AppComponent si les valeurs par défaut ne conviennent pas.
   */
  configure(config: CacheConfig): void {
    if (config.maxBytes)     this.maxBytes     = config.maxBytes;
    if (config.maxFileBytes) this.maxFileBytes = config.maxFileBytes;
  }
 
  // ── API publique ──────────────────────────────────────────────────────────
 
  /**
   * Retourne un ObjectURL (blob://) pour le fichier.
   * Stratégie :
   *   1. ObjectURL déjà en mémoire  → retourné immédiatement
   *   2. Blob en IndexedDB          → ObjectURL créé depuis le blob stocké
   *   3. Aucun cache                → stream depuis /download, stockage si sous le seuil
   */
  async resolve(filePath: string): Promise<string> {
    if (!filePath) return '';
    await this.dbReady;
 
    // 1 — ObjectURL déjà en mémoire
    if (this.objectUrls.has(filePath)) {
      this.touchEntry(filePath); // fire-and-forget
      return this.objectUrls.get(filePath)!;
    }
 
    // 2 — Blob en IndexedDB
    const cached = await this.getEntry(filePath);
    if (cached) {
      const url = URL.createObjectURL(cached.blob);
      this.objectUrls.set(filePath, url);
      this.touchEntry(filePath); // fire-and-forget
      return url;
    }
 
    // 3 — Stream depuis le backend
    return this.fetchAndCache(filePath);
  }
 
  /**
   * Supprime un fichier du cache (utile après suppression côté serveur)
   */
  async evict(filePath: string): Promise<void> {
    await this.dbReady;
    this.revokeObjectUrl(filePath);
    await this.deleteEntry(filePath);
  }
 
  /**
   * Vide intégralement le cache
   */
  async clearAll(): Promise<void> {
    await this.dbReady;
    for (const path of this.objectUrls.keys()) this.revokeObjectUrl(path);
    await this.clearStore();
  }
 
  /**
   * Statistiques du cache
   */
  async getStats(): Promise<CacheStats> {
    await this.dbReady;
    const entries    = await this.getAllEntries();
    const now = Date.now();
    
    // Filtrer les entrées valides (non expirées)
    const validEntries = entries.filter(entry => 
      (now - entry.createdAt) <= this.MEDIA_TTL
    );
    
    const totalBytes = validEntries.reduce((sum, e) => sum + e.size, 0);
    return {
      count:        validEntries.length,
      totalBytes,
      maxBytes:     this.maxBytes,
      maxFileBytes: this.maxFileBytes,
      usagePercent: Math.round((totalBytes / this.maxBytes) * 100),
    };
  }
 
  // ── Fetch + cache ─────────────────────────────────────────────────────────
 
  private async fetchAndCache(filePath: string): Promise<string> {
    const blob = await firstValueFrom(this.api.getFile(filePath));
 
    const url = URL.createObjectURL(blob);
    this.objectUrls.set(filePath, url);
 
    // Fichier trop lourd → ObjectURL session uniquement, pas de stockage IndexedDB
    if (blob.size > this.maxFileBytes) {
      return url;
    }
 
    // Faire de la place si nécessaire (LRU eviction)
    await this.ensureCapacity(blob.size);
 
    await this.putEntry({
      path:         filePath,
      blob,
      size:         blob.size,
      lastAccessed: Date.now(),
      createdAt:    Date.now(),
    });
 
    return url;
  }
 
  // ── LRU eviction ─────────────────────────────────────────────────────────
 
  /**
   * Expulse les entrées les moins récemment utilisées
   * jusqu'à libérer suffisamment d'espace pour neededBytes
   * Stratégie hybride : TTL d'abord, puis LRU pour l'espace
   */
  private async ensureCapacity(neededBytes: number): Promise<void> {
    const entries = await this.getAllEntries();
    const now = Date.now();
    
    // 1. Étape TTL : Supprimer d'abord les fichiers expirés (>24h)
    const validEntries = entries.filter(entry => 
      (now - entry.createdAt) <= this.MEDIA_TTL
    );
    
    // 2. Étape LRU : Gérer l'espace avec les fichiers valides uniquement
    let totalBytes = validEntries.reduce((sum, e) => sum + e.size, 0);
    
    if (totalBytes + neededBytes <= this.maxBytes) return;
    
    // LRU sur les fichiers valides uniquement
    validEntries.sort((a, b) => a.lastAccessed - b.lastAccessed);
    
    for (const entry of validEntries) {
      if (totalBytes + neededBytes <= this.maxBytes) break;
      await this.deleteEntry(entry.path);
      this.revokeObjectUrl(entry.path);
      totalBytes -= entry.size;
    }
  }
 
  // ── IndexedDB ─────────────────────────────────────────────────────────────
 
  private openDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
 
      req.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'path' });
        }
      };
 
      req.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
 
      req.onerror = () => reject(req.error);
    });
  }
 
  private getEntry(path: string): Promise<CacheEntry | null> {
    return new Promise((resolve, reject) => {
      const tx  = this.db!.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(path);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = () => reject(req.error);
    });
  }
 
  private putEntry(entry: CacheEntry): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx  = this.db!.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(entry);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }
 
  private deleteEntry(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx  = this.db!.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).delete(path);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }
 
  private getAllEntries(): Promise<CacheEntry[]> {
    return new Promise((resolve, reject) => {
      const tx  = this.db!.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror   = () => reject(req.error);
    });
  }
 
  private clearStore(): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx  = this.db!.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).clear();
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }
 
  private async touchEntry(path: string): Promise<void> {
    const entry = await this.getEntry(path);
    if (entry) {
      entry.lastAccessed = Date.now();
      await this.putEntry(entry);
    }
  }
 
  // ── ObjectURL ─────────────────────────────────────────────────────────────
 
  private revokeObjectUrl(path: string): void {
    const url = this.objectUrls.get(path);
    if (url) {
      URL.revokeObjectURL(url);
      this.objectUrls.delete(path);
    }
  }
}
 
