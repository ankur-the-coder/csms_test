import { Component, signal, computed, OnInit, inject, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ImplementationService} from './implementation.service';
import { DataTable } from '../../shared/components/Data-table/data-table';
import { SmartTableConfig, RequestContext } from '../../shared/components/Data-table/data-table.types';
import { Implementation, Datum, CardData, DataTablePayload } from './implentation.model';

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
  health: string;
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
  imports: [CommonModule, FormsModule, DataTable],
  templateUrl: './implementation.component.html'
})
export class ImplementationComponent implements OnInit {

  @ViewChild('progressCell') progressCellTemplate!: TemplateRef<any>;
  @ViewChild('moduleCell')   moduleCellTemplate!: TemplateRef<any>;
  @ViewChild('healthCell')   healthCellTemplate!: TemplateRef<any>;
  @ViewChild('nameCell')     nameCellTemplate!: TemplateRef<any>;

  private readonly implService = inject(ImplementationService);

  readonly modules: Module[] = [
    { tab_id: 1, key: 'employee',     label: 'Employee',     icon: 'users',   features: [{ mod_id: 64, name: 'Onboard Employees' }] },
    { tab_id: 2, key: 'attendance',   label: 'Attendance',   icon: 'calendar',features: [
        { mod_id: 42,  name: 'Shift' },
        { mod_id: 185, name: 'Projects' },
        { mod_id: 186, name: 'Tasks' },
        { mod_id: 187, name: 'Settings of Timesheet' },
        { mod_id: 502, name: 'Regularization Settings' }
      ]
    },
    { tab_id: 3, key: 'leave',        label: 'Leave',        icon: 'leave',   features: [
        { mod_id: 31,  name: 'Leave Type Settings' },
        { mod_id: 193, name: 'Import Leave Balance' }
      ]
    },
    { tab_id: 4, key: 'salary',       label: 'Salary',       icon: 'wallet',  features: [{ mod_id: 41, name: 'Salary Heads' }] },
    { tab_id: 5, key: 'organization', label: 'Organization', icon: 'network', features: [
        { mod_id: 12,  name: 'Departments' },
        { mod_id: 13,  name: 'Designations' },
        { mod_id: 14,  name: 'Divisions' },
        { mod_id: 29,  name: 'Holidays' },
        { mod_id: 32,  name: 'Locations' },
        { mod_id: 35,  name: 'Company Details' },
        { mod_id: 54,  name: 'Company Policy' },
        { mod_id: 145, name: 'Hierarchy' }
      ]
    },
    { tab_id: 6, key: 'timesheet',    label: 'Timesheet',    icon: 'clock',   features: [{ mod_id: 188, name: 'Timesheet Settings' }] },
    { tab_id: 7, key: 'payroll',      label: 'Payroll',      icon: 'bank',    features: [
        { mod_id: 455, name: 'Payroll Heads' },
        { mod_id: 474, name: 'EPF Settings' },
        { mod_id: 478, name: 'ESIC Settings' },
        { mod_id: 485, name: 'Professional Tax Settings' },
        { mod_id: 509, name: 'Labour Welfare Fund' }
      ]
    }
  ];

  readonly totalFeaturesCount = this.modules.reduce((acc, m) => acc + m.features.length, 0);

  clients    = signal<Client[]>([]);
  isLoading  = signal<boolean>(false);
  errorMessage = signal<string>('');
  cardData   = signal<CardData>({ totalAccounts: 0, completed: 0, inProgress: 0, notStarted: 0 });

  // UI state
  searchQuery  = signal<string>('');
  statusFilter = signal<string>('all');
  viewMode     = signal<'grid' | 'table'>('table');

  // Drawer
  selectedClient    = signal<Client | null>(null);
  selectedModuleTab = signal<string>('all');
  drawerOpen        = signal<boolean>(false);
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private openTimer:  ReturnType<typeof setTimeout> | null = null;

  // Filter tabs
  get filterTabs() {
    return [
      { id: 'all',         label: 'All Organisations', count: this.cardData().totalAccounts },
      { id: 'in_progress', label: 'In Progress',       count: this.cardData().inProgress },
      { id: 'complete',    label: 'Completed',         count: this.cardData().completed },
      { id: 'pending',     label: 'Not Started',       count: this.cardData().notStarted }
    ];
  }

