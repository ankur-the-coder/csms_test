import { Injectable, signal } from '@angular/core';

/**
 * Shared state store for Client Portal: manages shell metadata and ticket modal states.
 */
@Injectable({ providedIn: 'root' })
export class PortalState {
  orgName = signal('');
  orgLogo = signal<string | null>(null);
  unread = signal(0);

  // Modal signals
  ticketsModalOpen = signal(false);
  ticketsModalStatusFilter = signal<string | null>(null);

  detailModalOpen = signal(false);
  selectedTicketUid = signal<string | null>(null);

  raiseTicketModalOpen = signal(false);
  quickActionsOpen = signal(false);

  openTicketsList(statusFilter?: string): void {
    this.ticketsModalStatusFilter.set(statusFilter || null);
    this.ticketsModalOpen.set(true);
  }

  closeTicketsList(): void {
    this.ticketsModalOpen.set(false);
    this.ticketsModalStatusFilter.set(null);
  }

  openTicketDetail(ticketUid: string): void {
    this.selectedTicketUid.set(ticketUid);
    this.detailModalOpen.set(true);
  }

  closeTicketDetail(): void {
    this.detailModalOpen.set(false);
    this.selectedTicketUid.set(null);
  }

  // Star-rating / feedback modal
  feedbackTicketUid = signal<string | null>(null);
  feedbackSubject = signal<string>('');
  feedbackInitialRating = signal(0);
  /** Set after a successful submit so the dashboard / detail modal can refresh themselves. */
  lastFeedback = signal<{ ticketUid: string; rating: number; reopened: boolean } | null>(null);

  openFeedback(ticketUid: string, rating = 0, subject = ''): void {
    this.feedbackInitialRating.set(rating);
    this.feedbackSubject.set(subject);
    this.feedbackTicketUid.set(ticketUid);
  }

  closeFeedback(): void {
    this.feedbackTicketUid.set(null);
  }

  openRaiseTicket(): void {
    this.raiseTicketModalOpen.set(true);
  }

  closeRaiseTicket(): void {
    this.raiseTicketModalOpen.set(false);
  }

  openQuickActions(): void {
    this.quickActionsOpen.set(true);
  }

  closeQuickActions(): void {
    this.quickActionsOpen.set(false);
  }
}