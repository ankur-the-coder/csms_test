import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth-service';
import { PortalIcon } from '../../portal-icon';

export interface PortalNavItem {
  id: string;
  label: string;
  icon: string;
  route?: string;      // set only for pages that exist
}

export const PORTAL_NAV: PortalNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home', route: '/client-portal/dashboard' },
  // { id: 'plan', label: 'My Plan', icon: 'plan', route: '/client-portal/my-plan' },
  // { id: 'addons', label: 'Add-ons', icon: 'addons', route: '/client-portal/addons' },
  // { id: 'implementation', label: 'Implementation', icon: 'implementation', route: '/client-portal/implementation' },
  // { id: 'training', label: 'Training Center', icon: 'training' },
  // { id: 'support', label: 'Support', icon: 'support', route: '/client-portal/support' },
  // // { id: 'downloads', label: 'Downloads', icon: 'download' },
  // { id: 'invoices', label: 'Invoices & Payments', icon: 'invoice', route: '/client-portal/invoices' },
  // { id: 'usage', label: 'Usage Analytics', icon: 'analytics', route: '/client-portal/usage' },
  // { id: 'manager', label: 'Account Manager', icon: 'manager' },
  // { id: 'settings', label: 'Settings', icon: 'settings' },
];

@Component({
  selector: 'portal-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, PortalIcon],
  templateUrl: './portal-sidebar.html',
  styleUrl: './portal-sidebar.css',
})
export class PortalSidebar {
  private auth = inject(AuthService);
  private router = inject(Router);

  /** logged-in user (same source as the top bar) */
  userName = this.auth.getUserName();
  initial = (this.userName || 'U').trim().charAt(0).toUpperCase();

  @Input() open = false;                    // mobile drawer state
  @Input() orgName = '';
  @Input() set orgLogo(v: string | null | undefined) { this._logo = v || null; this.logoFailed = false; }
  get orgLogo(): string | null { return this._logo; }
  private _logo: string | null = null;
  logoFailed = false;
  /** Same logo as the login page, used when the customer has none (or it fails to load). */
  readonly fallbackLogo = 'assets/logo/ubi.svg';
  @Output() closed = new EventEmitter<void>();
  @Output() helpClicked = new EventEmitter<void>();

  nav = PORTAL_NAV;
  soonId: string | null = null;
  private soonTimer: any;

  /** Not-yet-built pages: give a small "coming soon" nudge instead of a dead click. */
  nudge(item: PortalNavItem) {
    this.soonId = item.id;
    clearTimeout(this.soonTimer);
    this.soonTimer = setTimeout(() => (this.soonId = null), 1600);
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
