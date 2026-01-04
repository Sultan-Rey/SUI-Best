import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ApiJSON {

  private readonly BASE_URL = 'http://localhost:3000';
  private readonly AUTH_TOKEN = 'demo-client-key-123'; // token utilisé par votre AuthMiddleware

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
  upload<T>(resource: string, file: File, fieldName: string = 'file'): Observable<T> {
    const formData = new FormData();
    formData.append(fieldName, file);

    return this.http.post<T>(
      `${this.BASE_URL}/${resource}`,
      formData,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.AUTH_TOKEN}` }) } // FormData ne doit pas avoir Content-Type
    );
  }
}
