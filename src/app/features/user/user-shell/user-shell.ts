import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

const LG_BREAKPOINT = 1024;

@Component({
  selector: 'app-user-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-shell.html',
  host: {
    '(window:resize)': 'onResize()',
  },
})
export class UserShell implements OnInit {
  private sanitizer = inject(DomSanitizer);
  private router    = inject(Router);
  private route     = inject(ActivatedRoute);

  /** true = large screen → persistent sidebar shown */
  isLargeScreen = signal(false);

  /** on mobile: is the drawer open? */
  drawerOpen = signal(false);

  /** Preserve user_id / org_id query params */
  queryParams = computed(() => {
    const snap = this.route.snapshot.queryParams;
    const params: Record<string, string> = {};
    if (snap['user_id']) params['user_id'] = snap['user_id'];
    if (snap['org_id'])  params['org_id']  = snap['org_id'];
    return params;
  });

  navItems = [
    { id: 'courses',     label: 'Course Catalog', icon: 'course-catalog', route: '/user/courses' },
    { id: 'my-learning', label: 'My Learning',    icon: 'my-learning',    route: '/user/courses/my-learning' },
  ];

  ngOnInit(): void {
    this.isLargeScreen.set(window.innerWidth >= LG_BREAKPOINT);
  }

  onResize(): void {
    this.isLargeScreen.set(window.innerWidth >= LG_BREAKPOINT);
    // auto-close drawer when resizing to large
    if (window.innerWidth >= LG_BREAKPOINT) {
      this.drawerOpen.set(false);
    }
  }

  openDrawer():  void { this.drawerOpen.set(true);  }
  closeDrawer(): void { this.drawerOpen.set(false); }

  navigateHome(): void {
    this.closeDrawer();
    this.router.navigate(['/user/courses'], { queryParams: this.queryParams() });
  }

  getSvgIcon(type: string): SafeHtml {
    const icons: Record<string, string> = {
      'course-catalog': `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>`,
      'my-learning':    `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>`,
    };
    return this.sanitizer.bypassSecurityTrustHtml(icons[type] || '');
  }
}
