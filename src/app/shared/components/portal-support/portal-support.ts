import { Component, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PortalSupportData, PortalTicketItem } from '../../../core/models/client-portal.model';
import { ClientPortalService } from '../../../core/services/client-portal.service';
import { PortalState } from '../../../core/services/portal-state';
import { PortalIcon } from '../../portal-icon';
import { ticketStatusKey, ticketStatusLabel } from '../../utils/ticket-status';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

@Component({
  selector: 'portal-support',
  standalone: true,
  imports: [CommonModule, PortalIcon],
  templateUrl: './portal-support.html',
  styleUrls: ['../portal-addons/portal-addons.css', './portal-support.css'],
})
export class PortalSupport implements OnInit {
  private api = inject(ClientPortalService);
  readonly state = inject(PortalState);

  loading = signal(true);
  error = signal('');
  data = signal<PortalSupportData | null>(null);

  readonly skeletons = [1, 2, 3, 4];
  readonly priorities: Array<{ key: 'high' | 'medium' | 'low'; label: string }> = [
    { key: 'high', label: 'High' }, { key: 'medium', label: 'Medium' }, { key: 'low', label: 'Low' },
  ];
  private modalWasOpen = false;

  constructor() {
    // refresh the numbers after a ticket was raised / rated / viewed (any ticket dialog closing)
    effect(() => {
      const open = this.state.raiseTicketModalOpen() || this.state.ticketsModalOpen()
        || this.state.detailModalOpen() || !!this.state.feedbackTicketUid();
      untracked(() => {
        if (this.modalWasOpen && !open) this.load(true);
        this.modalWasOpen = open;
      });
    });
  }

  ngOnInit(): void { this.load(); }

  load(silent = false): void {
    if (!silent) { this.loading.set(true); this.error.set(''); }
    this.api.getSupport().subscribe({
      next: (res) => {
        if (res?.status && res.data) { this.data.set(res.data); this.error.set(''); }
        else if (!silent) { this.error.set(res?.msg || 'Could not load support.'); }
        this.loading.set(false);
      },
      error: () => { if (!silent) this.error.set('Could not load support. Please try again.'); this.loading.set(false); },
    });
  }

  raise(): void { this.state.openRaiseTicket(); }
  viewAll(): void { this.state.openTicketsList(); }
  viewOpen(): void { this.state.openTicketsList('open'); }
  viewClosed(): void { this.state.openTicketsList('closed'); }
  openTicket(t: PortalTicketItem): void { this.state.openTicketDetail(t.ticket_uid); }

  statusKey(s: string): string { return ticketStatusKey(s); }
  statusLabel(s: string): string { return ticketStatusLabel(s); }

  date(iso: string | null | undefined): string {
    if (!iso) return '-';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '-' : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  resolution(h: number | null): string {
    if (h === null) return '-';
    if (h < 1) return 'Under 1 hr';
    if (h < 48) return `${h} hr${h === 1 ? '' : 's'}`;
    const d = Math.round((h / 24) * 10) / 10;
    return `${d} days`;
  }

  stars(r: number | null): string {
    if (!r) return '';
    const full = Math.round(r);
    return '★'.repeat(full) + '☆'.repeat(Math.max(0, 5 - full));
  }

  telHref(p: string): string { return 'tel:' + p.replace(/[^\d+]/g, ''); }
}