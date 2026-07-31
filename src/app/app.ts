import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { NavbarComponent } from './shared/components/navbar/navbar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, NavbarComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  activeNav = 'implementation';
  searchQuery = '';

  // Mobile/tablet sidebar drawer state — desktop (lg+) ignores this and always
  // shows the sidebar inline; on smaller screens it toggles an overlay drawer.
  mobileMenuOpen = false;

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
