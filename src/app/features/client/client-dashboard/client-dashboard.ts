import { Component, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Clientdashboard } from '../services/client/clientdashboard/clientdashboard';
import { Data as ClientDashboardData } from '../models/client/clientdashboard.model';

@Component({
  selector: 'app-client-dashboard',
  imports: [CommonModule],
  templateUrl: './client-dashboard.html',
  styleUrl: './client-dashboard.css',
})
export class ClientDashboard {
  private clientDashboardApi = inject(Clientdashboard);
  private location = inject(Location);
  private route = inject(ActivatedRoute);

  orgName = '';
  orgId: string | null = null;

  dashboardData = signal<ClientDashboardData | null>(null);
  loading = signal(false);
  errorMsg = signal('');

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.orgName = params.get('orgName') ?? '';
      this.orgId = params.get('orgId');

      if (this.orgId) {
        this.loadDashboard(this.orgId);
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

  goBack(): void {
    this.location.back();
  }
}