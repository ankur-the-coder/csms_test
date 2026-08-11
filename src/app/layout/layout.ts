import { Component, inject } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Sidebar } from './sidebar/sidebar';
import { Navbar } from './navbar/navbar';



@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, Sidebar, Navbar],
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

  constructor() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: any) => {
      this.activeNav = this.getActiveNavFromUrl(e.urlAfterRedirects || e.url);
    });
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
