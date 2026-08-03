import { Component, signal, computed, OnInit, inject, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ImplementationService} from './implementation.service';
import { DataTable } from '../../shared/components/Data-table/data-table';
import { SmartTableConfig, RequestContext } from '../../shared/components/Data-table/data-table.types';
import { Implementation, Datum, CardData, DataTablePayload } from './implentation.model';
import { CustomColumnDirective } from '../../shared/components/Data-table/custom-column.directive';

export interface Feature {
  mod_id: number;
  name: string;
  description?: string;
}

export interface Module {
  tab_id: number;
  key: string;
  label: string;
  icon?: string;
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
  support_owner: string;
  country: string;
  health: string;
  checklist: Record<number, FeatureChecklistRow>;
  overallProgress: {
    approved: number;
    total: number;
    percentage: number;
  };
  modules: Module[];
  apiModules: Record<string, { completed: number; total: number }>;
}

@Component({
  selector: 'app-implementation',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTable, CustomColumnDirective],
  templateUrl: './implementation.component.html'
})
export class ImplementationComponent implements OnInit {

  @ViewChild('progressCell') progressCellTemplate!: TemplateRef<any>;
  @ViewChild('moduleCell')   moduleCellTemplate!: TemplateRef<any>;
  @ViewChild('healthCell')   healthCellTemplate!: TemplateRef<any>;
  @ViewChild('nameCell')     nameCellTemplate!: TemplateRef<any>;

  private readonly implService = inject(ImplementationService);

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
      // { id: 'pending',     label: 'Not Started',       count: this.cardData().notStarted }
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

      const totalApproved = c.overallProgress?.approved ?? this.getClientApprovedCount(c);
      const totalFeatures = c.overallProgress?.total ?? this.getClientTotalFeaturesCount(c);
      const percentage    = c.overallProgress?.percentage ?? (totalFeatures > 0 ? Math.round((totalApproved / totalFeatures) * 100) : 0);

      const isCompleted  = percentage === 100 || (totalFeatures > 0 && totalApproved === totalFeatures);
      const isNotStarted = percentage === 0 || totalApproved === 0;
      const isInProgress = !isCompleted && !isNotStarted;

