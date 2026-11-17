import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PortalPlanData, PortalPlanItem } from '../../../core/models/client-portal.model';
import { ClientPortalService } from '../../../core/services/client-portal.service';
import { PortalState } from '../../../core/services/portal-state';
import { PortalIcon } from '../../portal-icon';

const STATE_LABEL: Record<string, string> = {
  trial: 'Trial', active: 'Active', expiring: 'Expiring soon', expired: 'Expired', unknown: 'Plan',
};

@Component({
  selector: 'portal-my-plan',
  standalone: true,
  imports: [CommonModule, PortalIcon],
  templateUrl: './portal-my-plan.html',
  styleUrl: './portal-my-plan.css',
})
export class PortalMyPlan implements OnInit {
  private api = inject(ClientPortalService);
  private state = inject(PortalState);

  loading = signal(true);
  error = signal('');
  data = signal<PortalPlanData | null>(null);
  animate = signal(false);

  readonly skeletons = [1, 2, 3, 4, 5, 6];

  plan = computed(() => this.data()?.plan ?? null);
  stateLabel = computed(() => STATE_LABEL[this.plan()?.state ?? 'unknown']);
  totalPurchased = computed(() => (this.data()?.modules.length ?? 0) + (this.data()?.addons.length ?? 0));

  /** Banner shown for trial / expiring / expired plans. */
  notice = computed<{ tone: 'warn' | 'danger' | 'info'; title: string; text: string } | null>(() => {
    const p = this.plan();
    if (!p) return null;
    const d = p.daysLeft;
    if (p.state === 'expired') {
      return { tone: 'danger', title: 'Your plan has expired',
        text: 'Renew now to keep your team’s access uninterrupted. Raise a request and your account team will help you.' };
    }
    if (p.state === 'expiring' && d !== null) {
      return { tone: 'warn', title: d === 0 ? 'Your plan expires today' : `Your plan expires in ${d} day${d === 1 ? '' : 's'}`,
        text: 'Renew early so there is no break in service for your employees.' };
    }
    if (p.state === 'trial') {
      return { tone: 'info', title: 'You are on a trial plan',
        text: d !== null && d >= 0 ? `${d} day${d === 1 ? '' : 's'} left in your trial. Talk to us to move to a paid plan.` : 'Talk to us to move to a paid plan.' };
    }
    return null;
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.animate.set(false);
    this.api.getPlan().subscribe({
      next: (res) => {
        if (res?.status && res.data) {
          this.data.set(res.data);
          this.loading.set(false);
          setTimeout(() => this.animate.set(true), 120);
        } else {
          this.error.set(res?.msg || 'Could not load your plan.');
          this.loading.set(false);
        }
      },
      error: () => { this.error.set('Could not load your plan. Please try again.'); this.loading.set(false); },
    });
  }

  /** Same icon keys as the dashboard (backend catalog `key`). */
  private static readonly ICONS: Record<string, string> = {
    employee: 'employee', attendance: 'attendance', leave: 'leave', salary: 'salary',
    organization: 'organization', performance: 'performance', timesheet: 'timesheet', payroll: 'payroll',
    face: 'face', shift: 'shift', geofence: 'geofence', tracking: 'track',
    clients: 'clients', visits: 'visit', expense: 'expense', leavetimeoff: 'timeoff',
  };
  icon(i: PortalPlanItem): string { return PortalMyPlan.ICONS[i.key] ?? 'addons'; }

  contactSupport(): void { this.state.openRaiseTicket(); }
termDays = computed<number | null>(() => {
  const p = this.plan();
  if (!p?.startDate || !p?.endDate) return null;
  const ms = new Date(p.endDate).getTime() - new Date(p.startDate).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
});
}
