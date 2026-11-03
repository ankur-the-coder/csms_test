import { Component, HostListener, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { ClientPortalService } from '../../../core/services/client-portal.service';
import { PortalState } from '../../../core/services/portal-state';
import { PortalIcon } from '../../portal-icon';

const LABELS: Record<number, string> = {
  1: 'Very Unsatisfied', 2: 'Unsatisfied', 3: 'Neutral', 4: 'Satisfied', 5: 'Very Satisfied',
};

/**
 * Star-rating + feedback modal for closed tickets. Same questions ubiDesk asks:
 *   4-5 stars → "liked most" + "improve further"
 *   3 stars   → "what can we improve"
 *   1-2 stars → "what went wrong" (the ticket is reopened for the support team)
 */
@Component({
  selector: 'app-portal-feedback-modal',
  standalone: true,
  imports: [CommonModule, PortalIcon],
  templateUrl: './portal-feedback-modal.html',
  styleUrls: ['../portal-ui.css', './portal-feedback-modal.css'],
})
export class PortalFeedbackModal {
  private api = inject(ClientPortalService);
  private toastr = inject(ToastrService);
  readonly state = inject(PortalState);

  readonly starsRev = [5, 4, 3, 2, 1];
  rating = signal(0);
  hover = signal(0);
  likedMost = signal('');
  improve = signal('');
  explanation = signal('');
  submitting = signal(false);
  error = signal('');

  tier = computed<'none' | 'positive' | 'neutral' | 'negative'>(() => {
    const r = this.rating();
    return r >= 4 ? 'positive' : r === 3 ? 'neutral' : r >= 1 ? 'negative' : 'none';
  });
  label = computed(() => LABELS[this.hover() || this.rating()] || 'Tap a star to rate');

  constructor() {
    effect(() => {
      const uid = this.state.feedbackTicketUid();
      const initial = this.state.feedbackInitialRating();
      untracked(() => {
        this.rating.set(uid ? initial : 0);
        this.hover.set(0);
        this.likedMost.set('');
        this.improve.set('');
        this.explanation.set('');
        this.error.set('');
        this.submitting.set(false);
      });
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.state.feedbackTicketUid() && !this.submitting()) this.close(); }

  close(): void { this.state.closeFeedback(); }

  isOn(n: number): boolean { return n <= (this.hover() || this.rating()); }

  onText(sig: { set(v: string): void }, ev: Event): void { sig.set((ev.target as HTMLTextAreaElement).value); }

  submit(): void {
    const uid = this.state.feedbackTicketUid();
    const rating = this.rating();
    if (!uid || !rating || this.submitting()) return;
    const tier = this.tier();

    this.submitting.set(true);
    this.error.set('');
    this.api.submitTicketFeedback({
      ticketUid: uid,
      rating,
      likedMost: tier === 'positive' ? this.likedMost().trim() : undefined,
      improve: tier === 'negative' ? undefined : this.improve().trim(),
      explanation: tier === 'negative' ? this.explanation().trim() : undefined,
    }).subscribe({
      next: (res) => {
        this.submitting.set(false);
        if (res?.status) {
          const reopened = !!res.data?.reopened;
          this.state.lastFeedback.set({ ticketUid: uid, rating, reopened });
          if (reopened) this.toastr.info(`Ticket ${uid} has been reopened. Our team will follow up shortly.`, 'Thanks for your feedback');
          else this.toastr.success('We really appreciate you taking the time to help us improve.', 'Thanks for your feedback');
          this.close();
        } else {
          this.error.set(res?.msg || 'Could not submit your feedback. Please try again.');
        }
      },
      error: (e) => {
        this.submitting.set(false);
        this.error.set(e?.error?.msg || 'Could not submit your feedback. Please try again.');
      },
    });
  }
}
