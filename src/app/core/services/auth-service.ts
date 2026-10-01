import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, of, catchError, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Data, LoginResponse } from '../models/login.model';
import { Utils } from '../../shared/utils/utils';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly baseUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly isLoggedIn = signal<boolean>(this.readStoredLogin());

  private get isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  private readStoredLogin(): boolean {
    if (!this.isBrowser) {
      return false;
    }
    const hasToken = !!window.localStorage.getItem('session_token');
    const wasLoggedIn = window.localStorage.getItem('isLoggedIn') === 'true';

    // Wipe legacy session without secure session_token
    if (wasLoggedIn && !hasToken) {
      this.clearStorage();
      return false;
    }

    return wasLoggedIn && hasToken;
  }

  isAuthenticated(): boolean {
    if (this.isBrowser) {
      const stored = this.readStoredLogin();
      if (stored !== this.isLoggedIn()) {
        this.isLoggedIn.set(stored);
      }
      return stored;
    }
    return this.isLoggedIn();
  }

  getToken(): string | null {
    return this.isBrowser ? window.localStorage.getItem('session_token') : null;
  }

  login(userName: string, password: string, logoutOthers: boolean = false): Observable<LoginResponse> {
    const payload = new FormData();
    payload.append('userName', Utils.encode5t(userName));
    payload.append('password', Utils.encode5t(password));
    if (logoutOthers) {
      payload.append('logoutOthers', 'true');
    }

    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, payload).pipe(
      tap((res) => {
        if (res?.status === true && this.isBrowser && res.data) {
          this.persistSession(res.data);
        }
      }),
    );
  }

  autoLogin(): Observable<boolean> {
    if (!this.isBrowser) {
      return of(false);
    }

    const token = this.getToken();
    if (!token) {
      this.clearStorage();
      return of(false);
    }

    return this.http.get<{ status: boolean; data: any }>(`${this.baseUrl}/auth/me`).pipe(
      map((res) => {
        if (res?.status && res?.data) {
          const d = res.data;
          window.localStorage.setItem('userName', d.userName || '');
          if (d.empId) window.localStorage.setItem('empId', d.empId);
          if (d.designation) window.localStorage.setItem('designation', d.designation);
          if (d.adminSts !== undefined) window.localStorage.setItem('adminSts', String(d.adminSts));
          if (d.orgId) window.localStorage.setItem('orgId', d.orgId);
          if (d.email) window.localStorage.setItem('email', d.email);
          if (d.phone) window.localStorage.setItem('phone', d.phone);
          if (d.userType) window.localStorage.setItem('userType', d.userType);
          window.localStorage.setItem('isLoggedIn', 'true');
          this.isLoggedIn.set(true);
          return true;
        }
        this.logout('expired');
        return false;
      }),
      catchError(() => {
        this.logout('expired');
        return of(false);
      })
    );
  }

  logout(reason?: string): void {
    if (!this.isBrowser) {
      return;
    }

    const token = this.getToken();
    if (token) {
      // Notify backend to revoke session
      this.http.post(`${this.baseUrl}/auth/logout`, {}).subscribe({
        error: () => {},
      });
    }

    this.clearStorage();
    this.isLoggedIn.set(false);

    if (reason) {
      sessionStorage.setItem('logout_reason', reason);
    }

    this.router.navigate(['/login']);
  }

  private clearStorage(): void {
    if (!this.isBrowser) return;

    window.localStorage.removeItem('session_token');
    window.localStorage.removeItem('userName');
    window.localStorage.removeItem('empId');
    window.localStorage.removeItem('designation');
    window.localStorage.removeItem('isLoggedIn');
    window.localStorage.removeItem('password'); // never stored anymore
    window.localStorage.removeItem('email');
    window.localStorage.removeItem('phone');
    window.localStorage.removeItem('userType');
    window.localStorage.removeItem('adminSts');
    window.localStorage.removeItem('orgId');
  }

  getUserName(): string {
    return this.isBrowser ? (window.localStorage.getItem('userName') ?? '') : '';
  }

  getEmpId(): string {
    return this.isBrowser ? (window.localStorage.getItem('empId') ?? '') : '';
  }

  getDesignation(): string {
    return this.isBrowser ? (window.localStorage.getItem('designation') ?? '') : '';
  }

  getOrgId(): string {
    return this.isBrowser ? (window.localStorage.getItem('orgId') ?? '') : '';
  }

  /** Sessions created before this field existed are treated as agents. */
  getUserType(): 'agent' | 'client' {
    return this.isBrowser && window.localStorage.getItem('userType') === 'client' ? 'client' : 'agent';
  }

  isClient(): boolean {
    return this.getUserType() === 'client';
  }

  adminSts(): string {
    return this.isBrowser ? (window.localStorage.getItem('adminSts') ?? '') : '';
  }

  email(): string {
    return this.isBrowser ? (window.localStorage.getItem('email') ?? '') : '';
  }

  phone(): string {
    return this.isBrowser ? (window.localStorage.getItem('phone') ?? '') : '';
  }

  private persistSession(data: Data): void {
    if (!this.isBrowser) {
      return;
    }

    if (data.token) {
      window.localStorage.setItem('session_token', data.token);
    }
    window.localStorage.setItem('userName', data.userName || '');
    if (data.empId) window.localStorage.setItem('empId', data.empId);
    if (data.designation) window.localStorage.setItem('designation', data.designation);
    if (data.adminSts !== undefined) window.localStorage.setItem('adminSts', data.adminSts.toString());
    if (data.orgId) window.localStorage.setItem('orgId', data.orgId);
    if (data.email) window.localStorage.setItem('email', data.email);
    if (data.phone) window.localStorage.setItem('phone', data.phone);
    window.localStorage.setItem('userType', data.userType === 'client' ? 'client' : 'agent');
    window.localStorage.setItem('isLoggedIn', 'true');
    // Ensure legacy password is purged
    window.localStorage.removeItem('password');
    this.isLoggedIn.set(true);
  }
}