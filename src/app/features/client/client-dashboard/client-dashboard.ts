import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Clientdashboard } from '../services/client/clientdashboard/clientdashboard';
import { Data as ClientDashboardData } from '../models/client/clientdashboard.model';
import { Clientdashboardmeeting } from '../services/client/clientdashboard/clientdashboardmeeting';
import { Datum as MeetingDatum } from '../models/client/clientdashboardmeeting.model';
import { Clientdashboardtracker } from '../services/client/clientdashboard/clientdashboardtracker';
import { TrackerItem } from '../models/client/clientdashboardtracker.model';
import { Clientdashboardaddons } from '../services/client/clientdashboard/clientdashboardaddons';
import { AddonItem } from '../models/client/ClientDashboardAddons.model';
import { Clientdashboardtickets } from '../services/client/clientdashboard/clientdashboardtickets';
import { TicketItem } from '../models/client/clientdashboardtickets';

@Component({
  selector: 'app-client-dashboard',
  imports: [CommonModule],
  templateUrl: './client-dashboard.html',
  styleUrl: './client-dashboard.css',
})
export class ClientDashboard {
  private clientDashboardApi = inject(Clientdashboard);
  private clientDashboardMeetingApi = inject(Clientdashboardmeeting);
  private clientDashboardTrackerApi = inject(Clientdashboardtracker);
  private clientDashboardAddonsApi = inject(Clientdashboardaddons);
  private clientDashboardTicketsApi = inject(Clientdashboardtickets);
  private location = inject(Location);
  private route = inject(ActivatedRoute);

  orgName = '';
  orgId: string | null = null;

  dashboardData = signal<ClientDashboardData | null>(null);
  loading = signal(false);
  errorMsg = signal('');

  // ---- Tracker state ----
  tracker = signal<TrackerItem[]>([]);
  trackerLoading = signal(false);
  trackerError = signal('');
  showAllTrackerModal = signal(false);

  // ---- Meetings state ----
  meetings = signal<MeetingDatum[]>([]);
  meetingsLoading = signal(false);
  meetingsError = signal('');
  showAllMeetingsModal = signal(false);

  // ---- Add-ons state ----
  addons = signal<AddonItem[]>([]);
  addonsLoading = signal(false);
  addonsError = signal('');
  showAllAddonsModal = signal(false);

  // ---- Tickets state ----
  tickets = signal<TicketItem[]>([]);
  ticketsLoading = signal(false);
  ticketsError = signal('');
  showAllTicketsModal = signal(false);

  // Widget me sirf top 5 dikhane ke liye
  topFiveTickets = computed(() => this.tickets().slice(0, 5));

  // "View All" tabhi dikhega jab total tickets 5 se jyada hon
  hasMoreTickets = computed(() => this.tickets().length > 5);

  // Widget me sirf top 6 dikhane ke liye
  topSixAddons = computed(() => this.addons().slice(0, 6));

  // "View All" tabhi dikhega jab total addons 6 se jyada hon
  hasMoreAddons = computed(() => this.addons().length > 6);

  // Widget me sirf top 6 dikhane ke liye
  topSixTracker = computed(() => this.tracker().slice(0, 6));

  // "View All" tabhi dikhega jab total addons 6 se jyada hon
  hasMoreTracker = computed(() => this.tracker().length > 6);

  // Widget me sirf top 5 dikhane ke liye
  topFiveMeetings = computed(() => this.meetings().slice(0, 5));
  // "View All" tabhi dikhega jab total addons 6 se jyada hon
  hasMoreMeetings = computed(() => this.meetings().length > 5);

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.orgName = params.get('orgName') ?? '';
      this.orgId = params.get('orgId');

