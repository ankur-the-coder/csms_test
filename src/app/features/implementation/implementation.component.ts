import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ImplementationService, ApiClientRow, CardData } from './implementation.service';

export interface Feature {
  mod_id: number;
  name: string;
  description?: string;
}

export interface Module {
  tab_id: number;
  key: string;
  label: string;
  icon: string;
  features: Feature[];
}

export interface FeatureChecklistRow {
  approval_status: number; // 1 = approved, 0 = pending
  remark: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface Client {
  id: number;
  org_id: number;
  name: string;
  industry: string;
  onboarding_date: string;
  cs_lead: string;
  health: string; // Good | Neutral | Risk | Excellent (display only)
  checklist: Record<number, FeatureChecklistRow>;
  overallProgress: {
    approved: number;
    total: number;
    percentage: number;
  };
  apiModules: Record<string, { completed: number; total: number }>;
}

@Component({
  selector: 'app-implementation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './implementation.component.html'
})
export class ImplementationComponent implements OnInit {

  private readonly implService = inject(ImplementationService);

  // Master Modules Data Schema matching implementation_module.jsx
  readonly modules: Module[] = [
    {
      tab_id: 1,
      key: 'employee',
      label: 'Employee',
      icon: 'users',
      features: [{ mod_id: 64, name: 'Onboard Employees' }]
    },
    {
      tab_id: 2,
      key: 'attendance',
      label: 'Attendance',
      icon: 'calendar',
      features: [
        { mod_id: 42, name: 'Shift' },
        { mod_id: 185, name: 'Projects' },
        { mod_id: 186, name: 'Tasks' },
        { mod_id: 187, name: 'Settings of Timesheet' },
        { mod_id: 502, name: 'Regularization Settings' }
      ]
    },
    {
      tab_id: 3,
      key: 'leave',
      label: 'Leave',
      icon: 'leave',
      features: [
        { mod_id: 31, name: 'Leave Type Settings' },
        { mod_id: 193, name: 'Import Leave Balance' }
      ]
    },
    {
      tab_id: 4,
      key: 'salary',
      label: 'Salary',
      icon: 'wallet',
      features: [
        { mod_id: 41, name: 'Salary Heads' }
      ]
    },
    {
      tab_id: 5,
      key: 'organization',
      label: 'Organization',
      icon: 'network',
      features: [
        { mod_id: 12, name: 'Departments' },
        { mod_id: 13, name: 'Designations' },
        { mod_id: 14, name: 'Divisions' },
        { mod_id: 29, name: 'Holidays' },
        { mod_id: 32, name: 'Locations' },
        { mod_id: 35, name: 'Company Details' },
        { mod_id: 54, name: 'Company Policy' },
        { mod_id: 145, name: 'Hierarchy' }
      ]
    },
    {
      tab_id: 6,
      key: 'timesheet',
      label: 'Timesheet',
      icon: 'clock',
      features: [
        { mod_id: 188, name: 'Timesheet Settings' }
      ]
    },
    {
      tab_id: 7,
      key: 'payroll',
      label: 'Payroll',
      icon: 'bank',
      features: [
        { mod_id: 455, name: 'Payroll Heads' },
        { mod_id: 474, name: 'EPF Settings' },
        { mod_id: 478, name: 'ESIC Settings' },
        { mod_id: 485, name: 'Professional Tax Settings' },
        { mod_id: 509, name: 'Labour Welfare Fund' }
      ]
    }
  ];

  // Helper Total Features count per organization
  readonly totalFeaturesCount = this.modules.reduce((acc, m) => acc + m.features.length, 0);

  // Clients Signal — initialized empty, populated via API
  clients = signal<Client[]>([]);

  // Loading & Error State
  isLoading = signal<boolean>(false);
  errorMessage = signal<string>('');

  // Card Data from API
  cardData = signal<CardData>({ totalAccounts: 0, completed: 0, inProgress: 0, notStarted: 0 });

  // UI Filters State
  searchQuery = signal<string>('');
  statusFilter = signal<string>('all'); // all, complete, in_progress, pending
  viewMode = signal<'grid' | 'table'>('table');

  // Drawer / Selected Client State
  selectedClient = signal<Client | null>(null);
  selectedModuleTab = signal<string>('all');
  // Controls the slide/fade transition separately from the mount state so the
  // drawer animates in/out smoothly instead of popping in/out instantly.
  drawerOpen = signal<boolean>(false);
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private openTimer: ReturnType<typeof setTimeout> | null = null;

