// src/app/services/PROFILE_SERVICE/profile.service.ts
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ApiJSON} from '../API/LOCAL/api-json';
import { UserProfile } from '../../models/User';
import { UserService } from '../USER_SERVICE/user-service';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private resource = 'profiles';

  constructor(private api: ApiJSON, private userService: UserService) {}

  /* =====================
     CREATE
     ===================== */
  createProfile(profile: Omit<UserProfile, 'id'>): Observable<UserProfile> {
    return this.api.create<UserProfile>(this.resource, profile);
  }

  /* =====================
     READ
     ===================== */
  getProfiles(): Observable<UserProfile[]> {
    return this.api.getAll<UserProfile>(this.resource);
  }

  getProfileById(id: string): Observable<UserProfile> {
    return this.api.getById<UserProfile>(this.resource, id);
  }

  // Dans profile.service.ts
getProfileByUserId(userId: string, currentUserId?: string): Observable<UserProfile> {
  return this.api.getAll<UserProfile>(this.resource, { userId }).pipe(
    switchMap(profiles => {
      if (!profiles || profiles.length === 0) {
        throw new Error('Profile not found');
      }
      
      const profile = profiles[0];
      
      // Si on a un currentUserId, on vérifie si cet utilisateur suit déjà le profil
      if (currentUserId) {
        return this.userService.isFollowing(currentUserId, userId).pipe(
          map(isFollowing => {
            return {
              ...profile,
              isFollowing
            };
          })
        );
      }
      
      return of(profile);
    })
  );
}

  /* =====================
     UPDATE
     ===================== */
  updateProfile(id: string, updates: Partial<UserProfile>): Observable<UserProfile> {
    return this.api.update<UserProfile>(this.resource, id, updates);
  }

  /* =====================
     DELETE
     ===================== */
  deleteProfile(id: string): Observable<void> {
    return this.api.delete(this.resource, id);
  }
}