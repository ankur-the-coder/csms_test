import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PortalImplementationData, PortalImplModule } from '../../../core/models/client-portal.model';
import { ClientPortalService } from '../../../core/services/client-portal.service';
import { PortalState } from '../../../core/services/portal-state';
import { PortalCountUp } from '../../count-up.directive';
import { PortalIcon } from '../../portal-icon';

type Filter = 'all' | 'in_progress' | 'pending' | 'completed';
const STATUS_LABEL = { completed: 'Completed', in_progress: 'In progress', pending: 'Not started' } as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ICONS: Record<string, string> = {
  employee: 'employee', attendance: 'attendance', leave: 'leave', salary: 'salary', organization: 'organization',
  performance: 'performance', timesheet: 'timesheet', payroll: 'payroll',
};

@Component({
  selector: 'portal-implementation',
  standalone: true,
  imports: [CommonModule, PortalIcon, PortalCountUp],
  templateUrl: './portal-implementation.html',
  styleUrl: './portal-implementation.css',
})
export class PortalImplementation implements OnInit {
  private api = inject(ClientPortalService);
  private state = inject(PortalState);

  loading = signal(true);
  error = signal('');
  data = signal<PortalImplementationData | null>(null);
  animate = signal(false);
  filter = signal<Filter>('all');
  selectedId = signal<number | null>(null);

  readonly C = 2 * Math.PI * 38;
  readonly statusLabel = STATUS_LABEL;
  readonly skeletons = [1, 2, 3, 4];

  counts = computed(() => {
    const m = this.data()?.modules ?? [];
    return {
      all: m.length,
      in_progress: m.filter(x => x.status === 'in_progress').length,
      pending: m.filter(x => x.status === 'pending').length,
      completed: m.filter(x => x.status === 'completed').length,
    };
  });
  chips = computed(() => [
    { id: 'all' as Filter, label: 'All', n: this.counts().all },
    { id: 'in_progress' as Filter, label: 'In progress', n: this.counts().in_progress },
    { id: 'pending' as Filter, label: 'Not started', n: this.counts().pending },
    { id: 'completed' as Filter, label: 'Completed', n: this.counts().completed },
  ]);
  visible = computed(() => {
    const f = this.filter();
    return (this.data()?.modules ?? []).filter(m => f === 'all' || m.status === f);
  });
  selected = computed<PortalImplModule | null>(() => {
    const mods = this.data()?.modules ?? [];
    return mods.find(m => m.tabId === this.selectedId()) ?? this.visible()[0] ?? mods[0] ?? null;
  });
  tone = computed(() => {
    const h = this.data()?.overall.health;
    return h === 'Good' ? 'good' : h === 'Neutral' ? 'warn' : 'risk';
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.animate.set(false);
    this.api.getImplementation().subscribe({
      next: (res) => {
        if (res?.status && res.data) {
          this.data.set(res.data);
          // open the first module that still has work to do
          const first = res.data.modules.find(m => m.status === 'in_progress') ?? res.data.modules.find(m => m.status === 'pending') ?? res.data.modules[0];
          this.selectedId.set(first?.tabId ?? null);
          this.loading.set(false);
          setTimeout(() => this.animate.set(true), 120);
        } else {
          this.error.set(res?.msg || 'Could not load your implementation.');
          this.loading.set(false);
        }
      },
      error: () => { this.error.set('Could not load your implementation. Please try again.'); this.loading.set(false); },
    });
  }

  offset(p: number): number { return this.C * (1 - Math.max(0, Math.min(100, p)) / 100); }
  icon(label: string): string { return ICONS[(label || '').toLowerCase()] ?? 'implementation'; }
  date(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }
  select(m: PortalImplModule): void { this.selectedId.set(m.tabId); }
  nextIndex(m: PortalImplModule): number { return m.steps.findIndex(s => !s.done); }
  ask(): void { this.state.openRaiseTicket(); }
}
