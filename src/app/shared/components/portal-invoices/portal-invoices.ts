import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PortalInvoice, PortalInvoicesData, PortalInvoiceStatus } from '../../../core/models/client-portal.model';
import { ClientPortalService } from '../../../core/services/client-portal.service';
import { PortalState } from '../../../core/services/portal-state';
import { PortalIcon } from '../../portal-icon';

type Filter = 'all' | 'paid' | 'incomplete';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PAGE = 12;
/** reuse the status pill colours of the Add-ons page */
const PILL: Record<PortalInvoiceStatus, string> = {
  paid: 's-active', free: 's-available', pending: 's-trial', failed: 's-expired', other: 's-available',
};

@Component({
  selector: 'portal-invoices',
  standalone: true,
  imports: [CommonModule, PortalIcon],
  templateUrl: './portal-invoices.html',
  styleUrls: ['../portal-addons/portal-addons.css', './portal-invoices.css'],
})
export class PortalInvoices implements OnInit {
  private api = inject(ClientPortalService);
  private state = inject(PortalState);

  loading = signal(true);
  error = signal('');
  data = signal<PortalInvoicesData | null>(null);

  filter = signal<Filter>('all');
  query = signal('');
  limit = signal(PAGE);
  selectedKey = signal<string | null>(null);

  readonly skeletons = [1, 2, 3, 4, 5];

  summary = computed(() => this.data()?.summary ?? null);
  selected = computed(() => this.data()?.invoices.find(i => i.key === this.selectedKey()) ?? null);

  chips = computed<Array<{ id: Filter; label: string; count: number }>>(() => {
    const s = this.summary();
    if (!s) return [];
    const all: Array<{ id: Filter; label: string; count: number }> = [
      { id: 'all', label: 'All', count: s.paidCount + s.incompleteCount },
      { id: 'paid', label: 'Payments', count: s.paidCount },
      { id: 'incomplete', label: 'Not completed', count: s.incompleteCount },
    ];
    return all.filter(c => c.id === 'all' || c.count > 0);
  });

  filtered = computed(() => {
    const f = this.filter();
    const q = this.query().trim().toLowerCase();
    return (this.data()?.invoices ?? []).filter(i =>
      (f === 'all' || i.kind === f) &&
      (!q || (i.invoiceNumber ?? '').toLowerCase().includes(q) || i.reference.toLowerCase().includes(q) ||
        i.method.toLowerCase().includes(q) || i.type.toLowerCase().includes(q) || i.items.some(x => x.label.toLowerCase().includes(q))));
  });
  rows = computed(() => this.filtered().slice(0, this.limit()));

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getInvoices().subscribe({
      next: (res) => {
        if (res?.status && res.data) { this.data.set(res.data); }
        else { this.error.set(res?.msg || 'Could not load your payments.'); }
        this.loading.set(false);
      },
      error: () => { this.error.set('Could not load your payments. Please try again.'); this.loading.set(false); },
    });
  }

  setFilter(f: Filter): void { this.filter.set(f); this.limit.set(PAGE); }
  onSearch(ev: Event): void { this.query.set((ev.target as HTMLInputElement).value); this.limit.set(PAGE); }
  more(): void { this.limit.update(n => n + PAGE); }
  open(i: PortalInvoice): void { this.selectedKey.set(i.key); }
  @HostListener('document:keydown.escape') close(): void { this.selectedKey.set(null); }

  pill(s: PortalInvoiceStatus): string { return PILL[s]; }

  money(n: number | null | undefined, symbol: string): string {
    if (n === null || n === undefined) return '';
    const loc = symbol === '₹' ? 'en-IN' : 'en-US';
    return symbol + n.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  date(iso: string | null | undefined): string {
    if (!iso) return '-';
    const [y, m, d] = iso.split('-');
    return `${+d} ${MONTHS[+m - 1]} ${y}`;
  }

  /** the amount column: not-completed attempts are shown muted, free rows say "No charge" */
  amount(i: PortalInvoice): string { return i.status === 'free' ? 'No charge' : this.money(i.total, i.symbol); }

  /** support is the way to get a PDF copy – the portal does not store invoice files */
  askCopy(): void { this.state.openRaiseTicket(); }
}