  // Filter Tabs Config
  get filterTabs() {
    return [
      { id: 'all', label: 'All Organisations', count: this.cardData().totalAccounts },
      { id: 'in_progress', label: 'In Progress', count: this.cardData().inProgress },
      { id: 'complete', label: 'Completed', count: this.cardData().completed },
      { id: 'pending', label: 'Not Started', count: this.cardData().notStarted }
    ];
  }

  // Filtered Clients Computed
  filteredClients = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const sf = this.statusFilter();

    return this.clients().filter(c => {
      const matchSearch = c.name.toLowerCase().includes(q) || c.org_id.toString().includes(q) || c.cs_lead.toLowerCase().includes(q);
      if (!matchSearch) return false;

      if (sf === 'complete') return c.overallProgress.percentage === 100;
      if (sf === 'in_progress') return c.overallProgress.percentage > 0 && c.overallProgress.percentage < 100;
      if (sf === 'pending') return c.overallProgress.percentage === 0;

      return true;
    });
  });

  // Card metrics — driven by API cardData
  totalClients = computed(() => this.cardData().totalAccounts);
  completedClientsCount = computed(() => this.cardData().completed);
  inProgressClientsCount = computed(() => this.cardData().inProgress);
  pendingClientsCount = computed(() => this.cardData().notStarted);

  // Lifecycle — fetch data on init
  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);
    this.errorMessage.set('');

    // Fetch card stats
    this.implService.fetchImpCardData().subscribe({
      next: (data) => this.cardData.set(data),
      error: (err) => console.error('Failed to load card data:', err)
    });

    // Fetch table data
    this.implService.fetchDataTable().subscribe({
      next: (data) => {
        const clients = this.mapApiDataToClients(data);
        this.clients.set(clients);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load implementation data:', err);
        this.errorMessage.set('Failed to load data. Please try again.');
        this.isLoading.set(false);
      }
    });
  }

  // Map API response rows → Client[]
  private mapApiDataToClients(data: ApiClientRow[]): Client[] {
    return data.map((row, index) => {
      const checklist = this.buildChecklistFromApi(row);
      const apiModules: Record<string, { completed: number; total: number }> = {};

      // Store raw API module progress for display in badges
      if (row.modules) {
        Object.entries(row.modules).forEach(([key, val]) => {
          apiModules[key] = { completed: val.completed, total: val.total };
        });
      }

      return {
        id: index + 1,
        org_id: row.orgId,
        name: row.organization,
        industry: '',
        onboarding_date: this.formatDate(row.onboardedDate),
        cs_lead: row.csLead || 'Unassigned',
        health: row.health,
        checklist,
        overallProgress: {
          approved: row.overallProgress?.approved || 0,
          total: row.overallProgress?.total || 0,
          percentage: row.overallProgress?.percentage || 0
        },
        apiModules
      };
    });
  }

  // Build feature-level checklist from API module-level progress
  private buildChecklistFromApi(row: ApiClientRow): Record<number, FeatureChecklistRow> {
    const checklist: Record<number, FeatureChecklistRow> = {};

    this.modules.forEach(mod => {
      const apiMod = row.modules ? (row.modules as any)[mod.key] : null;
      const completedCount = apiMod?.completed || 0;

      mod.features.forEach((feat, idx) => {
        const isApproved = idx < completedCount;
        checklist[feat.mod_id] = {
          approval_status: isApproved ? 1 : 0,
          remark: isApproved ? 'Verified & approved' : '',
          started_at: isApproved ? this.formatDate(row.onboardedDate) : null,
          completed_at: isApproved ? this.formatDate(row.onboardedDate) : null
        };
      });
    });

    return checklist;
  }

  private formatDate(isoDate: string): string {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // Client Helper Methods
  getClientApprovedCount(client: Client): number {
    if (!client || !client.checklist) return 0;
    return Object.values(client.checklist).filter(row => row.approval_status === 1).length;
  }

  getClientProgressPercent(client: Client): number {
    // Use API overallProgress.percentage if available, else compute from checklist
    if (client.overallProgress && client.overallProgress.percentage > 0) {
      return client.overallProgress.percentage;
    }
    if (this.totalFeaturesCount === 0) return 0;
    return Math.round((this.getClientApprovedCount(client) / this.totalFeaturesCount) * 100);
  }

  getModuleApprovedCount(client: Client, mod: Module): number {
    // Use API module data if available
    if (client.apiModules && client.apiModules[mod.key]) {
      return client.apiModules[mod.key].completed;
    }
    if (!client || !client.checklist) return 0;
    return mod.features.filter(f => client.checklist[f.mod_id]?.approval_status === 1).length;
  }

  getModuleTotalCount(client: Client, mod: Module): number {
    // Use API module total if available
    if (client.apiModules && client.apiModules[mod.key]) {
      return client.apiModules[mod.key].total;
    }
    return mod.features.length;
  }

  isModuleFullyApproved(client: Client, mod: Module): boolean {
    const total = this.getModuleTotalCount(client, mod);
    if (total === 0) return false;
    return this.getModuleApprovedCount(client, mod) === total;
  }

  isModuleInProgress(client: Client, mod: Module): boolean {
    const count = this.getModuleApprovedCount(client, mod);
    return count > 0 && count < this.getModuleTotalCount(client, mod);
  }

  isModuleNotStarted(client: Client, mod: Module): boolean {
    return this.getModuleApprovedCount(client, mod) === 0;
  }

  setFilterStatus(status: string) {
    this.statusFilter.set(status);
  }

  // Display-only helpers (UI presentation, no functional/business logic change)
  getInitials(name: string): string {
    if (!name) return '';
    return name.split(' ').map(p => p.charAt(0)).join('').slice(0, 2).toUpperCase();
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

  // Drawer / Interactive Handlers
  openClientDetails(client: Client) {
    if (this.closeTimer) { clearTimeout(this.closeTimer); this.closeTimer = null; }
    this.selectedClient.set({ ...client });
    this.selectedModuleTab.set('all');
    this.drawerOpen.set(false);
    // Let the closed-state markup paint first, then trigger the transition to open.
    this.openTimer = setTimeout(() => this.drawerOpen.set(true), 20);
  }

  closeClientDetails() {
    if (this.openTimer) { clearTimeout(this.openTimer); this.openTimer = null; }
    this.drawerOpen.set(false);
    // Wait for the slide/fade-out transition to finish before unmounting.
    this.closeTimer = setTimeout(() => this.selectedClient.set(null), 300);
  }

  getDisplayModules(): Module[] {
    const tabKey = this.selectedModuleTab();
    if (tabKey === 'all') return this.modules;
    return this.modules.filter(m => m.key === tabKey);
  }

  toggleFeatureStatus(client: Client, modId: number) {
    const currentStatus = client.checklist[modId]?.approval_status || 0;
    const nextStatus = currentStatus === 1 ? 0 : 1;
    const stamp = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

    const updatedChecklist = {
      ...client.checklist,
      [modId]: {
        ...client.checklist[modId],
        approval_status: nextStatus,
        started_at: nextStatus === 1 ? client.checklist[modId]?.started_at || stamp : null,
        completed_at: nextStatus === 1 ? stamp : null
      }
    };

    const updatedClient = { ...client, checklist: updatedChecklist };

    // Update state signals
    this.clients.update(list => list.map(c => c.id === client.id ? updatedClient : c));
    if (this.selectedClient()?.id === client.id) {
      this.selectedClient.set(updatedClient);
    }
  }

  updateRemark(client: Client, modId: number, event: Event) {
    const remark = (event.target as HTMLInputElement).value;
    
    const updatedChecklist = {
      ...client.checklist,
      [modId]: {
        ...client.checklist[modId],
        remark
      }
    };

    const updatedClient = { ...client, checklist: updatedChecklist };

    this.clients.update(list => list.map(c => c.id === client.id ? updatedClient : c));
    if (this.selectedClient()?.id === client.id) {
      this.selectedClient.set(updatedClient);
    }
  }

  markAllApproved(client: Client) {
    const stamp = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    const updatedChecklist = { ...client.checklist };

    this.modules.forEach(m => m.features.forEach(f => {
      updatedChecklist[f.mod_id] = {
        approval_status: 1,
        remark: updatedChecklist[f.mod_id]?.remark || 'Batch approved by CS Manager',
        started_at: updatedChecklist[f.mod_id]?.started_at || stamp,
        completed_at: stamp
      };
    }));

    const updatedClient = { ...client, checklist: updatedChecklist };
    this.clients.update(list => list.map(c => c.id === client.id ? updatedClient : c));
    this.selectedClient.set(updatedClient);
  }
}
