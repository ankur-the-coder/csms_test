import { Component, Input, Output, EventEmitter, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: `./navbar.component.html`
})
export class NavbarComponent implements OnInit {
  private router = inject(Router);

  @Input() searchQuery = '';
  @Output() searchChange = new EventEmitter<string>();

  showNotifications = false;
  isImplementationRoute = true;

  ngOnInit() {
    this.checkRoute(this.router.url);
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.checkRoute(event.urlAfterRedirects || event.url);
    });
  }

  private checkRoute(url: string) {
    this.isImplementationRoute = url.includes('implementation');
  }


}
