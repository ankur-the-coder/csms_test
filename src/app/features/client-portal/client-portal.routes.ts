import { Routes } from '@angular/router';
import { clientPortalGuard } from '../../core/guards/client-portal.guard';
import { PortalDashboard } from '../../shared/components/portal-dashboard/portal-dashboard';
import { PortalShell } from '../../shared/components/portal-shell/portal-shell';

/**
 * Client-side portal. Mounted at /client-portal (see app.routes.ts).
 * Add future pages (my-plan, add-ons, support ...) as extra children.
 */
export const CLIENT_PORTAL_ROUTES: Routes = [
  {
    path: '',
    component: PortalShell,
    canActivate: [clientPortalGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: PortalDashboard },
      // Sidebar items marked "Soon" will be added here later.
    ],
  },
];
