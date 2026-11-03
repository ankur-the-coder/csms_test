import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PortalAddon, PortalDashboardData, PortalTicket, PortalTraining } from '../../../core/models/client-portal.model';
import { ClientPortalService } from '../../../core/services/client-portal.service';
import { PortalState } from '../../../core/services/portal-state';
import { PortalCountUp } from '../../count-up.directive';
import { PortalIcon } from '../../portal-icon';
import { ticketStatusLabel, ticketStatusKey } from '../../utils/ticket-status';

@Component({
  selector: 'portal-dashboard',
  standalone: true,
  imports: [CommonModule, PortalIcon, PortalCountUp],
  templateUrl: './portal-dashboard.html',
  styleUrl: './portal-dashboard.css',
})
export class PortalDashboard implements OnInit {
  private api = inject(ClientPortalService);
  private state = inject(PortalState);
  private router = inject(Router);

  loading = signal(true);
  error = signal('');
  data = signal<PortalDashboardData | null>(null);
  /** flips true a beat after data arrives so rings / bars animate from 0 */
  animate = signal(false);
  tab = signal<'trainings' | 'meetings'>('trainings');
  /** tabId of the tracker module shown in the detail panel */
  selectedTab = signal<number | null>(null);
  selected = computed(() => {
    const list = this.data()?.tracker ?? [];
    return list.find(t => t.tabId === this.selectedTab()) ?? list[0] ?? null;
  });
  showAllAddons = signal(false);
  visibleAddons = computed(() => {
    const l = this.data()?.addons.suggested ?? [];
    return this.showAllAddons() ? l : l.slice(0, 8);
  });

  // ring geometry (r = 38)
  readonly C = 2 * Math.PI * 38;

  readonly skeletonCards = [1, 2, 3, 4, 5];
  readonly skeletonRows = [1, 2, 3, 4, 5];

  today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
  greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  })();

  plan = computed(() => this.data()?.plan ?? null);
  planPct = computed(() => {
    const p = this.plan();
    return p && p.userLimit > 0 ? Math.min(100, Math.round((p.registeredEmployees / p.userLimit) * 100)) : 0;
  });
  trainingPct = computed(() => {
    const t = this.data()?.trainingProgress;
    return t && t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0;
  });
  trackerDone = computed(() => (this.data()?.tracker ?? []).filter(t => t.status === 'completed').length);

  readonly stars = [1, 2, 3, 4, 5];
  /** 5..1 — rendered right-to-left so hovering a star lights up the ones before it. */
  readonly starsRev = [5, 4, 3, 2, 1];

  constructor() {
    // Reflect a just-submitted rating in the recent-tickets list without reloading the page.
    effect(() => {
      const f = this.state.lastFeedback();
      if (!f) return;
      untracked(() => this.data.update(d => d ? {
        ...d,
        support: {
          ...d.support,
          openCases: d.support.openCases + (f.reopened ? 1 : 0),
          recentTickets: d.support.recentTickets.map(t => t.ticketUid === f.ticketUid
            ? { ...t, rating: f.rating, canRate: false, status: f.reopened ? 'open' : t.status } : t),
        },
      } : d));
    });
  }

  ngOnInit(): void { this.load(); }

  rate(t: PortalTicket, n: number, ev: Event): void {
    ev.stopPropagation();
    this.state.openFeedback(t.ticketUid, n, t.subject);
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.animate.set(false);
    this.api.getDashboard().subscribe({
      next: (res) => {
        if (res?.status && res.data) {
          this.data.set(res.data);
          this.state.orgName.set(res.data.orgName || '');
          this.state.orgLogo.set(res.data.orgLogo || null);
          this.state.unread.set(res.data.notifications?.unread ?? 0);
          // open the first module that still has work left
          const list = res.data.tracker ?? [];
          const first = list.find(t => t.status !== 'completed') ?? list[0];
          this.selectedTab.set(first ? first.tabId : null);
          this.loading.set(false);
          setTimeout(() => this.animate.set(true), 120);
        } else {
          this.loading.set(false);
          this.error.set(res?.msg || 'Unable to load your dashboard.');
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.status === 401 ? 'Your session is not valid. Please sign in again.' : (err?.error?.msg || 'Unable to load your dashboard.'));
      },
    });
  }

  offset(pct: number): number { return this.animate() ? this.C * (1 - Math.max(0, Math.min(100, pct)) / 100) : this.C; }
  isSample(key: string): boolean { return !!this.data()?.dummySections?.includes(key); }

  // ---- ticket helpers ----
  ticketLabel(s: string): string { return ticketStatusLabel(s); }
  ticketClass(s: string): string { return ticketStatusKey(s) === 'closed' ? 'st-done' : 'st-open'; }
  openTicket(t: PortalTicket) { this.state.openTicketDetail(t.ticketUid); }
  openAllTickets() { this.state.openTicketsList(); }
  raiseTicket() { this.state.openRaiseTicket(); }
  openQuickActions() { this.state.openQuickActions(); }

  // ---- meeting helpers ----
  meetingLabel(s: number): string {
    return ['Scheduled', 'Completed', 'Rescheduled', 'Pending', 'Cancelled', 'Client No-Show', 'Host No-Show'][s] ?? 'Scheduled';
  }
  select(id: number) { this.selectedTab.set(id); }
  /** previous / next module */
  stepModule(dir: number) {
    const list = this.data()?.tracker ?? [];
    const i = list.findIndex(t => t.tabId === this.selected()?.tabId);
    const n = list[i + dir];
    if (n) this.selectedTab.set(n.tabId);
  }
  trackerIndex(id: number | undefined): number { return (this.data()?.tracker ?? []).findIndex(t => t.tabId === id); }
  statusLabel(s: string): string { return s === 'completed' ? 'Completed' : s === 'in_progress' ? 'In progress' : 'Not started'; }
  healthLabel(h: string | undefined): string { return h === 'Good' ? 'On track' : h === 'Neutral' ? 'In progress' : 'Getting started'; }
  explore(a: PortalAddon) {
    if (a.type !== 'module' && PortalDashboard.PAGE_ADDONS.has(a.key)) { this.router.navigate(['/client-portal/addons'], { fragment: a.key }); return; }
    if (a.url) window.open(a.url, '_blank', 'noopener,noreferrer'); }
  openTraining(t: PortalTraining) { if (t.link) window.open(t.link, '_blank'); }
  join(link: string | null) { if (link) window.open(link, '_blank'); }

  // ---- misc ----
  fmtDate(v: string | null | undefined): string {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  fmtDateTime(v: string): string {
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' +
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  /** Icon per catalog item. Keyed on the backend catalog `key` (ClientPortalCatalogService) so each item has its own icon. */
  private static readonly ADDON_ICONS: Record<string, string> = {
    employee: 'employee', attendance: 'attendance', leave: 'leave', salary: 'salary',
    organization: 'organization', performance: 'performance', timesheet: 'timesheet', payroll: 'payroll',
    face: 'face', shift: 'shift', geofence: 'geofence', tracking: 'track',
    clients: 'clients', visits: 'visit', expense: 'expense', leavetimeoff: 'timeoff',
  };
  private static readonly PAGE_ADDONS = new Set(['face', 'shift', 'geofence', 'tracking', 'clients', 'visits', 'expense', 'leavetimeoff']);
  addonIcon(a: PortalAddon): string {
    return PortalDashboard.ADDON_ICONS[a.key] ?? 'addons';
  }
  initials(name: string | null): string {
    return (name || 'CS').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }
}