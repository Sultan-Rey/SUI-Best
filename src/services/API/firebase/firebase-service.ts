import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, collectionData, doc, deleteDoc, updateDoc, query, where, getDocs, getDoc, setDoc, limit, orderBy, startAfter, endBefore, Timestamp, QueryConstraint, Query, CollectionReference } from '@angular/fire/firestore';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Storage, ref, uploadString, getDownloadURL, deleteObject, uploadBytes } from '@angular/fire/storage';

@Injectable({
  providedIn: 'root',
})
export class FirebaseService {

  constructor(
    private firestore: Firestore,
    private storage: Storage
  ) {}

  
  /* ========= CREATE ========= */
  create<T>(resource: string, payload: Partial<T>): Observable<T> {
    return new Observable<T>(observer => {
      const colRef = collection(this.firestore, resource);
      addDoc(colRef, {
        ...payload,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now()
      })
        .then(docRef => {
          // Récupérer le document créé avec son ID
          getDoc(docRef).then(docSnapshot => {
            const data = { id: docSnapshot.id, ...docSnapshot.data() } as T;
            observer.next(data);
            observer.complete();
          });
        })
        .catch(error => {
          console.error('Create error:', error);
          observer.error(error);
        });
    }).pipe(
      catchError(error => {
        console.error('Error creating document:', error);
        return throwError(() => error);
      })
    );
  }

  /* ========= READ ========= */
  get<T>(
    resource: string,
    params?: {
      limit?: number;
      orderByField?: string;
      orderByDirection?: 'asc' | 'desc';
      startAfter?: any;
      endBefore?: any;
    }
  ): Observable<T[]> {
    const colRef = collection(this.firestore, resource);
    
    // Construire la requête avec tous les paramètres
    const queryConstraints: QueryConstraint[] = [];
    
    if (params?.orderByField) {
      queryConstraints.push(orderBy(params.orderByField, params.orderByDirection || 'asc'));
    }
    
    if (params?.limit) {
      queryConstraints.push(limit(params.limit));
    }
    
    if (params?.startAfter) {
      queryConstraints.push(startAfter(params.startAfter));
    }
    
    if (params?.endBefore) {
      queryConstraints.push(endBefore(params.endBefore));
    }

    const q = query(colRef, ...queryConstraints);

    return collectionData(q, { idField: 'id' }).pipe(
      map(data => data as T[]),
      catchError(error => {
        console.error('Error getting collection:', error);
        return of([] as T[]);
      })
    );
  }

  /**
   * Récupère une liste d'éléments
   */
  getAll<T>(resource: string): Observable<T[]> {
    return this.get<T>(resource);
  }

  /**
   * Filtre les éléments d'une collection selon les critères fournis
   * @param resource Nom de la collection
   * @param filters Critères de filtrage
   * @returns Observable avec les résultats filtrés
   */
  filter<T>(
    resource: string,
    filters?: Record<string, any>
  ): Observable<T[]> {
    console.log('🔍 FILTER CALL - Resource:', resource);
    console.log('Filters:', filters);
    
    if (!filters || Object.keys(filters).length === 0) {
      return this.getAll(resource);
    }

    // Construire la requête avec les filtres
    const queryConstraints: QueryConstraint[] = [];
    const colRef = collection(this.firestore, resource);
    
    Object.entries(filters).forEach(([field, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Support pour les opérateurs avancés
        Object.entries(value).forEach(([operator, operatorValue]) => {
          switch (operator) {
            case '==':
              queryConstraints.push(where(field, '==', operatorValue));
              break;
            case '!=':
              queryConstraints.push(where(field, '!=', operatorValue));
              break;
            case '>':
              queryConstraints.push(where(field, '>', operatorValue));
              break;
            case '>=':
              queryConstraints.push(where(field, '>=', operatorValue));
              break;
            case '<':
              queryConstraints.push(where(field, '<', operatorValue));
              break;
            case '<=':
              queryConstraints.push(where(field, '<=', operatorValue));
              break;
            case 'in':
              queryConstraints.push(where(field, 'in', operatorValue));
              break;
            case 'array-contains':
              queryConstraints.push(where(field, 'array-contains', operatorValue));
              break;
          }
        });
      } else {
        // Filtre simple par égalité
        queryConstraints.push(where(field, '==', value));
      }
    });

    const q = query(colRef, ...queryConstraints);

    return collectionData(q, { idField: 'id' }).pipe(
      map(data => {
        console.log('✅ Filter success:', data);
        return data as T[];
      }),
      catchError(error => {
        console.error('❌ Filter error:', error);
        return of([] as T[]);
      })
    );
  }