      if (sf === 'complete')    return isCompleted;
      if (sf === 'in_progress') return isInProgress;
      // if (sf === 'pending')     return isNotStarted;
      return true;
    });
  });

  // Card computed
  totalClients          = computed(() => this.cardData().totalAccounts);
  completedClientsCount = computed(() => this.cardData().completed);
  inProgressClientsCount = computed(() => this.cardData().inProgress);
  // pendingClientsCount   = computed(() => this.cardData().notStarted);

 

  // ── DataTable config ──────────────────────────────────────────────────────
  private readonly tableEndpoint = 'http://127.0.0.1:5000/imp/fetchDataTable';

  tableConfig = computed<SmartTableConfig<Client>>(() => {
    const statusFilter = this.statusFilter();

    return {
      columns: [
        { key: 'name',             label: 'Organisation',   sortable: true },
        { key: 'cs_lead',          label: 'Lead Owner',        sortable: false },
        { key: 'support_owner',    label: 'Support Owner',  sortable: false },
        { key: 'country',          label: 'Country',        sortable: false },
        {
          key: 'health', label: 'Health', type: 'badge', align: 'center',
          badgeMap: {
            'Good':      { label: 'Good' },
            'Excellent': { label: 'Excellent' },
            'Neutral':   { label: 'Neutral' },
            'Risk':      { label: 'Risk' },
          }
        },
        
        { key: 'onboarding_date',  label: 'Onboarded',   sortable: false },
        { key: 'overallProgress',  label: 'Progress',    align: 'center', tooltip: 'Overall implementation progress' },
        { key: 'modules',          label: 'Modules',     align: 'center', tooltip: 'Module-wise completion status' },
      ],

      apiConfig: {
        endpoint:  this.tableEndpoint,
        dataPath:  'data',
        totalPath: 'meta.total',

        buildRequest: (ctx: RequestContext) => {
          const filterObj: Record<string, any> = { ...ctx.filters };

          const today = this.getTodayDateString();
          const fromDate = ctx.dateFrom ? ctx.dateFrom : today;
          const toDate = ctx.dateTo ? ctx.dateTo : today;

          const sortColMap: Record<string, string> = {
            'name': 'orgName',
            'cs_lead': 'csLead',
            'support_owner': 'suppOwner',
            'country': 'country',
            'health': 'health',
            'onboarding_date': 'onboardedDate',
            'orgId': 'orgId'
          };
          const sortCol = ctx.sortKey ? (sortColMap[ctx.sortKey] ?? ctx.sortKey) : 'orgName';

          const body: DataTablePayload = {
            start:   ctx.page * ctx.pageSize,
            length:  ctx.pageSize,
            search:  ctx.search ?? '',
            sorting: JSON.stringify({
              require: 0,
              col: sortCol,
              dir: ctx.sortDir ?? 'desc',
            }),
            filter: JSON.stringify(filterObj),
            tabSts: statusFilter === 'complete' ? 1 : statusFilter === 'in_progress' ? 2 : statusFilter === 'pending' ? 3 : 0,
            fromDate: fromDate,
            toDate: toDate
          };

          return { method: 'POST' as const, body };
        },

        transformRow: (row: any): Client | null => {
          const client = this.mapApiRowToClient(row as Datum);
          const sf = statusFilter;
          if (sf === 'all') return client;

          const totalApproved = client.overallProgress?.approved ?? this.getClientApprovedCount(client);
          const totalFeatures = client.overallProgress?.total ?? this.getClientTotalFeaturesCount(client);
          const percentage    = client.overallProgress?.percentage ?? (totalFeatures > 0 ? Math.round((totalApproved / totalFeatures) * 100) : 0);

          const isCompleted  = percentage === 100 || (totalFeatures > 0 && totalApproved === totalFeatures);
          const isNotStarted = percentage === 0 || totalApproved === 0;
          const isInProgress = !isCompleted && !isNotStarted;

          if (sf === 'complete' && !isCompleted) return null;
          if (sf === 'in_progress' && !isInProgress) return null;
          if (sf === 'pending' && !isNotStarted) return null;

          return client;
        },
      },

      rowIdKey:        'id',
      showSearch:      true,
      showPagination:  true,
      defaultPageSize: 10,
      pageSizeOptions: [10, 25, 50, 100, 500],
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

      
    };
  });

  private getTodayDateString(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

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
      length: 10,
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
    const modules: Module[] = [];
    const checklist: Record<number, FeatureChecklistRow> = {};
    const apiModules: Record<string, { completed: number; total: number }> = {};

    if (row.modules && typeof row.modules === 'object') {
      const moduleEntries = Object.entries(row.modules);
      moduleEntries.sort(([, a], [, b]) => (a?.tabOrder ?? 0) - (b?.tabOrder ?? 0));

      moduleEntries.forEach(([key, modData]) => {
        const featuresList: Feature[] = [];
        let completedCount = 0;
        const totalCount = Array.isArray(modData?.features) ? modData.features.length : 0;

        if (Array.isArray(modData?.features)) {
          modData.features.forEach((feat) => {
            featuresList.push({
              mod_id: feat.mod_id,
              name: feat.name
            });

            if (feat.approval_status === 1) {
              completedCount++;
            }

            checklist[feat.mod_id] = {
              approval_status: feat.approval_status ?? 0,
              remark: feat.remark ?? '',
              started_at: feat.started_at ? this.formatDate(feat.started_at.toString()) : null,
              completed_at: feat.completed_at ? this.formatDate(feat.completed_at.toString()) : null
            };
          });
        }

        modules.push({
          tab_id: modData?.tabOrder ?? (modules.length + 1),
          key: key,
          label: modData?.label || key,
          features: featuresList
        });

        apiModules[key] = { completed: completedCount, total: totalCount };
      });
    }

    return {
      id:              row.orgId,
      org_id:          row.orgId,
      name:            row.organization,
      industry:        '',
      onboarding_date: this.formatDate(row.onboardedDate ? row.onboardedDate.toString() : ''),
      cs_lead:         row.csLead         || '-',
      support_owner:   row.supportOwner   || '—',
      country:         row.country        || '—',
      health:          row.health,
      checklist,
      overallProgress: {
        approved:   row.overallProgress?.approved   || 0,
        total:      row.overallProgress?.total      || 0,
        percentage: row.overallProgress?.percentage || 0,
      },
      modules,
      apiModules,
    };
  }

  private mapApiDataToClients(data: Datum[]): Client[] {
    return data.map(row => this.mapApiRowToClient(row));
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

  getClientTotalFeaturesCount(client: Client): number {
    if (client?.overallProgress?.total) return client.overallProgress.total;
    if (!client?.modules) return 0;
    return client.modules.reduce((acc, m) => acc + m.features.length, 0);
  }

  getClientProgressPercent(client: Client): number {
    if (client?.overallProgress?.percentage !== undefined) return client.overallProgress.percentage;
    const total = this.getClientTotalFeaturesCount(client);
    if (total === 0) return 0;
    return Math.round((this.getClientApprovedCount(client) / total) * 100);
  }

  getModuleApprovedCount(client: Client, mod: Module): number {
    if (client?.apiModules?.[mod.key]) return client.apiModules[mod.key].completed;
    if (!client?.checklist) return 0;
    return mod.features.filter(f => client.checklist[f.mod_id]?.approval_status === 1).length;
  }

  getModuleTotalCount(client: Client, mod: Module): number {
    if (client?.apiModules?.[mod.key]) return client.apiModules[mod.key].total;
    return mod.features?.length ?? 0;
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

  getClientModules(client: Client | null): Module[] {
    if (!client?.modules) return [];
    return client.modules.filter(mod => this.getModuleTotalCount(client, mod) > 0);
  }

  getDisplayModules(): Module[] {
    const clientModules = this.getClientModules(this.selectedClient());
    const tabKey = this.selectedModuleTab();
    if (tabKey === 'all') return clientModules;
    return clientModules.filter(m => m.key === tabKey);
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

    const updatedApiModules: Record<string, { completed: number; total: number }> = {};
    let totalApproved = 0;
    let totalFeatures = 0;

    (client.modules || []).forEach(mod => {
      const total = mod.features.length;
      const completed = mod.features.filter(f => {
        const status = f.mod_id === modId ? next : (updatedChecklist[f.mod_id]?.approval_status || 0);
        return status === 1;
      }).length;

      updatedApiModules[mod.key] = { completed, total };
      totalApproved += completed;
      totalFeatures += total;
    });

    const percentage = totalFeatures > 0 ? Math.round((totalApproved / totalFeatures) * 100) : 0;

    const updated: Client = {
      ...client,
      checklist: updatedChecklist,
      apiModules: updatedApiModules,
      overallProgress: {
        approved: totalApproved,
        total: totalFeatures,
        percentage
      }
    };

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
    const updatedApiModules: Record<string, { completed: number; total: number }> = {};
    let totalFeatures = 0;

    (client.modules || []).forEach(m => {
      m.features.forEach(f => {
        updatedChecklist[f.mod_id] = {
          approval_status: 1,
          remark: updatedChecklist[f.mod_id]?.remark || 'Batch approved by CS Manager',
          started_at:   updatedChecklist[f.mod_id]?.started_at || stamp,
          completed_at: stamp
        };
      });
      const total = m.features.length;
      updatedApiModules[m.key] = { completed: total, total };
      totalFeatures += total;
    });

    const updated: Client = {
      ...client,
      checklist: updatedChecklist,
      apiModules: updatedApiModules,
      overallProgress: {
        approved: totalFeatures,
        total: totalFeatures,
        percentage: 100
      }
    };
    this.clients.update(list => list.map(c => c.id === client.id ? updated : c));
    this.selectedClient.set(updated);
  }
}