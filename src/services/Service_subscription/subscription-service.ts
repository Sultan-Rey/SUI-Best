import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap, switchMap } from 'rxjs/operators';
import { ApiJSON } from '../API/api-json';
import { Plan } from 'src/models/Plan';
import { School } from '../../models/User';
interface PublicCreatorAsset {
  avatar: string;
  fans: number;
}

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private readonly resource = 'plans'; // Même ressource que dans votre API
  private readonly resource_institutions = 'institutions';
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

  getSchoolByCode(code: string): Observable<School | undefined> { 
  // 2. On indique <School[]> car l'API renvoie la liste de toutes les écoles
  return this.api.get<School[]>(this.resource_institutions).pipe(
    map((schools: School[]) => {
      // 3. .find() trouve LA bonne école unique dans le tableau
      return schools.find(school => school.is_access_valid == true && school.access_code.toUpperCase() === code.toUpperCase());
    })
  );
}

getSchoolById(id: string): Observable<School | undefined> {
  
  return this.api.get<School[]>(this.resource_institutions).pipe(
    map((schools: School[]) => {
      // On cherche par ID ET on vérifie que l'accès est valide
      return schools.find(school => school.id === id && school.is_access_valid == false);
    })
  );
}

getPublicLandingAssets(): Observable<PublicCreatorAsset[]> {
  return this.api.get<{ success: boolean; data: PublicCreatorAsset[] }>('public/landing-assets').pipe(
    map(response => response.success ? response.data : []),
    catchError(() => of([]))
  );
}

}