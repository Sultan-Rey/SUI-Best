// src/app/services/user.service.ts
import { Injectable } from '@angular/core';
import { map, Observable, of, switchMap } from 'rxjs';
import { ApiJSON } from '../API/api-json';
import { User } from '../../models/User';

@Injectable({
  providedIn: 'root',
})
export class UserService {

  private readonly resource = 'users';

  constructor(private api: ApiJSON) {} // ✅ Migration vers notre ApiJSON unifié

  /* =====================
     CREATE
     ===================== */

  createUser(user:User): Observable<User> {
    return this.api.create<User>(this.resource, user);
  }

  /* =====================
     READ
     ===================== */

  getUser(): Observable<User> {
    return this.api.get<User>(this.resource);
  }

  getUserById(id: string | number): Observable<User | null> {
    return this.api.getById<User | null>(this.resource, id as string);
  }

  getUserByEmail(email: string): Observable<User[]> {
  return this.api
    .filter<User>(this.resource,  { filters: {email: email}, options:{ limit:1} })
    .pipe(
      map(user => {
        if (!user) {
          throw new Error('USER_NOT_FOUND');
        }
        return user.data;
      })
    );
}

  /* =====================
     UPDATE
     ===================== */

  updateUser(
    id: string,
    data: Partial<Omit<User, 'id'>>
  ): Observable<User> {
    return this.api.update<User>(this.resource, id, data);
  }

  updateStatus(
    id: string,
    status: User['status']
  ): Observable<User> {
    return this.api.patch<User>(this.resource, id, { status });
  }

  updateRole(
    id: string,
    role: User['user_type']
  ): Observable<User> {
    return this.api.patch<User>(this.resource, id, {
      user_type: role,
    });
  }

  updatePasswordHash(
    id: string,
    passwordHash: string
  ): Observable<User> {
    return this.api.patch<User>(this.resource, id, {
      password_hash: passwordHash,
    });
  }

  /* =====================
     DELETE
     ===================== */

  deleteUser(id: string): Observable<void> {
    return this.api.delete(this.resource, id);
  }

  /* =====================
     PUSH TOKEN MANAGEMENT
     ===================== */

  updatePushToken(token: string, userId: string): Observable<any> {
    return this.api.patch(`${this.resource}/push-token`, userId, {
      pushToken: token,
      deviceId: this.getDeviceId(),
      platform: this.getPlatform()
    });
  }

  private getDeviceId(): string {
    // Générer ou récupérer un ID unique pour l'appareil
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = 'device_' + Math.random().toString(36).substr(2, 9) + Date.now();
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  }

  private getPlatform(): string {
    const userAgent = navigator.userAgent;
    if (/android/i.test(userAgent)) return 'android';
    if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
    if (/windows/i.test(userAgent)) return 'windows';
    if (/mac/i.test(userAgent)) return 'mac';
    return 'web';
  }

  


  
}
