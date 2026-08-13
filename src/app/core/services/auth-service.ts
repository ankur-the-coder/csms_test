import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Data, LoginResponse } from '../models/login.model';
import { Utils } from '../../shared/utils/utils';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly baseUrl = environment.apiUrl;
  readonly isLoggedIn = signal<boolean>(this.readStoredLogin());

  constructor(private http: HttpClient) {}

  private get isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  private readStoredLogin(): boolean {
    if (!this.isBrowser) {
      return false;
    }
    return window.localStorage.getItem('isLoggedIn') === 'true';
  }

  isAuthenticated(): boolean {
    if (this.isBrowser) {
      const stored = window.localStorage.getItem('isLoggedIn') === 'true';
      if (stored !== this.isLoggedIn()) {
        this.isLoggedIn.set(stored);
      }
      return stored;
    }
    return this.isLoggedIn();
  }

  login(userName: string, password: string): Observable<LoginResponse> {
    const payload = new FormData();
    payload.append('userName', Utils.encode5t(userName));
    payload.append('password', Utils.encode5t(password));

    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, payload).pipe(
      tap((res) => {
        if (res?.status === true && this.isBrowser && res.data) {
          this.persistSession(res.data);
        }
      }),
    );
  }

  logout(): void {
    if (!this.isBrowser) {
      return;
    }

    localStorage.removeItem('userName');
    localStorage.removeItem('empId');
    localStorage.removeItem('designation');
    localStorage.removeItem('isLoggedIn');
    this.isLoggedIn.set(false);
  }

  getUserName(): string {
    return this.isBrowser ? (localStorage.getItem('userName') ?? '') : '';
  }

  getEmpId(): string {
    return this.isBrowser ? (localStorage.getItem('empId') ?? '') : '';
  }

  getDesignation(): string {
    return this.isBrowser ? (localStorage.getItem('designation') ?? '') : '';
  }

  private persistSession(data: Data): void {
    if (!this.isBrowser) {
      return;
    }

    localStorage.setItem('userName', Utils.decode5t(data.userName));
    localStorage.setItem('empId', Utils.decode5t(data.empId));
    localStorage.setItem('designation', data.designation);
    localStorage.setItem('isLoggedIn', 'true');
    this.isLoggedIn.set(true);
  }
}
