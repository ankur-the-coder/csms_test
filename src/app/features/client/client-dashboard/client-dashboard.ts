import { Component, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Clientdashboard } from '../services/client/clientdashboard/clientdashboard';
import { Data as ClientDashboardData } from '../models/client/clientdashboard.model';
import { Clientdashboardmeeting } from '../services/client/clientdashboard/clientdashboardmeeting';
import { Datum as MeetingDatum } from '../models/client/clientdashboardmeeting.model';

@Component({
  selector: 'app-client-dashboard',
  imports: [CommonModule],
  templateUrl: './client-dashboard.html',
  styleUrl: './client-dashboard.css',
})
export class ClientDashboard {
  private clientDashboardApi = inject(Clientdashboard);
  private clientDashboardMeetingApi = inject(Clientdashboardmeeting);
  private location = inject(Location);
  private route = inject(ActivatedRoute);

  orgName = '';
  orgId: string | null = null;

  dashboardData = signal<ClientDashboardData | null>(null);
  loading = signal(false);
  errorMsg = signal('');

  // ---- Meetings state ----
  meetings = signal<MeetingDatum[]>([]);
  meetingsLoading = signal(false);
  meetingsError = signal('');

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.orgName = params.get('orgName') ?? '';
      this.orgId = params.get('orgId');

      if (this.orgId) {
        this.loadDashboard(this.orgId);
        this.loadMeetings(this.orgId);
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

  // ---- Helpers for the template ----

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

  goBack(): void {
    this.location.back();
  }
}
