import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { HttpClient, HttpEvent, HttpHeaders, HttpParams } from '@angular/common/http';
import { catchError, Observable, of, tap } from 'rxjs';


@Injectable({
  providedIn: 'root',
})
export class ApiJSON {

  private readonly BASE_URL = environment.apiUrl;
  private readonly AUTH_TOKEN = environment.authToken;

  constructor(private http: HttpClient) {}

  /**
   * Crée un HttpHeaders avec Authorization
   */
  private getAuthHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${this.AUTH_TOKEN}`,
      'Content-Type': 'application/json'
    });
  }

  /* ========= CREATE ========= */
  create<T>(resource: string, payload: Partial<T>): Observable<T> {
    return this.http.post<T>(
      `${this.BASE_URL}/${resource}`,
      payload,
      { headers: this.getAuthHeaders() }
    );
  }

  /* ========= READ ========= */
  /**
   * Effectue une requête GET simple avec typage fort
   * @param resource Endpoint de la ressource (sans le baseUrl)
   * @param params Paramètres de requête optionnels
   * @returns Observable du type spécifié
   */
  get<T>(
    resource: string,
    params?: Record<string, string | number | boolean>
  ): Observable<T> {
    // Convertir les paramètres en HttpParams
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        httpParams = httpParams.set(key, String(value));
      });
    }

    // Options de la requête
    const options = {
      headers: this.getAuthHeaders(),
      params: httpParams,
      responseType: 'json' as const
    };

    return this.http.get<T>(`${this.BASE_URL}/${resource}`, options);
  }

  /**
   * Récupère une liste d'éléments
   * @deprecated Utiliser la méthode get<T[]>() à la place pour plus de flexibilité
   */
  getAll<T>(
    resource: string,
    params?: Record<string, string | number | boolean>
  ): Observable<T[]> {

    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        httpParams = httpParams.set(key, String(value));
      });
    }

    return this.http.get<T[]>(
      `${this.BASE_URL}/${resource}`,
      { headers: this.getAuthHeaders(), params: httpParams }
    );
  }

 /**
 * Filtre les éléments d'une collection selon les critères fournis
 * Utilise la route /filter du backend avec support des opérateurs avancés
 * 
 * @param resource Nom de la collection
 * @param filters Critères de filtrage
 * @param usePost Si true, utilise POST au lieu de GET
 * @returns Observable avec les résultats filtrés
 */
filter<T>(
  resource: string,
  filters?: Record<string, any>,
  usePost: boolean = false
): Observable<T[]> {
  
  console.log('🔍 FILTER CALL - Resource:', resource);
  console.log('Filters:', filters);
  console.log('usePost:', usePost);
  
  if (!filters || Object.keys(filters).length === 0) {
    return this.getAll(resource);
  }

  // IMPORTANT: Créer une nouvelle instance de HttpHeaders à chaque requête
  const headers = new HttpHeaders({
    'Authorization': `Bearer ${this.AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  });

  if (usePost) {
    // POST avec body JSON - exactement comme curl
    return this.http.post<T[]>(
      `${this.BASE_URL}/${resource}/filter`,
      filters,  // Angular convertira automatiquement en JSON
      { 
        headers: headers,
        // Ne pas définir 'responseType' pour laisser Angular détecter
      }
    ).pipe(
      tap(result => console.log('✅ Filter success:', result)),
      catchError(error => {
        console.error('❌ Filter error:', error);
        if (error.status === 401) {
          console.error('Problème d\'authentification - Vérifie le token');
        }
        return of([]);
      })
    );
  } else {
    // Version GET - à utiliser seulement pour des filtres simples
    let httpParams = new HttpParams();
    
    const buildParams = (obj: any, prefix: string = '') => {
      Object.entries(obj).forEach(([key, value]) => {
        const paramKey = prefix ? `${prefix}.${key}` : key;
        
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          buildParams(value, paramKey);
        } else if (Array.isArray(value) && value.length === 2) {
          const [operator, operatorValue] = value;
          httpParams = httpParams.set(`${paramKey}[${operator}]`, String(operatorValue));
        } else {
          httpParams = httpParams.set(paramKey, String(value));
        }
      });
    };
    
    buildParams(filters);
    
    return this.http.get<T[]>(
      `${this.BASE_URL}/${resource}/filter`,
      { headers: headers, params: httpParams }
    );
  }
}

  getById<T>(resource: string, id: number | string): Observable<T> {
    return this.http.get<T>(
      `${this.BASE_URL}/${resource}/${id}`,
      { headers: this.getAuthHeaders() }
    );
  }

  /* ========= UPDATE ========= */
  update<T>(
    resource: string,
    id: number | string,
    payload: Partial<T>
  ): Observable<T> {
    return this.http.put<T>(
      `${this.BASE_URL}/${resource}/${id}`,
      payload,
      { headers: this.getAuthHeaders() }
    );
  }

  patch<T>(
    resource: string,
    id: number | string,
    payload: Partial<T>
  ): Observable<T> {
    return this.http.patch<T>(
      `${this.BASE_URL}/${resource}/${id}`,
      payload,
      { headers: this.getAuthHeaders() }
    );
  }

  /* ========= DELETE ========= */
  delete(resource: string, id: number | string): Observable<void> {
    return this.http.delete<void>(
      `${this.BASE_URL}/${resource}/${id}`,
      { headers: this.getAuthHeaders() }
    );
  }

  /* ========= UPLOAD ========= */
  upload<T>(
  resource: string, 
  file: File, 
  fieldName: string = 'file',
  reportProgress = false
): Observable<T | HttpEvent<T>> {
  const formData = new FormData();
  formData.append(fieldName, file);

  return this.http.post<T>(
    `${this.BASE_URL}/${resource}`,
    formData,
    { 
      headers: { 'Authorization': `Bearer ${this.AUTH_TOKEN}` },
      reportProgress: true,
      observe: reportProgress ? 'events' : 'body'
    } as any
  );
}

// Dans api-json.ts
/**
 * Récupère un fichier depuis le serveur
 * @param filePath Chemin relatif du fichier
 * @returns Observable avec les données du fichier sous forme de Blob
 */
getFile(filePath: string): Observable<Blob> {
  const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
  const url = `${this.BASE_URL}/${cleanPath}`;
  
  return this.http.get(url, {
    responseType: 'blob',
    headers: this.getAuthHeaders(),
    withCredentials: true // Important pour les requêtes avec authentification
  }).pipe(
    catchError(error => {
      console.error('Erreur lors de la récupération du fichier:', error);
      // Retourne un blob vide en cas d'erreur
      return of(new Blob());
    })
  );
}

}
