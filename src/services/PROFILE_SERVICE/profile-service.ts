// src/app/services/PROFILE_SERVICE/profile.service.ts
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ApiJSON} from '../API/LOCAL/api-json';
import { UserProfile } from '../../models/User';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private resource = 'profiles';

  constructor(private api: ApiJSON) {}

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

  /* ====================
     FOLLOW/UNFOLLOW
     ==================== */
     followProfile(userId: string, profileIdToFollow: string): Observable<UserProfile> {
    return this.api.getById<UserProfile>(this.resource, userId).pipe(
      switchMap(user => {
        const myFollows = Array.isArray(user.myFollows) ? user.myFollows : [];
        if (!myFollows.includes(profileIdToFollow)) {
          user.myFollows = [...user.myFollows, profileIdToFollow];
          return this.api.update<UserProfile>(this.resource, userId, user);
        }
        return of(user);
      })
    );
  }


   unfollowProfile(userId: string, profileIdToUnfollow: string): Observable<UserProfile> {
    return this.api.getById<UserProfile>(this.resource, userId).pipe(
      switchMap(user => {
         const myFollows = Array.isArray(user.myFollows) ? user.myFollows : [];
        user.myFollows = myFollows.filter(id => id !== profileIdToUnfollow);
        return this.api.update<UserProfile>(this.resource, userId, user);
      })
    );
  }

  isFollowing(userId: string, profileId: string): Observable<boolean> {
  return this.api.getById<UserProfile>(this.resource, userId).pipe(
    map(user => {
      // Assurez-vous que myFollows est un tableau
      const myFollows = Array.isArray(user.myFollows) ? user.myFollows : [];
      return myFollows.includes(profileId);
    })
  );
}

}