  getById<T>(resource: string, id: string): Observable<T | null> {
    const docRef = doc(this.firestore, `${resource}/${id}`);
    
    return new Observable<T | null>(observer => {
      getDoc(docRef)
        .then(docSnapshot => {
          if (docSnapshot.exists()) {
            const data = { id: docSnapshot.id, ...docSnapshot.data() } as T;
            observer.next(data);
          } else {
            observer.next(null);
          }
          observer.complete();
        })
        .catch(error => {
          console.error('Error getting document:', error);
          observer.error(error);
        });
    }).pipe(
      catchError(error => {
        console.error('Error getting document by ID:', error);
        return of(null);
      })
    );
  }

  /* ========= UPDATE ========= */
  update<T>(
    resource: string,
    id: string,
    payload: Partial<T>
  ): Observable<T> {
    return new Observable<T>(observer => {
      const docRef = doc(this.firestore, `${resource}/${id}`);
      updateDoc(docRef, {
        ...payload,
        updated_at: Timestamp.now()
      })
        .then(async () => {
          // Récupérer le document mis à jour
          const updatedDoc = await getDoc(docRef);
          const data = { id: updatedDoc.id, ...updatedDoc.data() } as T;
          observer.next(data);
          observer.complete();
        })
        .catch(error => {
          console.error('Update error:', error);
          observer.error(error);
        });
    }).pipe(
      catchError(error => {
        console.error('Error updating document:', error);
        return throwError(() => error);
      })
    );
  }

  patch<T>(
    resource: string,
    id: string,
    payload: Partial<T>
  ): Observable<T> {
    return this.update(resource, id, payload);
  }

  /* ========= DELETE ========= */
  delete(resource: string, id: string): Observable<void> {
    return new Observable<void>(observer => {
      const docRef = doc(this.firestore, `${resource}/${id}`);
      deleteDoc(docRef)
        .then(() => {
          observer.next();
          observer.complete();
        })
        .catch(error => {
          console.error('Delete error:', error);
          observer.error(error);
        });
    }).pipe(
      catchError(error => {
        console.error('Error deleting document:', error);
        return throwError(() => error);
      })
    );
  }

  /* ========= UPLOAD ========= */
  upload<T>(
    resource: string, 
    file: File | string, 
    fieldName: string = 'file',
    metadata?: any
  ): Observable<{ url: string; data: T }> {
    return new Observable<{ url: string; data: T }>(observer => {
      const fileName = typeof file === 'string' 
        ? `${Date.now()}_${fieldName}`
        : `${Date.now()}_${file.name}`;
      
      const storageRef = ref(this.storage, `${resource}/${fileName}`);
      
      const uploadPromise = typeof file === 'string'
        ? uploadString(storageRef, file, 'data_url', metadata)
        : uploadBytes(storageRef, file, metadata);
      
      uploadPromise
        .then(async (snapshot) => {
          const url = await getDownloadURL(snapshot.ref);
          
          // Créer un document dans Firestore pour enregistrer l'upload
          const uploadData = {
            url,
            fileName,
            size: typeof file === 'string' ? file.length : file.size,
            type: typeof file === 'string' ? 'data_url' : file.type,
            fieldName,
            ...metadata
          };
          
          this.create(resource, uploadData as any).subscribe({
            next: (data: any) => {
              observer.next({ url, data });
              observer.complete();
            },
            error: (error) => {
              observer.error(error);
            }
          });
        })
        .catch(error => {
          console.error('Upload error:', error);
          observer.error(error);
        });
    }).pipe(
      catchError(error => {
        console.error('Error uploading file:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Récupère un fichier depuis Firebase Storage
   * @param filePath Chemin du fichier dans Storage
   * @returns Observable avec l'URL de téléchargement
   */
  getFile(filePath: string): Observable<string> {
    const storageRef = ref(this.storage, filePath);
    
    return new Observable<string>(observer => {
      getDownloadURL(storageRef)
        .then(url => {
          observer.next(url);
          observer.complete();
        })
        .catch(error => {
          console.error('Erreur lors de la récupération du fichier:', error);
          observer.error(error);
        });
    }).pipe(
      catchError(error => {
        console.error('Error getting file:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Supprime un fichier de Firebase Storage
   * @param filePath Chemin du fichier dans Storage
   * @returns Observable
   */
  deleteFile(filePath: string): Observable<void> {
    const storageRef = ref(this.storage, filePath);
    
    return new Observable<void>(observer => {
      deleteObject(storageRef)
        .then(() => {
          observer.next();
          observer.complete();
        })
        .catch(error => {
          console.error('Erreur lors de la suppression du fichier:', error);
          observer.error(error);
        });
    }).pipe(
      catchError(error => {
        console.error('Error deleting file:', error);
        return throwError(() => error);
      })
    );
  }

  /* ========= UTILITIES ========= */

  /**
   * Compte le nombre de documents dans une collection
   */
  count(resource: string, filters?: Record<string, any>): Observable<number> {
    return this.filter(resource, filters).pipe(
      map(data => data.length)
    );
  }

  /**
   * Vérifie si un document existe
   */
  exists(resource: string, id: string): Observable<boolean> {
    return this.getById(resource, id).pipe(
      map(data => data !== null)
    );
  }
}
