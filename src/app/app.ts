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

  onNavChange(navId: string) {
    this.activeNav = navId;
  }

  onSearchChange(query: string) {
    this.searchQuery = query;
  }
}
