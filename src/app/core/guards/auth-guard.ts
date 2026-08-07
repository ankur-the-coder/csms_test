import { inject } from '@angular/core';
import {type CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth-service';

export const authGuard: CanActivateFn = (route, state) => {


  const router = inject(Router);

  const authService = inject(AuthService);
  if (authService.isLoggedIn()) {
    return true;
  }

  return router.createUrlTree(['/login']);

};

export const checkGuard: CanActivateFn = (route, state) => {


  const router = inject(Router);

  const authService = inject(AuthService);
  if (authService.isLoggedIn()) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};
