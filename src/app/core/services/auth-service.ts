import { storageCfg } from '../storage-prefix';
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
    const hasToken = !!window.localStorage.getItem(storageCfg.prefix + 'session_token');
    const wasLoggedIn = window.localStorage.getItem(storageCfg.prefix + 'isLoggedIn') === 'true';

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
    return this.isBrowser ? window.localStorage.getItem(storageCfg.prefix + 'session_token') : null;
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
          window.localStorage.setItem(storageCfg.prefix + 'userName', d.userName || '');
          if (d.empId) window.localStorage.setItem(storageCfg.prefix + 'empId', d.empId);
          if (d.designation) window.localStorage.setItem(storageCfg.prefix + 'designation', d.designation);
          window.localStorage.setItem(storageCfg.prefix + 'profileImage', d.profileImage || '');
          if (d.adminSts !== undefined) window.localStorage.setItem(storageCfg.prefix + 'adminSts', String(d.adminSts));
          // if (d.hrSts !== undefined) window.localStorage.setItem(storageCfg.prefix + 'hrSts', String(d.hrSts));
          if (d.orgId) window.localStorage.setItem(storageCfg.prefix + 'orgId', d.orgId);
          if (d.email) window.localStorage.setItem(storageCfg.prefix + 'email', d.email);
          if (d.phone) window.localStorage.setItem(storageCfg.prefix + 'phone', d.phone);
          if (d.usermasterEmpId) window.localStorage.setItem(storageCfg.prefix + 'usermasterEmpId', d.usermasterEmpId);
          if (d.userType) window.localStorage.setItem(storageCfg.prefix + 'userType', d.userType);
          window.localStorage.setItem(storageCfg.prefix + 'isLoggedIn', 'true');
          this.isLoggedIn.set(true);
          return true;
        }
        return false;
      }),
      catchError((err) => {
        // If backend explicitly rejected the session as dead/revoked, log out
        if (err?.status === 401 && (err?.error?.code === 'SESSION_REVOKED' || err?.error?.code === 'SESSION_EXPIRED')) {
          this.logout('expired');
          return of(false);
        }
        // For temporary network glitches, server restarts, or timeouts:
        // Do NOT destroy the user's session! Preserve local logged-in state.
        console.warn('[AuthService] /auth/me temporary issue, preserving local session:', err?.message || err);
        return of(this.isAuthenticated());
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
        error: () => { },
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

    window.localStorage.removeItem(storageCfg.prefix + 'session_token');
    window.localStorage.removeItem(storageCfg.prefix + 'userName');
    window.localStorage.removeItem(storageCfg.prefix + 'empId');
    window.localStorage.removeItem(storageCfg.prefix + 'designation');
    window.localStorage.removeItem(storageCfg.prefix + 'profileImage');
    window.localStorage.removeItem(storageCfg.prefix + 'isLoggedIn');
    window.localStorage.removeItem(storageCfg.prefix + 'password'); // never stored anymore
    window.localStorage.removeItem(storageCfg.prefix + 'email');
    window.localStorage.removeItem(storageCfg.prefix + 'phone');
    window.localStorage.removeItem(storageCfg.prefix + 'usermasterEmpId');
    window.localStorage.removeItem(storageCfg.prefix + 'userType');
    window.localStorage.removeItem(storageCfg.prefix + 'adminSts');
    // window.localStorage.removeItem(storageCfg.prefix + 'hrSts');
    window.localStorage.removeItem(storageCfg.prefix + 'orgId');
  }

  getUserName(): string {
    return this.isBrowser ? (window.localStorage.getItem(storageCfg.prefix + 'userName') ?? '') : '';
  }

  getEmpId(): string {
    return this.isBrowser ? (window.localStorage.getItem(storageCfg.prefix + 'empId') ?? '') : '';
  }

  getDesignation(): string {
    return this.isBrowser ? (window.localStorage.getItem(storageCfg.prefix + 'designation') ?? '') : '';
  }

  getProfileImage(): string {
    return this.isBrowser ? (window.localStorage.getItem(storageCfg.prefix + 'profileImage') ?? '') : '';
  }

  getOrgId(): string {
    return this.isBrowser ? (window.localStorage.getItem(storageCfg.prefix + 'orgId') ?? '') : '';
  }

  /** Sessions created before this field existed are treated as agents. */
  getUserType(): 'agent' | 'client' {
    return this.isBrowser && window.localStorage.getItem(storageCfg.prefix + 'userType') === 'client' ? 'client' : 'agent';
  }

  isClient(): boolean {
    return this.getUserType() === 'client';
  }

  adminSts(): string {
    return this.isBrowser ? (window.localStorage.getItem(storageCfg.prefix + 'adminSts') ?? '') : '';
  }
  // hrSts(): string {
  //   return this.isBrowser ? (window.localStorage.getItem(storageCfg.prefix + 'hrSts') ?? '') : '';
  // }

  email(): string {
    return this.isBrowser ? (window.localStorage.getItem(storageCfg.prefix + 'email') ?? '') : '';
  }

  phone(): string {
    return this.isBrowser ? (window.localStorage.getItem(storageCfg.prefix + 'phone') ?? '') : '';
  }
  usermasterEmpId(): string {
    return this.isBrowser ? (window.localStorage.getItem(storageCfg.prefix + 'usermasterEmpId') ?? '') : '';
  }

  private persistSession(data: Data): void {
    if (!this.isBrowser) {
      return;
    }

    if (data.token) {
      window.localStorage.setItem(storageCfg.prefix + 'session_token', data.token);
    }
    window.localStorage.setItem(storageCfg.prefix + 'userName', data.userName || '');
    if (data.empId) window.localStorage.setItem(storageCfg.prefix + 'empId', data.empId);
    if (data.designation) window.localStorage.setItem(storageCfg.prefix + 'designation', data.designation);
    window.localStorage.setItem(storageCfg.prefix + 'profileImage', data.profileImage || '');
    if (data.adminSts !== undefined) window.localStorage.setItem(storageCfg.prefix + 'adminSts', data.adminSts.toString());
    // if (data.hrSts !== undefined) window.localStorage.setItem(storageCfg.prefix + 'hrSts', data.hrSts.toString());
    if (data.orgId) window.localStorage.setItem(storageCfg.prefix + 'orgId', data.orgId);
    if (data.email) window.localStorage.setItem(storageCfg.prefix + 'email', data.email);
    if (data.phone) window.localStorage.setItem(storageCfg.prefix + 'phone', data.phone);
    if (data.usermasterEmpId) window.localStorage.setItem(storageCfg.prefix + 'usermasterEmpId', data.usermasterEmpId);
    window.localStorage.setItem(storageCfg.prefix + 'userType', data.userType === 'client' ? 'client' : 'agent');
    window.localStorage.setItem(storageCfg.prefix + 'isLoggedIn', 'true');
    // Ensure legacy password is purged
    window.localStorage.removeItem(storageCfg.prefix + 'password');
    this.isLoggedIn.set(true);
  }
}