      if (this.orgId) {
        this.loadDashboard(this.orgId);
        this.loadMeetings(this.orgId);
        this.loadTracker(this.orgId);
        this.loadAddons(this.orgId);
        this.loadTickets(this.orgId);
      }
    });
  }

  private loadDashboard(orgId: string): void {
    this.loading.set(true);
    this.errorMsg.set('');

    this.clientDashboardApi.getClientDashboard({ orgId }).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res?.status) {
          this.dashboardData.set(res.data);
        } else {
          this.errorMsg.set(res?.msg || 'Failed to load dashboard');
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(err?.error?.msg || 'Failed to load dashboard');
      },
    });
  }

  private loadMeetings(orgId: string): void {
    this.meetingsLoading.set(true);
    this.meetingsError.set('');

    this.clientDashboardMeetingApi.getClientDashboard({ orgId }).subscribe({
      next: (res) => {
        this.meetingsLoading.set(false);
        if (res?.status) {
          this.meetings.set(res.data ?? []);
        } else {
          this.meetingsError.set(res?.msg || 'Failed to load meetings');
        }
      },
      error: (err) => {
        this.meetingsLoading.set(false);
        this.meetingsError.set(err?.error?.msg || 'Failed to load meetings');
      },
    });
  }

  private loadTracker(orgId: string): void {
    this.trackerLoading.set(true);
    this.trackerError.set('');

    this.clientDashboardTrackerApi.getClientDashboard({ orgId }).subscribe({
      next: (res) => {
        this.trackerLoading.set(false);
        if (res?.status) {
          this.tracker.set(res.data ?? []);
        } else {
          this.trackerError.set(res?.msg || 'Failed to load tracker');
        }
      },
      error: (err) => {
        this.trackerLoading.set(false);
        this.trackerError.set(err?.error?.msg || 'Failed to load tracker');
      },
    });
  }

  private loadAddons(orgId: string): void {
    this.addonsLoading.set(true);
    this.addonsError.set('');

    this.clientDashboardAddonsApi.getClientDashboard({ orgId }).subscribe({
      next: (res) => {
        this.addonsLoading.set(false);
        if (res?.status) {
          this.addons.set(res.data ?? []);
        } else {
          this.addonsError.set(res?.msg || 'Failed to load add-ons');
        }
      },
      error: (err) => {
        this.addonsLoading.set(false);
        this.addonsError.set(err?.error?.msg || 'Failed to load add-ons');
      },
    });
  }

  private loadTickets(orgId: string): void {
    this.ticketsLoading.set(true);
    this.ticketsError.set('');

    this.clientDashboardTicketsApi.getClientDashboard({ orgId }).subscribe({
      next: (res) => {
        this.ticketsLoading.set(false);
        if (res?.status) {
          this.tickets.set(res.data ?? []);
        } else {
          this.ticketsError.set(res?.msg || 'Failed to load tickets');
        }
      },
      error: (err) => {
        this.ticketsLoading.set(false);
        this.ticketsError.set(err?.error?.msg || 'Failed to load tickets');
      },
    });
  }

  openAllTicketsModal(): void {
    this.showAllTicketsModal.set(true);
  }

  closeAllTicketsModal(): void {
    this.showAllTicketsModal.set(false);
  }

  openAllAddonsModal(): void {
    this.showAllAddonsModal.set(true);
  }

  closeAllAddonsModal(): void {
    this.showAllAddonsModal.set(false);
  }

  openAllTrackerModal(): void {
    this.showAllTrackerModal.set(true);
  }

  closeAllTrackerModal(): void {
    this.showAllTrackerModal.set(false);
  }

  openAllMeetingsModal(): void {
    this.showAllMeetingsModal.set(true);
  }

  closeAllMeetingsModal(): void {
    this.showAllMeetingsModal.set(false);
  }

  // ---- Helpers Tickets ----

  ticketStatusLabel(status: string): string {
    switch (status) {
      case 'open':
        return 'Open';
      case 'on_hold':
        return 'On Hold';
      case 'escalated':
        return 'Escalated';
      default:
        return status;
    }
  }

  ticketStatusClass(status: string): string {
    switch (status) {
      case 'open':
        return 'bg-amber-100 text-amber-600';
      case 'on_hold':
        return 'bg-slate-100 text-slate-600';
      case 'escalated':
        return 'bg-rose-100 text-rose-600';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }

  formatTicketDate(createdAt: string): string {
    if (!createdAt) return '-';
    const d = new Date(createdAt);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  // ---- Helpers for Meeting the template ----

  formatMeetingDate(startTime: string): string {
    if (!startTime) return '-';
    const d = new Date(startTime);
    const datePart = d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timePart = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return `${datePart}, ${timePart}`;
  }

  statusLabel(status: number): string {
    switch (status) {
      case 0:
        return 'Scheduled';
      case 1:
        return 'Completed';
      case 2:
        return 'Rescheduled';
      case 3:
        return 'Pending';
      case 4:
        return 'Cancelled';
      case 5:
        return 'Client No-Show';
      case 6:
        return 'Host No-Show';
      default:
        return 'Unknown';
    }
  }

  statusClass(status: number): string {
    switch (status) {
      case 0:
        return 'bg-amber-100 text-amber-600';
      case 1:
        return 'bg-emerald-100 text-emerald-600';
      case 2:
        return 'bg-sky-100 text-sky-600';
      case 3:
        return 'bg-slate-100 text-slate-600';
      case 4:
        return 'bg-rose-100 text-rose-600';
      case 5:
        return 'bg-orange-100 text-orange-600';
      case 6:
        return 'bg-orange-100 text-orange-600';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }

  isJoinDisabled(status: number): boolean {
    return [1, 3, 4, 5, 6].includes(status);
  }

  joinMeeting(link: string, status: number): void {
    if (this.isJoinDisabled(status) || !link) {
      return;
    }
    window.open(link, '_blank');
  }

  // tab_sts === 1 has a green tick, otherwise gray circle
  isModuleComplete(item: TrackerItem): boolean {
    return item.tab_sts === 1;
  }

  goBack(): void {
    this.location.back();
  }
}
