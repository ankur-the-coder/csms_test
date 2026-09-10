import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Sidebar, csNavItems, learningNavItems, NavItem } from './sidebar/sidebar';
import { Navbar } from './navbar/navbar';
import { GlobalCallPopupComponent } from '../shared/components/global-call-popup.component';

@Component({
  selector: 'app-layout',
  imports: [CommonModule, RouterOutlet, Sidebar, Navbar, GlobalCallPopupComponent],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout {
  private router = inject(Router);
  private static readonly ALL_NAV_ITEMS: NavItem[] = [...csNavItems, ...learningNavItems];

  activeNav = this.getActiveNavFromUrl(this.router.url);
  searchQuery = '';
  mobileMenuOpen = false;
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
    return /\/voice(\/(softphone)?)?(\?|$)/.test(url);
  }

  private getActiveNavFromUrl(url: string): string {
    if (!url) return '';
    const path = url.split('?')[0].split('#')[0];
    const match = Layout.ALL_NAV_ITEMS
      .filter(item => item.route && (path === item.route || path.startsWith(item.route + '/')))
      .sort((a, b) => b.route!.length - a.route!.length)[0];

    if (match) return match.id;
    if (path.startsWith('/trainings')) return 'training';

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