import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { PortalAddonCard, PortalAddonStatus, PortalAddonsData } from '../../../core/models/client-portal.model';
import { ClientPortalService } from '../../../core/services/client-portal.service';
import { PortalIcon } from '../../portal-icon';

type Filter = 'all' | PortalAddonStatus;

const STATUS_LABEL: Record<PortalAddonStatus, string> = {
  active: 'Active', trial: 'On trial', expired: 'Expired', available: 'Available',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

@Component({
  selector: 'portal-addons',
  standalone: true,
  imports: [CommonModule, PortalIcon],
  templateUrl: './portal-addons.html',
  styleUrl: './portal-addons.css',
})
export class PortalAddons implements OnInit {
  private api = inject(ClientPortalService);
  private route = inject(ActivatedRoute);

  loading = signal(true);
  error = signal('');
  data = signal<PortalAddonsData | null>(null);

  filter = signal<Filter>('all');
  query = signal('');
  selectedKey = signal<string | null>(null);

  readonly skeletons = [1, 2, 3, 4, 5, 6];

  summary = computed(() => this.data()?.summary ?? null);
  selected = computed(() => this.data()?.addons.find(a => a.key === this.selectedKey()) ?? null);

  /** chips with counts (only statuses that actually exist) */
  chips = computed<Array<{ id: Filter; label: string; count: number }>>(() => {
    const s = this.summary();
    if (!s) return [];
    const all: Array<{ id: Filter; label: string; count: number }> = [
      { id: 'all', label: 'All', count: s.total },
      { id: 'active', label: 'Active', count: s.active },
      { id: 'trial', label: 'On trial', count: s.trial },
      { id: 'available', label: 'Available', count: s.available },
      { id: 'expired', label: 'Expired', count: s.expired },
    ];
    return all.filter(c => c.id === 'all' || c.count > 0);
  });

  cards = computed(() => {
    const f = this.filter();
    const q = this.query().trim().toLowerCase();
    return (this.data()?.addons ?? []).filter(a =>
      (f === 'all' || a.status === f) &&
      (!q || a.name.toLowerCase().includes(q) || a.shortDescription.toLowerCase().includes(q)));
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getAddons().subscribe({
      next: (res) => {
        if (res?.status && res.data) {
          this.data.set(res.data);
          this.loading.set(false);
          // deep link: /client-portal/addons#face
          const frag = this.route.snapshot.fragment;
          if (frag && res.data.addons.some(a => a.key === frag)) this.selectedKey.set(frag);
        } else {
          this.error.set(res?.msg || 'Could not load add-ons.');
          this.loading.set(false);
        }
      },
      error: () => { this.error.set('Could not load add-ons. Please try again.'); this.loading.set(false); },
    });
  }

  setFilter(f: Filter): void { this.filter.set(f); }
  onSearch(ev: Event): void { this.query.set((ev.target as HTMLInputElement).value); }
  open(c: PortalAddonCard): void { this.selectedKey.set(c.key); }
  @HostListener('document:keydown.escape') close(): void { this.selectedKey.set(null); }

  statusLabel(s: PortalAddonStatus): string { return STATUS_LABEL[s]; }

  /** same icon keys as the dashboard / My Plan */
  private static readonly ICONS: Record<string, string> = {
    face: 'face', shift: 'shift', geofence: 'geofence', tracking: 'track',
    clients: 'clients', visits: 'visit', expense: 'expense', leavetimeoff: 'timeoff',
  };
  icon(key: string): string { return PortalAddons.ICONS[key] ?? 'addons'; }

  money(n: number | null | undefined, currency?: string | null): string {
    if (n === null || n === undefined) return '';
    const cur = currency || this.summary()?.currency || 'INR';
    const sym = cur === 'INR' ? '₹' : cur === 'USD' ? '$' : cur + ' ';
    return sym + n.toLocaleString(cur === 'INR' ? 'en-IN' : 'en-US', { maximumFractionDigits: 2 });
  }

  date(iso: string | null | undefined): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${+d} ${MONTHS[+m - 1]} ${y}`;
  }

  /** one-line state shown at the bottom of a card */
  footnote(c: PortalAddonCard): string {
    const p = c.purchase;
    if (c.status === 'available' || !p) return '';
    if (c.status === 'expired') return p.endDate ? `Expired on ${this.date(p.endDate)}` : 'Expired';
    if (p.endsWithPlan) return 'Valid with your plan';
    if (p.daysLeft === null) return '';
    if (p.daysLeft < 0) return `Expired on ${this.date(p.endDate)}`;
    if (p.daysLeft === 0) return 'Ends today';
    return `${p.daysLeft} day${p.daysLeft === 1 ? '' : 's'} left · ends ${this.date(p.endDate)}`;
  }

  learnMore(c: PortalAddonCard): void { if (c.learnMoreUrl) window.open(c.learnMoreUrl, '_blank', 'noopener,noreferrer'); }
  trackByKey(_: number, c: PortalAddonCard): string { return c.key; }
}