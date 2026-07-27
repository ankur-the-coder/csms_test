import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
}

@Component({
  selector: 'app-implementation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './implementation.component.html'
})
export class ImplementationComponent {
  
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
      key: 'payroll',
      label: 'Payroll',
      icon: 'bank',
      features: [
        { mod_id: 41, name: 'Salary Heads' },
        { mod_id: 455, name: 'Payroll Heads' },
        { mod_id: 474, name: 'EPF Settings' },
        { mod_id: 478, name: 'ESIC Settings' },
        { mod_id: 485, name: 'Professional Tax Settings' },
        { mod_id: 509, name: 'Labour Welfare Fund' }
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
    }
  ];

  // Helper Total Features count per organization (22)
  readonly totalFeaturesCount = this.modules.reduce((acc, m) => acc + m.features.length, 0);

  // Clients Seed State Signal
  clients = signal<Client[]>(this.buildSeedClients());

  // UI Filters State
  searchQuery = signal<string>('');
  statusFilter = signal<string>('all'); // all, complete, in_progress, pending
  viewMode = signal<'grid' | 'table'>('table');

  // Drawer / Selected Client State
  selectedClient = signal<Client | null>(null);
  selectedModuleTab = signal<string>('all');

  // Filter Tabs Config
  get filterTabs() {
    return [
      { id: 'all', label: 'All Organisations', count: this.clients().length },
      { id: 'in_progress', label: 'In Progress', count: this.inProgressClientsCount() },
      { id: 'complete', label: 'Completed', count: this.completedClientsCount() },
      { id: 'pending', label: 'Not Started', count: this.pendingClientsCount() }
    ];
  }

  // Filtered Clients Computed
  filteredClients = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const sf = this.statusFilter();

    return this.clients().filter(c => {
      const matchSearch = c.name.toLowerCase().includes(q) || c.org_id.toString().includes(q) || c.cs_lead.toLowerCase().includes(q);
      if (!matchSearch) return false;

      const approvedCount = this.getClientApprovedCount(c);
      if (sf === 'complete') return approvedCount === this.totalFeaturesCount;
      if (sf === 'in_progress') return approvedCount > 0 && approvedCount < this.totalFeaturesCount;
      if (sf === 'pending') return approvedCount === 0;

      return true;
    });
  });

  // Summary Metrics Computations
  totalClients = computed(() => this.clients().length);
  
  completedClientsCount = computed(() => 
    this.clients().filter(c => this.getClientApprovedCount(c) === this.totalFeaturesCount).length
  );

  inProgressClientsCount = computed(() => 
    this.clients().filter(c => {
      const count = this.getClientApprovedCount(c);
      return count > 0 && count < this.totalFeaturesCount;
    }).length
  );

  pendingClientsCount = computed(() => 
    this.clients().filter(c => this.getClientApprovedCount(c) === 0).length
  );

  totalPossibleFeaturesCount = computed(() => this.clients().length * this.totalFeaturesCount);

  totalApprovedFeaturesCount = computed(() => 
    this.clients().reduce((sum, c) => sum + this.getClientApprovedCount(c), 0)
  );

  overallCompletionPercentage = computed(() => {
    const total = this.totalPossibleFeaturesCount();
    if (total === 0) return 0;
    return Math.round((this.totalApprovedFeaturesCount() / total) * 100);
  });

  // Seed Initial Clients
  private buildSeedClients(): Client[] {
    const stamp = (hoursAgo = 0) => {
      const d = new Date(Date.now() - hoursAgo * 3600 * 1000);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    const buildChecklist = (approvedModIds: number[]) => {
      const map: Record<number, FeatureChecklistRow> = {};
      this.modules.forEach(m => m.features.forEach(f => {
        const isApproved = approvedModIds.includes(f.mod_id);
        map[f.mod_id] = {
          approval_status: isApproved ? 1 : 0,
          remark: isApproved ? 'Verified & approved' : '',
          started_at: isApproved ? stamp(24) : null,
          completed_at: isApproved ? stamp(2) : null
        };
      }));
      return map;
    };

    const allModIds = this.modules.flatMap(m => m.features.map(f => f.mod_id));

    return [
      {
        id: 1,
        org_id: 478190,
        name: 'ABC Industries',
        industry: 'Manufacturing',
        onboarding_date: '10 Jan 2026',
        cs_lead: 'Neha Singh',
        health: 'Good',
        checklist: buildChecklist([64, 42, 12, 13, 35, 41, 455, 31, 185])
      },
      {
        id: 2,
        org_id: 480581,
        name: 'XYZ Ltd',
        industry: 'Technology & SaaS',
        onboarding_date: '15 Jan 2026',
        cs_lead: 'Amit Sharma',
        health: 'Neutral',
        checklist: buildChecklist([64, 41, 455, 474])
      },
      {
        id: 3,
        org_id: 480606,
        name: 'PQR Solutions',
        industry: 'Logistics',
        onboarding_date: '20 Jan 2026',
        cs_lead: 'Rahul Verma',
        health: 'Risk',
        checklist: buildChecklist([])
      },
      {
        id: 4,
        org_id: 469812,
        name: 'LMN Group',
        industry: 'Healthcare',
        onboarding_date: '02 Jan 2026',
        cs_lead: 'Priya Patel',
        health: 'Excellent',
        checklist: buildChecklist([64, 42, 185, 186, 31, 193, 12, 13, 14, 32, 41, 455, 474, 478, 485])
      },
      {
        id: 5,
        org_id: 448120,
        name: 'Kestrel Logistics',
        industry: 'Supply Chain',
        onboarding_date: '01 Dec 2025',
        cs_lead: 'Vikram Singh',
        health: 'Excellent',
        checklist: buildChecklist(allModIds)
      },
      {
        id: 6,
        org_id: 492100,
        name: 'Apex Fintech',
        industry: 'Financial Services',
        onboarding_date: '18 Jan 2026',
        cs_lead: 'Ananya Roy',
        health: 'Neutral',
        checklist: buildChecklist([64, 42, 12, 13, 35, 31, 41, 455])
      }
    ];
  }

  // Client Helper Methods
  getClientApprovedCount(client: Client): number {
    if (!client || !client.checklist) return 0;
    return Object.values(client.checklist).filter(row => row.approval_status === 1).length;
  }

  getClientProgressPercent(client: Client): number {
    return Math.round((this.getClientApprovedCount(client) / this.totalFeaturesCount) * 100);
  }

  getModuleApprovedCount(client: Client, mod: Module): number {
    if (!client || !client.checklist) return 0;
    return mod.features.filter(f => client.checklist[f.mod_id]?.approval_status === 1).length;
  }

  isModuleFullyApproved(client: Client, mod: Module): boolean {
    return this.getModuleApprovedCount(client, mod) === mod.features.length;
  }

  isModuleInProgress(client: Client, mod: Module): boolean {
    const count = this.getModuleApprovedCount(client, mod);
    return count > 0 && count < mod.features.length;
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
    this.selectedClient.set({ ...client });
    this.selectedModuleTab.set('all');
  }

  closeClientDetails() {
    this.selectedClient.set(null);
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
