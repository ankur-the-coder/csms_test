import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Clientdashboard } from '../services/client/clientdashboard/clientdashboard';
import { Data as ClientDashboardData } from '../models/client/clientdashboard.model';
import { Clientdashboardmeeting } from '../services/client/clientdashboard/clientdashboardmeeting';
import { Datum as MeetingDatum } from '../models/client/clientdashboardmeeting.model';
import { Clientdashboardaddons } from '../services/client/clientdashboard/clientdashboardaddons';
import { AddonItem } from '../models/client/ClientDashboardAddons.model';
import { Clientdashboardtickets } from '../services/client/clientdashboard/clientdashboardtickets';
import { TicketItem } from '../models/client/clientdashboardtickets';
import { AuthService } from '../../../core/services/auth-service';
import { Utils } from '../../../shared/utils/utils';
import { Clientdashboardusage } from '../services/client/clientdashboard/clientdashboardusage';
import { UsageData } from '../models/client/clientdashboardusage.model';
import { Clientimplementation } from '../services/client/clientdashboard/clientimplementation';
import {ClientImplementationData,ImplementationModule,} from '../models/client/clientimplementation.model';

@Component({
  selector: 'app-client-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './client-dashboard.html',
  styleUrl: './client-dashboard.css',
})
export class ClientDashboard {
  private authService = inject(AuthService);
  private clientDashboardApi = inject(Clientdashboard);
  private clientDashboardMeetingApi = inject(Clientdashboardmeeting);
  private clientDashboardAddonsApi = inject(Clientdashboardaddons);
  private clientDashboardTicketsApi = inject(Clientdashboardtickets);
  private clientDashboardUsageApi = inject(Clientdashboardusage);
  private clientImplementationApi = inject(Clientimplementation);
  private location = inject(Location);
  private route = inject(ActivatedRoute);
  // 👇 UbiDesk base URL - constant
  private readonly UBIDESK_BASE_URL = 'https://ubidesk.ubitechsolutions.com';

  orgName = '';
  orgId: string | null = null;

  dashboardData = signal<ClientDashboardData | null>(null);
  loading = signal(false);
  errorMsg = signal('');

  // ---- Implementation state ----
  implementationData = signal<ClientImplementationData | null>(null);
  implementationLoading = signal(false);
  implementationError = signal('');
  selectedModuleTab = signal<string>('all');
  showAllTrackerDrawer = signal(false);

  implementationModules = computed<ImplementationModule[]>(() => {
    return this.implementationData()?.modules ?? [];
  });

  displayTrackerModules = computed<ImplementationModule[]>(() => {
    const tab = this.selectedModuleTab();
    const modules = this.implementationModules();
    if (tab === 'all') {
      return modules;
    }
    return modules.filter((m) => m.key === tab);
  });

  widgetTrackerModules = computed<ImplementationModule[]>(() => {
    const tab = this.selectedModuleTab();
    const allModules = this.implementationModules();
    const filteredModules = tab === 'all' ? allModules : allModules.filter((m) => m.key === tab);

    if (filteredModules.length === 0) {
      return [];
    }

    if (filteredModules.length === 1) {
      const mod = filteredModules[0];
      return [
        {
          ...mod,
          features: mod.features.slice(0, 2),
        },
      ];
    }

    return filteredModules.slice(0, 2).map((mod) => ({
      ...mod,
      features: mod.features.slice(0, 1),
    }));
  });

  overallImplementationProgress = computed(() => {
    return this.implementationData()?.overallProgress ?? { approved: 0, total: 0, percentage: 0 };
  });

  implementationHealth = computed(() => {
    return this.implementationData()?.health ?? 'Neutral';
  });

  ringPercentage = computed(() => {
    if (this.overallImplementationProgress().total > 0) {
      return this.overallImplementationProgress().percentage;
    }
    return this.dashboardData()?.implementationProgress?.percentage ?? 0;
  });

  ringLabel = computed(() => {
    if (this.overallImplementationProgress().total > 0) {
      return `${this.overallImplementationProgress().approved} of ${this.overallImplementationProgress().total} completed`;
    }
    return this.dashboardData()?.implementationProgress?.label ?? '0 of 0 completed';
  });

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
  ticketFilterDays = signal<number>(28);

  // ---- Usage state ----
  usage = signal<UsageData | null>(null);
  usageLoading = signal(false);
  usageError = signal('');

  //In Widget only top 5 are comes
  topFiveTickets = computed(() => this.tickets().slice(0, 5));

  // "View All" only see if tickets are more than 5
  hasMoreTickets = computed(() => this.tickets().length > 5);

