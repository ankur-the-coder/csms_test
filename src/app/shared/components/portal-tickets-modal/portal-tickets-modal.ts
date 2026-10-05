import { Component, ElementRef, HostListener, Injector, OnDestroy, afterNextRender, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ClientPortalService } from '../../../core/services/client-portal.service';
import { PortalState } from '../../../core/services/portal-state';
import { PortalTicketItem } from '../../../core/models/client-portal.model';
import { PortalIcon } from '../../portal-icon';
import { ticketStatusKey, ticketStatusLabel } from '../../utils/ticket-status';

type StatusFilter = '' | 'open' | 'closed';

@Component({
  selector: 'app-portal-tickets-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, PortalIcon],
  templateUrl: './portal-tickets-modal.html',
  styleUrls: ['../portal-ui.css', './portal-tickets-modal.css'],
})
export class PortalTicketsModal implements OnDestroy {
  private portalService = inject(ClientPortalService);
  readonly state = inject(PortalState);
  private injector = inject(Injector);

  /** Keeps the list area at the tallest height seen since the modal opened (no shrinking on filter). */
  private body = viewChild<ElementRef<HTMLElement>>('body');
  lockedHeight = signal(0);

  tickets = signal<PortalTicketItem[]>([]);
  isLoading = signal(false);
  errorMessage = signal('');

  searchQuery = signal('');
  selectedStatus = signal<StatusFilter>('');
  currentPage = signal(1);
  pageSize = signal(10);
  totalTickets = signal(0);
  totalPages = signal(1);

  readonly filters: { key: StatusFilter; label: string }[] = [
    { key: '', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'closed', label: 'Closed' },
  ];

  private req?: Subscription;

  constructor() {
    // Runs ONLY when the modal opens/closes. Everything else happens inside untracked(),
    // otherwise the effect also depended on selectedStatus/currentPage and reset the filter
    // on every click (this was the "reload + blink" bug).
    effect(() => {
      const open = this.state.ticketsModalOpen();
      const initial = this.state.ticketsModalStatusFilter();
      untracked(() => {
        if (!open) { this.req?.unsubscribe(); return; }
        this.selectedStatus.set(initial ? ticketStatusKey(initial) : '');
        this.searchQuery.set('');
        this.currentPage.set(1);
        this.lockedHeight.set(0);
        this.loadTickets();
      });
    });
  }

  ngOnDestroy(): void { this.req?.unsubscribe(); }

  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.state.ticketsModalOpen()) this.closeModal(); }

  loadTickets(): void {
    this.req?.unsubscribe();
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.req = this.portalService.listTickets({
      status: this.selectedStatus() || undefined,
      search: this.searchQuery().trim() || undefined,
      page: this.currentPage(),
      pageSize: this.pageSize(),
    }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res?.status && res?.data) {
          this.tickets.set(res.data.tickets || []);
          this.totalTickets.set(res.data.total || 0);
          this.totalPages.set(res.data.totalPages || 1);
          afterNextRender(() => {
            const h = this.body()?.nativeElement.offsetHeight ?? 0;
            if (h > this.lockedHeight()) this.lockedHeight.set(h);
          }, { injector: this.injector });
        } else {
          this.errorMessage.set('Failed to load tickets.');
        }
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('Error loading tickets. Please try again.');
      },
    });
  }

  onSearch(): void { this.currentPage.set(1); this.loadTickets(); }

  onStatusChange(status: StatusFilter): void {
    if (status === this.selectedStatus()) return;
    this.selectedStatus.set(status);
    this.currentPage.set(1);
    this.loadTickets();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) { this.currentPage.set(page); this.loadTickets(); }
  }

  openTicket(ticket: PortalTicketItem): void { this.state.openTicketDetail(ticket.ticket_uid); }
  closeModal(): void { this.state.closeTicketsList(); }

  statusKey(s: string): 'open' | 'closed' { return ticketStatusKey(s); }
  statusLabel(s: string): string { return ticketStatusLabel(s); }
  filterIndex(): number { return Math.max(0, this.filters.findIndex(f => f.key === this.selectedStatus())); }
}