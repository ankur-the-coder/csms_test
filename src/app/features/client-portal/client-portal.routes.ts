import { Routes } from '@angular/router';
import { clientPortalGuard } from '../../core/guards/client-portal.guard';
import { PortalDashboard } from '../../shared/components/portal-dashboard/portal-dashboard';
import { PortalMyPlan } from '../../shared/components/portal-my-plan/portal-my-plan';
import { PortalImplementation } from '../../shared/components/portal-implementation/portal-implementation';
import { PortalUsage } from '../../shared/components/portal-usage/portal-usage';
import { PortalAddons } from '../../shared/components/portal-addons/portal-addons';
import { PortalInvoices } from '../../shared/components/portal-invoices/portal-invoices';
import { PortalSupport } from '../../shared/components/portal-support/portal-support';
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
      { path: 'my-plan', component: PortalMyPlan },
      { path: 'implementation', component: PortalImplementation },
      { path: 'usage', component: PortalUsage },
      { path: 'addons', component: PortalAddons },
      { path: 'invoices', component: PortalInvoices },
      { path: 'support', component: PortalSupport },
      // Sidebar items marked "Soon" will be added here later.
    ],
  },
];