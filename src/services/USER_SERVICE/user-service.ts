// src/app/services/user.service.ts
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiJSON } from '../API/LOCAL/api-json';
import { User } from '../../models/User';

@Injectable({
  providedIn: 'root',
})
export class UserService {

  private readonly resource = 'users';

  constructor(private api: ApiJSON) {}

  /* =====================
     CREATE
     ===================== */

  createUser(user: Omit<User, 'id'>): Observable<User> {
    return this.api.create<User>(this.resource, user);
  }

  /* =====================
     READ
     ===================== */

  getUsers(): Observable<User[]> {
    return this.api.getAll<User>(this.resource);
  }

  getUserById(id: number): Observable<User> {
    return this.api.getById<User>(this.resource, id);
  }

  getUserByEmail(email: string): Observable<User> {
  return this.api
    .getAll<User>(this.resource, { email })
    .pipe(
      map(users => {
        if (!users.length) {
          throw new Error('USER_NOT_FOUND');
        }
        return users[0];
      })
    );
}

  /* =====================
     UPDATE
     ===================== */

  updateUser(
    id: number,
    data: Partial<Omit<User, 'id'>>
  ): Observable<User> {
    return this.api.update<User>(this.resource, id, data);
  }

  updateStatus(
    id: number,
    status: User['status']
  ): Observable<User> {
    return this.api.patch<User>(this.resource, id, { status });
  }

  updateRole(
    id: number,
    role: User['user_type']
  ): Observable<User> {
    return this.api.patch<User>(this.resource, id, {
      user_type: role,
    });
  }

  /* =====================
     DELETE
     ===================== */

  deleteUser(id: number): Observable<void> {
    return this.api.delete(this.resource, id);
  }
}
