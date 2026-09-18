import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  category?: string;
  badge?: string;
  route?: string;
}


export const csNavItems: NavItem[] = [
  // { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
  // { id: 'clients', label: 'Clients', icon: 'clients', route: '/client' },
  // { id: 'onboarding', label: 'Onboarding', icon: 'onboarding', route: '/onboarding' },

  // { id: 'implementation', label: 'Implementation', icon: 'implementation', route: '/implementation' },
  // { id: 'training', label: 'Training', icon: 'training', route: '/training' },
  // { id: 'meetings', label: 'Meetings', icon: 'meetings', route: '/meetings' },
  // { id: 'connected', label: 'Connected', icon: 'connected', route: '/connected' },
  // { id: 'feedback', label: 'Feedback', icon: 'feedback', route: '/feedback' },
  // { id: 'usages', label: 'Usages', icon: 'usages', route: '/usages' },
  // { id: 'renewal', label: 'Renewed Clients', icon: 'renewal', route: '/renewal' },

  { id: 'voice', label: 'Voice Softphone', icon: 'voice', route: '/voice' },
  // { id: 'health', label: 'Health Score', icon: 'health', route: '/health' },
  // { id: 'support', label: 'Support Tickets', icon: 'support', route: '/support' },
  // { id: 'settings', label: 'Settings & Master', icon: 'settings', route: '/settings' }
];

export const learningNavItems: NavItem[] = [
  { id: 'courses', label: 'Course Catalog', icon: 'course-catalog', route: '/courses' },
  { id: 'my-learning', label: 'My Learning', icon: 'my-learning', route: '/my-learning' },
];

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  private sanitizer = inject(DomSanitizer);
  private router = inject(Router);

  @Input() activeNav = 'voice';
  @Input() mobileOpen = false;
  @Output() navChange = new EventEmitter<string>();
  @Output() closeMobile = new EventEmitter<void>();

  collapsed = false;
  trainingExpanded = true;
  csNavItems = csNavItems;
  learningNavItems = learningNavItems;

  toggleCollapse() {
    this.collapsed = !this.collapsed;
  }

  toggleTraining() {
    if (!this.collapsed) {
      this.trainingExpanded = !this.trainingExpanded;
    }
  }

  selectNav(id: string) {
    this.activeNav = id;
    this.navChange.emit(id);
    this.closeMobile.emit();

    const allItems = [...this.csNavItems, ...this.learningNavItems];
    const targetItem = allItems.find(item => item.id === id);
    if (targetItem?.route) {
      this.router.navigate([targetItem.route]);
    }
  }

  getSvgIcon(type: string): SafeHtml {
    const icons: Record<string, string> = {
      dashboard: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>`,
      clients: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>`,
      onboarding: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`,
      implementation: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>`,
      training: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 01-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/></svg>`,
      meetings: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`,
      voice: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>`,
      health: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`,
      support: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`,
      settings: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`,
      connected: `<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" image-rendering="optimizeQuality" fill-rule="evenodd" clip-rule="evenodd" viewBox="0 0 512 512"><circle fill="currentColor" transform="rotate(45 -181.019 437.02) scale(3.28877)" r="77.84"/><path fill="#fff" d="m162.27 317.75-30.92 30.65 39.62 39.61 31.29-31.03c69.87 57.6 131.69-3.38 177.78-49.48L357.55 285l49.47-49.45c8.33-8.33 8.33-21.98 0-30.32-8.34-8.34-21.99-8.33-30.32 0l-49.46 49.46-63.1-63.09 49.46-49.47c8.34-8.33 8.34-21.98 0-30.31-8.34-8.34-21.98-8.34-30.32 0l-49.46 49.46-21.69-21.7c-47.36 47.36-106.64 105.87-49.86 178.17z"/></svg>`,
      renewal: `<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" image-rendering="optimizeQuality" fill-rule="evenodd" clip-rule="evenodd" viewBox="0 0 512 512"><circle fill="currentColor" transform="rotate(45 -181.019 437.02) scale(3.28877)" r="77.84"/><path fill="#fff" d="m162.27 317.75-30.92 30.65 39.62 39.61 31.29-31.03c69.87 57.6 131.69-3.38 177.78-49.48L357.55 285l49.47-49.45c8.33-8.33 8.33-21.98 0-30.32-8.34-8.34-21.99-8.33-30.32 0l-49.46 49.46-63.1-63.09 49.46-49.47c8.34-8.33 8.34-21.98 0-30.31-8.34-8.34-21.98-8.34-30.32 0l-49.46 49.46-21.69-21.7c-47.36 47.36-106.64 105.87-49.86 178.17z"/></svg>`,
      feedback:`
      <svg width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8.24999 18L5.24999 20.25V15.75H2.25C1.85217 15.75 1.47064 15.5919 1.18934 15.3106C0.908034 15.0293 0.749999 14.6478 0.749999 14.25V2.25C0.749999 1.85217 0.908034 1.47064 1.18934 1.18934C1.47064 0.908034 1.85217 0.749999 2.25 0.749999H18.75C19.1478 0.749999 19.5293 0.908034 19.8106 1.18934C20.0919 1.47064 20.25 1.85217 20.25 2.25V6.71484" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M5.24999 5.24999H15.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M5.24999 9.74999H8.24999" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M23.25 18.75H20.25V23.25L15.75 18.75H11.25V9.74999H23.25V18.75Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M19.5 15H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      usages:`
      <svg width="800px" height="800px" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><defs><style>.a{fill:none;stroke:#000000;stroke-linecap:round;stroke-linejoin:round;}</style></defs><line class="a" x1="43.5" y1="5.21" x2="4.5" y2="5.21"/><line class="a" x1="41.55" y1="36.41" x2="41.55" y2="5.21"/><line class="a" x1="4.5" y1="36.41" x2="43.5" y2="36.41"/><line class="a" x1="6.45" y1="5.21" x2="6.45" y2="36.41"/><path class="a" d="M33.2,15.64a2.32,2.32,0,1,1-4.64,0V11.51a2.32,2.32,0,0,1,4.64,0Z"/><path class="a" d="M19.44,23.12a2.32,2.32,0,0,1-4.64,0V19a2.32,2.32,0,0,1,4.64,0Z"/><path class="a" d="M33.2,30.6a2.32,2.32,0,0,1-4.64,0V26.47a2.32,2.32,0,0,1,4.64,0Z"/><line class="a" x1="11.33" y1="13.58" x2="28.56" y2="13.58"/><line class="a" x1="11.33" y1="28.53" x2="28.56" y2="28.53"/><line class="a" x1="33.2" y1="13.58" x2="36.67" y2="13.58"/><line class="a" x1="33.2" y1="28.53" x2="36.67" y2="28.53"/><line class="a" x1="19.44" y1="21.06" x2="36.67" y2="21.06"/><line class="a" x1="14.8" y1="21.06" x2="11.33" y2="21.06"/><line class="a" x1="11.93" y1="42.46" x2="17.96" y2="36.41"/><line class="a" x1="24" y1="36.41" x2="24" y2="42.79"/><line class="a" x1="36.07" y1="42.46" x2="30.04" y2="36.41"/></svg>`,
      'course-catalog': `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>`,
      'my-learning': `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>`,
    };
    return this.sanitizer.bypassSecurityTrustHtml(icons[type] || '');
  }
}
