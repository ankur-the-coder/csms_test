import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth-service';

/** Only logged-in CLIENTS may enter the portal. Agents go back to their own app. */
export const clientPortalGuard: CanActivateFn = () => {
  const router = inject(Router);
  const auth = inject(AuthService);
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;

  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
  if (!auth.isClient()) return router.createUrlTree(['/dashboard']);
  return true;
};