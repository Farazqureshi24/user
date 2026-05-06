import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CreateUser, User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly usersSubject = new BehaviorSubject<readonly User[]>([]);
  readonly users$ = this.usersSubject.asObservable();

  getUsers(): Observable<readonly User[]> {
    return this.users$;
  }

  addUser(user: CreateUser): void {
    const nextUser: User = {
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      name: user.name.trim(),
      email: user.email.trim().toLowerCase(),
      role: user.role
    };

    this.usersSubject.next([nextUser, ...this.usersSubject.value]);
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
