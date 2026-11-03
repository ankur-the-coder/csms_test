import { Component, HostListener, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ClientPortalService } from '../../../core/services/client-portal.service';
import { PortalState } from '../../../core/services/portal-state';
import { PortalTicketDetail, PortalTicketMessage } from '../../../core/models/client-portal.model';
import { PortalIcon } from '../../portal-icon';
import { ticketStatusKey, ticketStatusLabel } from '../../utils/ticket-status';

@Component({
  selector: 'app-portal-ticket-detail-modal',
  standalone: true,
  imports: [CommonModule, PortalIcon],
  templateUrl: './portal-ticket-detail-modal.html',
  styleUrls: ['../portal-ui.css', './portal-ticket-detail-modal.css'],
})
export class PortalTicketDetailModal implements OnDestroy {
  private portalService = inject(ClientPortalService);
  readonly state = inject(PortalState);

  ticket = signal<PortalTicketDetail | null>(null);
  isLoading = signal(false);
  errorMessage = signal('');
  expanded = signal<Set<number>>(new Set());

  /** Newest first, like the reference timeline. */
  timeline = computed<PortalTicketMessage[]>(() => [...(this.ticket()?.messages ?? [])].reverse());

  private req?: Subscription;

  constructor() {
    effect(() => {
      const open = this.state.detailModalOpen();
      const uid = this.state.selectedTicketUid();
      untracked(() => {
        if (open && uid) {
          this.loadDetail(uid);
        } else {
          this.req?.unsubscribe();
          this.ticket.set(null);
          this.expanded.set(new Set());
        }
      });
    });

    // Reload after the client rates this ticket so the rating box updates.
    effect(() => {
      const f = this.state.lastFeedback();
      untracked(() => {
        if (f && this.state.detailModalOpen() && this.state.selectedTicketUid() === f.ticketUid) this.loadDetail(f.ticketUid);
      });
    });
  }

  readonly stars = [1, 2, 3, 4, 5];
  rate(n: number): void {
    const t = this.ticket();
    if (t) this.state.openFeedback(t.ticket_uid, n, t.subject);
  }

  ngOnDestroy(): void { this.req?.unsubscribe(); }

  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.state.detailModalOpen()) this.closeModal(); }

  loadDetail(ticketUid: string): void {
    this.req?.unsubscribe();
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.ticket.set(null);

    this.req = this.portalService.getTicketDetail(ticketUid).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res?.status && res?.data) this.ticket.set(res.data);
        else this.errorMessage.set('Ticket details not found.');
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('Failed to load ticket details.');
      },
    });
  }

  closeModal(): void { this.state.closeTicketDetail(); }

  statusKey(s: string): 'open' | 'closed' { return ticketStatusKey(s); }
  statusLabel(s: string): string { return ticketStatusLabel(s); }

  // ---- timeline helpers ----
  isAgent(m: PortalTicketMessage): boolean { return m.sender === 'agent'; }
  senderName(m: PortalTicketMessage): string {
    return m.sender_name || (this.isAgent(m) ? 'Support Agent' : 'You');
  }
  day(v: string): string { const d = new Date(v); return isNaN(d.getTime()) ? '' : String(d.getDate()).padStart(2, '0'); }
  mon(v: string): string { const d = new Date(v); return isNaN(d.getTime()) ? '' : d.toLocaleString('en-GB', { month: 'short' }).toUpperCase(); }

  /** Long bodies get a "Show more" toggle. */
  isLong(m: PortalTicketMessage): boolean {
    const plain = (m.message || '').replace(/<(br|\/p|\/div|\/li)\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
    return plain.length > 220 || plain.split('\n').filter(l => l.trim()).length > 4;
  }
  isOpen(id: number): boolean { return this.expanded().has(id); }
  toggle(id: number): void {
    this.expanded.update(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  formatFileSize(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}