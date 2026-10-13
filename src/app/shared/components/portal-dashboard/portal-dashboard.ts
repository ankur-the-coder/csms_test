import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PortalDashboardData, PortalTicket, PortalTraining } from '../../../core/models/client-portal.model';
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

  loading = signal(true);
  error = signal('');
  data = signal<PortalDashboardData | null>(null);
  /** flips true a beat after data arrives so rings / bars animate from 0 */
  animate = signal(false);
  tab = signal<'trainings' | 'meetings'>('trainings');

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

  ngOnInit(): void { this.load(); }

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
  addonIcon(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('face')) return 'face';
    if (n.includes('geo')) return 'geo';
    if (n.includes('shift')) return 'shift';
    if (n.includes('payroll')) return 'payroll';
    if (n.includes('timesheet')) return 'timesheet';
    if (n.includes('tracking')) return 'track';
    if (n.includes('clients')) return 'clients';
    if (n.includes('visit')) return 'visit';
    if (n.includes('expense')) return 'expense';
    if (n.includes('leave')) return 'leave';
    return 'addons';
  }
  initials(name: string | null): string {
    return (name || 'CS').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }
}