import { Component, Input, Output, EventEmitter, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  category?: string;
  badge?: string;
  route?: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside 
      class="h-screen bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transition-all duration-300 select-none shrink-0"
      [ngClass]="{'w-64': !collapsed, 'w-20': collapsed}"
    >
      <!-- Brand Logo Header (100% Clean - No Toggle Button Here) -->
      <div 
        class="h-16 flex items-center border-b border-slate-800 bg-slate-950/80 transition-all"
        [ngClass]="{'px-5 justify-start': !collapsed, 'px-2 justify-center': collapsed}"
      >
        <div 
          class="flex items-center gap-3 overflow-hidden cursor-pointer" 
          (click)="selectNav('dashboard')"
          [title]="collapsed ? 'UBITECH CSMS Platform' : ''"
        >
          <div class="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-400 flex items-center justify-center text-white font-extrabold text-lg shadow-lg shadow-indigo-500/20 shrink-0">
            C
          </div>
          <div *ngIf="!collapsed" class="flex flex-col min-w-0">
            <span class="font-extrabold text-white tracking-wide text-sm leading-tight">UBITECH</span>
            <span class="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">CSMS Platform</span>
          </div>
        </div>
      </div>

      <!-- Navigation Links -->
      <div class="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        
        <!-- Main Navigation Section -->
        <div>
          <div *ngIf="!collapsed" class="px-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">
            Main Menu
          </div>
          <nav class="space-y-1">
            <button 
              *ngFor="let item of mainNavItems"
              (click)="selectNav(item.id)"
              class="w-full flex items-center rounded-xl text-sm font-medium transition-all group relative cursor-pointer"
              [ngClass]="{
                'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30': activeNav === item.id,
                'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60': activeNav !== item.id,
                'px-3 py-2.5 gap-3 justify-start': !collapsed,
                'p-2.5 justify-center': collapsed
              }"
            >
              <div class="w-5 h-5 flex items-center justify-center shrink-0" [innerHTML]="getSvgIcon(item.icon)"></div>
              
              <span *ngIf="!collapsed" class="truncate flex-1 text-left">{{ item.label }}</span>

              <span 
                *ngIf="item.badge && !collapsed" 
                class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
              >
                {{ item.badge }}
              </span>

              <!-- Hover Tooltip on Collapsed Sidebar -->
              <div 
                *ngIf="collapsed" 
                class="absolute left-full ml-3 px-3 py-1.5 bg-slate-950 text-white text-xs font-semibold rounded-lg shadow-2xl border border-slate-800 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 flex items-center gap-2"
              >
                <span>{{ item.label }}</span>
                <span *ngIf="item.badge" class="px-1.5 py-0.2 text-[9px] bg-indigo-500/30 text-indigo-200 rounded font-bold">{{ item.badge }}</span>
              </div>
            </button>
          </nav>
        </div>

        <!-- CS Management Section -->
        <div>
          <div *ngIf="!collapsed" class="px-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">
            Customer Success
          </div>
          <nav class="space-y-1">
            <button 
              *ngFor="let item of csNavItems"
              (click)="selectNav(item.id)"
              class="w-full flex items-center rounded-xl text-sm font-medium transition-all group relative cursor-pointer"
              [ngClass]="{
                'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30': activeNav === item.id,
                'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60': activeNav !== item.id,
                'px-3 py-2.5 gap-3 justify-start': !collapsed,
                'p-2.5 justify-center': collapsed
              }"
            >
              <div class="w-5 h-5 flex items-center justify-center shrink-0" [innerHTML]="getSvgIcon(item.icon)"></div>
              
              <span *ngIf="!collapsed" class="truncate flex-1 text-left">{{ item.label }}</span>

              <span 
                *ngIf="item.badge && !collapsed" 
                class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              >
                {{ item.badge }}
              </span>

              <div 
                *ngIf="collapsed" 
                class="absolute left-full ml-3 px-3 py-1.5 bg-slate-950 text-white text-xs font-semibold rounded-lg shadow-2xl border border-slate-800 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 flex items-center gap-2"
              >
                <span>{{ item.label }}</span>
                <span *ngIf="item.badge" class="px-1.5 py-0.2 text-[9px] bg-emerald-500/30 text-emerald-200 rounded font-bold">{{ item.badge }}</span>
              </div>
            </button>
          </nav>
        </div>
      </div>

      <!-- Footer / Bottom Collapse Control & System Info -->
      <div class="p-3 border-t border-slate-800 bg-slate-950/80 space-y-2">
        
        <!-- Primary Collapse / Expand Button ONLY at Bottom -->
        <button 
          (click)="toggleCollapse()"
          class="w-full flex items-center rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-all border border-slate-700/60 cursor-pointer shadow-xs group"
          [ngClass]="{'px-3 py-2 justify-between': !collapsed, 'h-10 w-10 mx-auto justify-center': collapsed}"
          [title]="collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'"
        >
          <span *ngIf="!collapsed" class="text-xs font-bold text-slate-300">Collapse Sidebar</span>
          <div class="h-6 w-6 rounded-lg bg-slate-700/50 group-hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-all">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              class="h-4 w-4 text-slate-300 transition-transform duration-300"
              [ngClass]="{'rotate-180': collapsed}"
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </div>
        </button>

        <!-- System Health Status Indicator -->
        <div 
          class="flex items-center rounded-xl bg-slate-800/30 border border-slate-700/40"
          [ngClass]="{'px-3 py-2 gap-3': !collapsed, 'p-1.5 justify-center border-none bg-transparent': collapsed}"
        >
          <div class="h-7 w-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </div>
          <div *ngIf="!collapsed" class="flex flex-col min-w-0">
            <span class="text-[11px] font-bold text-slate-200 truncate">CSMS Engine</span>
            <span class="text-[9px] font-medium text-slate-400">Status: v2.4 Active</span>
          </div>
        </div>

      </div>
    </aside>
  `
})
export class SidebarComponent implements OnInit {
  private sanitizer = inject(DomSanitizer);
  private router = inject(Router);

  @Input() activeNav = 'dashboard';
  @Output() navChange = new EventEmitter<string>();

  collapsed = false;

  mainNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { id: 'clients', label: 'Clients Directory', icon: 'clients', badge: '256' },
  ];

  csNavItems: NavItem[] = [
    { id: 'onboarding', label: 'Onboarding', icon: 'onboarding' },
    { id: 'implementation', label: 'Implementation Status', icon: 'implementation', badge: 'Active', route: '/implementation' },
    { id: 'training', label: 'Training Center', icon: 'training' },
    { id: 'meetings', label: 'Meetings & Reviews', icon: 'meetings' },
    { id: 'health', label: 'Health Score', icon: 'health' },
    { id: 'support', label: 'Support Tickets', icon: 'support', badge: '34' },
    { id: 'settings', label: 'Settings & Master', icon: 'settings' }
  ];

  ngOnInit() {
    this.updateActiveFromRoute(this.router.url);
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.updateActiveFromRoute(event.urlAfterRedirects || event.url);
    });
  }

  private updateActiveFromRoute(url: string) {
    if (url.includes('implementation')) {
      this.activeNav = 'implementation';
    } else if (url.includes('dashboard')) {
      this.activeNav = 'dashboard';
    }
  }

  toggleCollapse() {
    this.collapsed = !this.collapsed;
  }

  selectNav(id: string) {
    this.activeNav = id;
    this.navChange.emit(id);

    if (id === 'dashboard') {
      this.router.navigate(['/dashboard']);
    } else if (id === 'implementation') {
      this.router.navigate(['/implementation']);
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
      health: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`,
      support: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`,
      settings: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`
    };
    return this.sanitizer.bypassSecurityTrustHtml(icons[type] || '');
  }
}