  filteredClients = computed(() => {
    const q  = this.searchQuery().toLowerCase().trim();
    const sf = this.statusFilter();
    return this.clients().filter(c => {
      const match = c.name.toLowerCase().includes(q) ||
                    c.org_id.toString().includes(q) ||
                    c.cs_lead.toLowerCase().includes(q);
      if (!match) return false;
      if (sf === 'complete')    return c.overallProgress.percentage === 100;
      if (sf === 'in_progress') return c.overallProgress.percentage > 0 && c.overallProgress.percentage < 100;
      if (sf === 'pending')     return c.overallProgress.percentage === 0;
      return true;
    });
  });

  // Card computed
  totalClients          = computed(() => this.cardData().totalAccounts);
  completedClientsCount = computed(() => this.cardData().completed);
  inProgressClientsCount = computed(() => this.cardData().inProgress);
  pendingClientsCount   = computed(() => this.cardData().notStarted);

  // ── Filter option sources for the DataTable's built-in filter modal ───────
  // 'csLead' options come from the data we already loaded — no extra endpoint
  // needed. Recomputes automatically whenever `clients()` changes (e.g. after
  // a refresh or a new page of data arrives).
  csLeadFilterOptions = computed(() => {
    const leads = new Set(
      this.clients()
        .map(c => c.cs_lead)
        .filter((v): v is string => !!v)
    );
    return Array.from(leads)
      .sort((a, b) => a.localeCompare(b))
      .map(label => ({ label, value: label }));
  });

  // ── DataTable config ──────────────────────────────────────────────────────
  private readonly tableEndpoint = 'http://127.0.0.1:5000/imp/fetchDataTable';

