import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap, switchMap } from 'rxjs/operators';
import { ApiJSON } from '../API/api-json';
import { Plan } from 'src/models/Plan';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private readonly resource = 'plans'; // Même ressource que dans votre API

  constructor(private api: ApiJSON) {} // ✅ Migration vers notre ApiJSON unifié

  // Récupérer tous les plans depuis l'API
  getAvailablePlans(): Observable<Plan[]> { 
    return this.api.get<Plan[]>(this.resource);
  }

  // Mettre à jour le plan de l'utilisateur
  updateUserPlan(userId: string, planId: string): Observable<any> {
    return this.api.update('users', userId, { 
      myPlan: planId,
      planUpdatedAt: new Date().toISOString()
    });
  }

  // Récupérer un plan spécifique
  getPlanById(planId: string): Observable<Plan | null> {
    return this.api.getById<Plan | null>(this.resource, planId);
  }
}