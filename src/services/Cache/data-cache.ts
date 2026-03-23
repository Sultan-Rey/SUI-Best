import { Injectable } from '@angular/core';

export interface CacheItem {
  data: any;
  timestamp: number;
  ttl: number;
  url: string;
  params?: any;
}

@Injectable({
  providedIn: 'root',
})



// ─── Service de cache persistant (IndexedDB) ─────────────────────────────────

export class DataCache {
  
  private dbName = 'Best_data_Cache';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.init();
  }

  private init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('cache')) {
          const store = db.createObjectStore('cache', { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('expiry', 'expiry');
        }
      };
    });

    return this.initPromise;
  }

  async get(key: string): Promise<CacheItem | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve(null);
      
      const transaction = this.db.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.get(key);

      request.onsuccess = () => {
        const item = request.result;
        if (item && Date.now() < item.expiry) {
          resolve(item);
        } else if (item && Date.now() >= item.expiry) {
          // Cache expiré, le supprimer
          this.delete(key);
          resolve(null);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async set(key: string, data: any, ttl: number, url: string, params?: any): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve();
      
      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const item: CacheItem & { key: string; expiry: number } = {
        key,
        data,
        timestamp: Date.now(),
        ttl,
        expiry: Date.now() + ttl,
        url,
        params
      };
      
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(key: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve();
      
      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(resource?: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve();
      
      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      
      if (resource) {
        // Supprimer uniquement les clés qui commencent par le resource
        const request = store.openCursor();
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            if (cursor.value.key.startsWith(resource)) {
              cursor.delete();
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      } else {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }
    });
  }

  async getAllKeys(): Promise<string[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve([]);
      
      const transaction = this.db.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(request.error);
    });
  }

  async getStats(): Promise<{ size: number; keys: string[] }> {
    const keys = await this.getAllKeys();
    return { size: keys.length, keys };
  }
}