  tableConfig = computed<SmartTableConfig<Client>>(() => {
    // Reading statusFilter here makes tableConfig reactive to tab changes.
    // When the tab changes → new buildRequest body → new fetchKey → re-fetch.
    const statusFilter = this.statusFilter();

    return {
      columns: [
        { key: 'org_id',           label: 'Org ID',       sortable: true, type: 'number' },
        { key: 'name',             label: 'Organisation', sortable: true, type: 'avatar' },
        { key: 'cs_lead',          label: 'CS Lead',      sortable: true },
        {
          key: 'health', label: 'Health', type: 'badge', align: 'center',
          badgeMap: {
            'Good':      { label: 'Good' },
            'Excellent': { label: 'Excellent' },
            'Neutral':   { label: 'Neutral' },
            'Risk':      { label: 'Risk' },
          }
        },
        { key: 'onboarding_date',  label: 'Onboarded', sortable: true },
        { key: 'overallProgress',  label: 'Progress',  type: 'template', align: 'center' },
        { key: 'modules',          label: 'Modules',   type: 'template', align: 'center' },

      ],

      // ── Server-side config ────────────────────────────────────────────────
      apiConfig: {
        endpoint:  this.tableEndpoint,
        dataPath:  'data',        // res.data
        totalPath: 'meta.total',  // res.meta.total

        /**
         * Builds the POST body in the exact format the API expects:
         * { start, length, search, sorting: "<JSON>", filter: "<JSON>" }
         */
        buildRequest: (ctx: RequestContext) => {
          // Merge the active status-filter tab AND the table's own filter
          // modal selections (csLead, health, ...) into the filter object.
          const filterObj: Record<string, any> = { ...ctx.filters };
          if (statusFilter !== 'all') filterObj['status'] = statusFilter;

          const body: DataTablePayload = {
            start:   ctx.page * ctx.pageSize,          // offset
            length:  ctx.pageSize,                     // page size
            search:  ctx.search ?? '',
            sorting: JSON.stringify({
              require: 0,
              col: ctx.sortKey ?? 'orgId',
              dir: ctx.sortDir ?? 'desc',
            }),
            filter: JSON.stringify(filterObj),
            tabSts: statusFilter === 'complete' ? 1 : statusFilter === 'in_progress' ? 2 : statusFilter === 'pending' ? 3 : 0
          };

          return { method: 'POST' as const, body };
        },

        /** Maps each raw API row to the Client shape the rest of the UI uses. */
        transformRow: (row: any) => this.mapApiRowToClient(row as Datum),
      },

      rowIdKey:        'id',
      showSearch:      true,
      showPagination:  true,
      defaultPageSize: 10,
      // selectable:true,
      pageSizeOptions: [10, 25, 50,100,500],
      exportFileName:  'implementation-progress',
      emptyMessage:    'No implementation records found.',
      clickable:       false,
      toolbarButtons: [
        { id: 'date', type: 'datePicker', label: 'Date' },
        { id: 'filter',  type: 'filter',  label: 'Filter' },
        { id: 'export',  type: 'export',  label: 'Export' },
        { id: 'refresh', type: 'refresh' },
        { id: 'columns', type: 'columnPicker', label: 'Columns' },
        
      ],
      customRowActions: [
        {
          id:      'view',
          icon:    'view',
          label:   'View Details',
          tooltip: 'Open detail drawer',
          onClick: (row: Client) => this.openClientDetails(row),
        }
      ],

      // 'health' is resolved via filterNames + DataTableService (static enum).
      // 'csLead' is defined here directly since its options come from data
      // already loaded on the client (not a separate API call).
      filters: [
        { key: 'csLead', label: 'CS Lead', options: this.csLeadFilterOptions() },
      ],
    };
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit() { this.loadData(); }

  loadData() {
    this.isLoading.set(true);
    this.errorMessage.set('');

    // Card data (always fetched separately)
    this.implService.fetchImpCardData().subscribe({
      next: (data) => this.cardData.set(data),
      error: (err) => console.error('Card data error:', err)
    });

    const payload: DataTablePayload = {
      start: 0,
      length: 100,
      search: '',
      sorting: JSON.stringify({ require: 0, col: 'orgId', dir: 'desc' }),
      filter: JSON.stringify({}),
      tabSts: 0
    };

    this.implService.fetchDataTable(payload).subscribe({
      next: (res: Implementation) => {
        this.clients.set(this.mapApiDataToClients(res.data ?? []));
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Grid data error:', err);
        this.errorMessage.set('Failed to load data. Please try again.');
        this.isLoading.set(false);
      }
    });
  }

  private mapApiRowToClient(row: Datum): Client {
    const checklist  = this.buildChecklistFromApi(row);
    const apiModules: Record<string, { completed: number; total: number }> = {};
    if (row.modules) {
      Object.entries(row.modules).forEach(([key, val]) => {
        const m = val as { completed: number; total: number };
        apiModules[key] = { completed: m?.completed ?? 0, total: m?.total ?? 0 };
      });
    }
    return {
      id:              row.orgId,
      org_id:          row.orgId,
      name:            row.organization,
      industry:        '',
      onboarding_date: this.formatDate(row.onboardedDate ? row.onboardedDate.toString() : ''),
      cs_lead:         row.csLead || 'Unassigned',
      health:          row.health,
      checklist,
      overallProgress: {
        approved:   row.overallProgress?.approved   || 0,
        total:      row.overallProgress?.total      || 0,
        percentage: row.overallProgress?.percentage || 0,
      },
      apiModules,
    };
  }

  private mapApiDataToClients(data: Datum[]): Client[] {
    return data.map(row => this.mapApiRowToClient(row));
  }

  private buildChecklistFromApi(row: Datum): Record<number, FeatureChecklistRow> {
    const checklist: Record<number, FeatureChecklistRow> = {};
    this.modules.forEach(mod => {
      const apiMod = row.modules ? (row.modules as any)[mod.key] : null;
      const completedCount = apiMod?.completed || 0;
      mod.features.forEach((feat, idx) => {
        const isApproved = idx < completedCount;
        checklist[feat.mod_id] = {
          approval_status: isApproved ? 1 : 0,
          remark: isApproved ? 'Verified & approved' : '',
          started_at:   isApproved ? this.formatDate(row.onboardedDate ? row.onboardedDate.toString() : '') : null,
          completed_at: isApproved ? this.formatDate(row.onboardedDate ? row.onboardedDate.toString() : '') : null
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

  // ── Client helpers ────────────────────────────────────────────────────────
  getClientApprovedCount(client: Client): number {
    if (!client?.checklist) return 0;
    return Object.values(client.checklist).filter(r => r.approval_status === 1).length;
  }

  getClientProgressPercent(client: Client): number {
    if (client.overallProgress?.percentage > 0) return client.overallProgress.percentage;
    if (this.totalFeaturesCount === 0) return 0;
    return Math.round((this.getClientApprovedCount(client) / this.totalFeaturesCount) * 100);
  }

  getModuleApprovedCount(client: Client, mod: Module): number {
    if (client.apiModules?.[mod.key]) return client.apiModules[mod.key].completed;
    if (!client?.checklist) return 0;
    return mod.features.filter(f => client.checklist[f.mod_id]?.approval_status === 1).length;
  }

  getModuleTotalCount(client: Client, mod: Module): number {
    if (client.apiModules?.[mod.key]) return client.apiModules[mod.key].total;
    return mod.features.length;
  }

  isModuleFullyApproved(client: Client, mod: Module): boolean {
    const total = this.getModuleTotalCount(client, mod);
    return total > 0 && this.getModuleApprovedCount(client, mod) === total;
  }
  isModuleInProgress(client: Client, mod: Module): boolean {
    const count = this.getModuleApprovedCount(client, mod);
    return count > 0 && count < this.getModuleTotalCount(client, mod);
  }
  isModuleNotStarted(client: Client, mod: Module): boolean {
    return this.getModuleApprovedCount(client, mod) === 0;
  }

  setFilterStatus(status: string) { this.statusFilter.set(status); }

  getInitials(name: string): string {
    if (!name) return '';
    return name.split(' ').map(p => p.charAt(0)).join('').slice(0, 2).toUpperCase();
  }

  getHealthBadgeClasses(health: string): string {
    switch (health) {
      case 'Good':      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Excellent': return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'Neutral':   return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Risk':      return 'bg-rose-50 text-rose-700 border-rose-200';
      default:          return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  }

  getProgressColor(pct: number): string {
    if (pct === 100) return 'var(--brand-500)';
    if (pct >= 50)   return 'var(--brand-400)';
    if (pct > 0)     return '#f59e0b';
    return '#e2e8f0';
  }

  // ── Drawer ────────────────────────────────────────────────────────────────
  openClientDetails(client: Client) {
    if (this.closeTimer) { clearTimeout(this.closeTimer); this.closeTimer = null; }
    this.selectedClient.set({ ...client });
    this.selectedModuleTab.set('all');
    this.drawerOpen.set(false);
    this.openTimer = setTimeout(() => this.drawerOpen.set(true), 20);
  }

  closeClientDetails() {
    if (this.openTimer) { clearTimeout(this.openTimer); this.openTimer = null; }
    this.drawerOpen.set(false);
    this.closeTimer = setTimeout(() => this.selectedClient.set(null), 300);
  }

  getDisplayModules(): Module[] {
    const tabKey = this.selectedModuleTab();
    if (tabKey === 'all') return this.modules;
    return this.modules.filter(m => m.key === tabKey);
  }

  toggleFeatureStatus(client: Client, modId: number) {
    const current = client.checklist[modId]?.approval_status || 0;
    const next    = current === 1 ? 0 : 1;
    const stamp   = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    const updatedChecklist = {
      ...client.checklist,
      [modId]: {
        ...client.checklist[modId],
        approval_status: next,
        started_at:   next === 1 ? client.checklist[modId]?.started_at || stamp : null,
        completed_at: next === 1 ? stamp : null
      }
    };
    const updated = { ...client, checklist: updatedChecklist };
    this.clients.update(list => list.map(c => c.id === client.id ? updated : c));
    if (this.selectedClient()?.id === client.id) this.selectedClient.set(updated);
  }

  updateRemark(client: Client, modId: number, event: Event) {
    const remark = (event.target as HTMLInputElement).value;
    const updatedChecklist = { ...client.checklist, [modId]: { ...client.checklist[modId], remark } };
    const updated = { ...client, checklist: updatedChecklist };
    this.clients.update(list => list.map(c => c.id === client.id ? updated : c));
    if (this.selectedClient()?.id === client.id) this.selectedClient.set(updated);
  }

  markAllApproved(client: Client) {
    const stamp = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    const updatedChecklist = { ...client.checklist };
    this.modules.forEach(m => m.features.forEach(f => {
      updatedChecklist[f.mod_id] = {
        approval_status: 1,
        remark: updatedChecklist[f.mod_id]?.remark || 'Batch approved by CS Manager',
        started_at:   updatedChecklist[f.mod_id]?.started_at || stamp,
        completed_at: stamp
      };
    }));
    const updated = { ...client, checklist: updatedChecklist };
    this.clients.update(list => list.map(c => c.id === client.id ? updated : c));
    this.selectedClient.set(updated);
  }
}