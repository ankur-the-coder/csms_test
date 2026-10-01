import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Only intercept API requests
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  const router = inject(Router);
  const token = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;

  const authReq = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Don't intercept 401 on /login
      if (error.status === 401 && !req.url.includes('/login')) {
        if (typeof window !== 'undefined') {
          const reason = error.error?.code === 'SESSION_REVOKED'
            ? 'signed_in_elsewhere'
            : 'expired';

          sessionStorage.setItem('logout_reason', reason);
          localStorage.removeItem('session_token');
          localStorage.removeItem('isLoggedIn');
          localStorage.removeItem('password');
          router.navigate(['/login']);
        }
      }
      return throwError(() => error);
    })
  );
};