  // In Widget only top 6 are comes
  topSixAddons = computed(() => this.addons().slice(0, 6));

  // "View All" only see if addons are more than 6
  hasMoreAddons = computed(() => this.addons().length > 6);

  // In Widget only top 5 are comes
  topFiveMeetings = computed(() => this.meetings().slice(0, 5));

  // "View All" only see if meetings are more than 5
  hasMoreMeetings = computed(() => this.meetings().length > 5);

  // Widget card mein sirf itne module-tabs dikhane hain, baaki "+N More" mein chale jayenge
  private readonly MAX_VISIBLE_MODULE_TABS = 2;

  visibleModuleTabs = computed(() => {
  return this.implementationModules().slice(0, this.MAX_VISIBLE_MODULE_TABS);
  });

  hiddenModuleTabsCount = computed(() => {
  const total = this.implementationModules().length;
  return total > this.MAX_VISIBLE_MODULE_TABS ? total - this.MAX_VISIBLE_MODULE_TABS : 0;
});

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.orgName = params.get('orgName') ?? '';
      this.orgId = params.get('orgId');

      if (this.orgId) {
        this.loadDashboard(this.orgId);
        this.loadMeetings(this.orgId);
        this.loadAddons(this.orgId);
        this.loadTickets(this.orgId);
        this.loadUsage(this.orgId);
        this.loadImplementation(this.orgId);
      }
    });
  }

  private buildUbiDeskBase(): string {
    const u = Utils.encode5t(this.authService.email());
    const p = Utils.encode5t(this.authService.password());
    return `${this.UBIDESK_BASE_URL}/client/${u}/${p}`;
  }

  /**Particular ticket to se in  UbiDesk link */
  getTicketUrl(ticketId: string | number): string {
    return `${this.buildUbiDeskBase()}/ticket/${ticketId}`;
  }

  getOrgTicketsUrl(): string {
    if (!this.orgId) {
      return '#';
    }
    return `${this.buildUbiDeskBase()}/org/${this.orgId}`;
  }

  openTicketInUbiDesk(ticketId: string | number): void {
    window.open(this.getTicketUrl(ticketId), '_blank');
  }

  openOrgTicketsInUbiDesk(): void {
    window.open(this.getOrgTicketsUrl(), '_blank');
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

  private loadTickets(orgId: string, days: number = this.ticketFilterDays()): void {
    this.ticketsLoading.set(true);
    this.ticketsError.set('');

    this.clientDashboardTicketsApi.getClientDashboard({ orgId, days }).subscribe({
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

  setTicketFilterDays(days: number): void {
    this.ticketFilterDays.set(days);
    if (this.orgId) {
      this.loadTickets(this.orgId, days);
    }
  }

  private loadUsage(orgId: string): void {
    this.usageLoading.set(true);
    this.usageError.set('');

    this.clientDashboardUsageApi.getClientDashboard({ orgId }).subscribe({
      next: (res) => {
        this.usageLoading.set(false);
        if (res?.status) {
          this.usage.set(res.data ?? null);
        } else {
          this.usageError.set(res?.msg || 'Failed to load usage data');
        }
      },
      error: (err) => {
        this.usageLoading.set(false);
        this.usageError.set(err?.error?.msg || 'Failed to load usage data');
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

  private loadImplementation(orgId: string): void {
    this.implementationLoading.set(true);
    this.implementationError.set('');

    this.clientImplementationApi.getOrgImplementation({ orgId }).subscribe({
      next: (res) => {
        this.implementationLoading.set(false);
        if (res?.status && res?.data) {
          this.implementationData.set(res.data);
        } else {
          this.implementationError.set(res?.msg || 'Failed to load implementation data');
        }
      },
      error: (err) => {
        this.implementationLoading.set(false);
        this.implementationError.set(err?.error?.msg || 'Failed to load implementation data');
      },
    });
  }

  openAllTrackerDrawer(): void {
    this.showAllTrackerDrawer.set(true);
  }

  closeAllTrackerDrawer(): void {
    this.showAllTrackerDrawer.set(false);
  }

  selectModuleTab(tabKey: string): void {
    this.selectedModuleTab.set(tabKey);
  }

  formatDate(isoDate: string | null | undefined): string {
    if (!isoDate) return '-';
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return String(isoDate);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  getHealthBadgeClasses(health: string): string {
    switch (health) {
      case 'Good':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Excellent':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'Neutral':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Risk':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  }

  getInitials(name: string): string {
    if (!name) return 'MP';
    return name
      .split(' ')
      .map((p) => p.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  goBack(): void {
    this.location.back();
  }
}
