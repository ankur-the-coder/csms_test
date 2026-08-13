import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  OnInit,
  signal,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ClickOutsideDirective } from '../../shared/directives/click-outside.directive';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../core/services/auth-service';
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, ClickOutsideDirective],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  private router = inject(Router);

  @Input() searchQuery = '';
  @Output() searchChange = new EventEmitter<string>();
  @Output() menuToggle = new EventEmitter<void>();

  showNotifications = false;
  showProfileMenu = signal(false);
  isImplementationRoute = true;
  adminName = signal<string>('');
  designation = signal<string>('');

  private plateFormId = inject(PLATFORM_ID);

  constructor(private authService: AuthService) {}

  ngOnInit() {
    if (isPlatformBrowser(this.plateFormId)) {
      this.adminName.set(this.authService.getUserName());
      this.designation.set(this.authService.getDesignation());
    }

    this.checkRoute(this.router.url);
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.checkRoute(event.urlAfterRedirects || event.url);
      });
  }

  private checkRoute(url: string) {
    this.isImplementationRoute = url.includes('implementation');
  }
  logOut(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
