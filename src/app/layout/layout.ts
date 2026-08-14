import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Sidebar } from './sidebar/sidebar';
import { Navbar } from './navbar/navbar';
import { GlobalCallPopupComponent } from '../shared/components/pop-up/global-call-popup.component';



@Component({
  selector: 'app-layout',
  imports: [CommonModule, RouterOutlet, Sidebar, Navbar, GlobalCallPopupComponent],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout {
  private router = inject(Router);

  // Derived synchronously from the current URL so the FIRST value passed
  // down to <app-sidebar> is already correct (avoids NG0100 — previously
  // Sidebar computed this itself in ngOnInit and emitted it back up to
  // Layout within the same change-detection pass, mutating a value that had
  // already been checked). Later updates come from genuinely async
  // NavigationEnd events, which is safe.
  activeNav = this.getActiveNavFromUrl(this.router.url);
  searchQuery = '';

  mobileMenuOpen = false;

  // The softphone page (features/voice/pages/softphone) already renders its
  // own full-size call/dialer UI inline, so the global floating popup would
  // just be a redundant/duplicate card stacked on top of it. Hide it only
  // there; every other route still gets the global popup as normal.
  isSoftphonePage = this.getIsSoftphonePageFromUrl(this.router.url);

  constructor() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: any) => {
      const url = e.urlAfterRedirects || e.url;
      this.activeNav = this.getActiveNavFromUrl(url);
      this.isSoftphonePage = this.getIsSoftphonePageFromUrl(url);
    });
  }

  private getIsSoftphonePageFromUrl(url: string): boolean {
    if (!url) return false;
    // Matches /voice, /voice/, and /voice/softphone (the default child
    // route '' redirects to 'softphone', so bare '/voice' also counts).
    return /\/voice(\/(softphone)?)?(\?|$)/.test(url);
  }

  private getActiveNavFromUrl(url: string): string {
    if (!url) return '';
    if (url.includes('implementation')) return 'implementation';
    if (url.includes('onboarding')) return 'onboarding';
    if (url.includes('dashboard')) return 'dashboard';
    if (url.includes('client')) return 'clients';
    if (url.includes('training')) return 'training';
    if (url.includes('meetings')) return 'meetings';
    if (url.includes('health')) return 'health';
    if (url.includes('support')) return 'support';
    if (url.includes('settings')) return 'settings';
    if (url.includes('my-learning')) return 'my-learning';
    if (url.includes('courses')) return 'courses';
 if (url.includes('voice')) return 'voice';
    return '';
  }

  onNavChange(navId: string) {
    this.activeNav = navId;
  }

  onSearchChange(query: string) {
    this.searchQuery = query;
  }

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu() {
    this.mobileMenuOpen = false;
  }
}
