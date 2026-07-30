import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ImplementationService } from './implementation.service';
import {
  Datum,
  Modules,
  CardData,
  DataTablePayload
} from './implentation.model';
import { DataTable } from '../../shared/components/Data-table/data-table';
import { CustomColumnDirective } from '../../shared/components/Data-table/custom-column.directive';
import { SmartTableConfig, SmartColumn } from '../../shared/components/Data-table/data-table.types';

type ModuleKey = keyof Modules;

// Module keys available in the API response
const MODULE_KEYS: ModuleKey[] = [
  'employee', 'attendance', 'leave', 'salary', 'organization', 'timesheet', 'payroll'
];

@Component({
  selector: 'app-implementation',
  standalone: true,
  imports: [FormsModule, DatePipe, DataTable, CustomColumnDirective],
  templateUrl: './implementation.component.html'
})
export class ImplementationComponent {
  private readonly implementationService = inject(ImplementationService);
  readonly moduleKeys: ModuleKey[] = MODULE_KEYS;


  getDisplayModuleKeys(): ModuleKey[] {
    const tab = this.selectedModuleTab();
    if (tab === 'all') return MODULE_KEYS;
    const key = MODULE_KEYS.find(k => k === tab);
    return key ? [key] : MODULE_KEYS;
  }

 
  cardData = signal<CardData | null>(null);
  cardLoading = signal<boolean>(false);
  cardError = signal<string | null>(null);
  clients = signal<Datum[]>([]);
  tableLoading = signal<boolean>(false);
  tableError = signal<string | null>(null);
  searchQuery = signal<string>('');
  statusFilter = signal<string>('all');
  viewMode = signal<'grid' | 'table'>('table');
  selectedClient = signal<Datum | null>(null);
  drawerOpen = signal<boolean>(false);
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private openTimer: ReturnType<typeof setTimeout> | null = null;
  selectedModuleTab = signal<string>('all');


  clientsResource = {
    reload: () => this.retryAll()
  };

  constructor() {
    this.loadCardData();
    this.loadClients();
  }

 isLoading = computed(() => this.cardLoading() || this.tableLoading());
 loadError = computed(() => this.cardError() || this.tableError());

 
  loadCardData(): void {
    this.cardLoading.set(true);
    this.cardError.set(null);
    this.implementationService.fetchImpCardData().subscribe({
      next: data => {
        this.cardData.set(data);
        this.cardLoading.set(false);
      },
      error: () => {
        this.cardError.set("Couldn't load summary card data.");
        this.cardLoading.set(false);
      }
    });
  }


  private readonly apiBaseUrl = 'http://127.0.0.1:5000/imp';

  tableColumns: SmartColumn<Datum>[] = [
    { key: 'organization', label: 'Organisation', sortable: true, type: 'template' },
    { key: 'orgId',        label: 'Org ID & Health', sortable: false, type: 'template' },
    { key: 'csLead',       label: 'CS Lead', sortable: false, type: 'template' },
    { key: 'overallProgress', label: 'Overall Progress', sortable: false, type: 'template' },
    { key: 'modules',     label: 'Active Modules', type: 'template' },
    { key: 'actions',     label: 'Actions', align: 'right', type: 'template' }
  ];

  tableConfig = computed<SmartTableConfig<Datum>>(() => {
    const sf = this.statusFilter();
    const q  = this.searchQuery();

    return {
      columns: this.tableColumns,
      rowIdKey: 'orgId' as any,
      apiConfig: {
        endpoint: `${this.apiBaseUrl}/fetchDataTable`,
        dataPath: 'data',
        totalPath: 'meta.total',
        buildRequest: (ctx) => {
          const payload: DataTablePayload = {
            start: ctx.page * ctx.pageSize,
            length: ctx.pageSize,
            search: q,
            sorting: JSON.stringify({
              require: 0,
              col: ctx.sortKey ?? 'organization',
              dir: ctx.sortDir
            }),
            filter: JSON.stringify(
              sf !== 'all' ? { health: sf === 'complete' ? 'Good' : sf === 'in_progress' ? 'In Progress' : sf } : {}
            )
          };
          return { method: 'POST', body: payload };
        }
      },
      showPagination: true,
      defaultPageSize: 10,
      pageSizeOptions: [10, 25, 50, 100],
      showSearch: false,
      clickable: true,
      emptyMessage: 'No client organizations found matching your criteria.'
    };
  });

  loadClients(): void {
    this.tableLoading.set(true);
    this.tableError.set(null);

    const payload: DataTablePayload = {
      start: 0,
      length: 50,
      search: this.searchQuery(),
      sorting: JSON.stringify({ require: 0, col: 'organization', dir: 'asc' }),
      filter: JSON.stringify({})
    };

    this.implementationService.fetchDataTable(payload).subscribe({
      next: res => {
        this.clients.set(res?.data ?? []);
        this.tableLoading.set(false);
      },
      error: () => {
        this.clients.set([]);
        this.tableError.set("Couldn't connect to server. Please check the backend is running.");
        this.tableLoading.set(false);
      }
    });
  }

  retryAll(): void {
    this.loadCardData();
    this.loadClients();
  }

 
  get filterTabs() {
    const card = this.cardData();
    const rows = this.clients();
    return [
      { id: 'all',         label: 'All Organisations', count: card?.totalAccounts ?? rows.length },
      { id: 'in_progress', label: 'In Progress',       count: card?.inProgress    ?? rows.filter(r => this.isInProgress(r)).length },
      { id: 'complete',    label: 'Completed',          count: card?.completed     ?? rows.filter(r => this.isComplete(r)).length },
      { id: 'pending',     label: 'Not Started',        count: card?.notStarted   ?? rows.filter(r => this.isNotStarted(r)).length }
    ];
  }

  filteredClients = computed(() => {
    const q  = this.searchQuery().toLowerCase().trim();
    const sf = this.statusFilter();

    return this.clients().filter(c => {
      const matchSearch =
        (c.organization?.toLowerCase().includes(q) || false) ||
        (c.orgId?.toString().includes(q) || false) ||
        (c.csLead?.toLowerCase().includes(q) || false);
      if (!matchSearch) return false;

      if (sf === 'complete')    return this.isComplete(c);
      if (sf === 'in_progress') return this.isInProgress(c);
      if (sf === 'pending')     return this.isNotStarted(c);

      return true;
    });
  });

tatus(status: string) {
    this.statusFilter.set(status);
d data error:'
        this.errorMessage.set('Failed to load data. Please try again.');
        this.isLoading.set(f<<<<<<< HEAD
  setFilterStatus(status: string) {
    this.statusFilter.set(status);
=======
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
        buildRequest: (ctx) => {
          // Merge the active status-filter tab AND the table's own filter
          // modal selections (csLead, health, ...) into the filter object.
          const filterObj: Record<string, any> = { ...ctx.filters };
          if (statusFilter !== 'all') filterObj['status'] = statusFilter;

          const body = {
            start:   ctx.page * ctx.pageSize,          // offset
            length:  ctx.pageSize,                     // page size
            search:  ctx.search ?? '',
            sorting: JSON.stringify({
              require: 0,
              col: ctx.sortKey ?? 'orgId',
              dir: ctx.sortDir ?? 'desc',
            }),
            filter: JSON.stringify(filterObj),
          };

          return { method: 'POST' as const, body };
        },

        /** Maps each raw API row to the Client shape the rest of the UI uses. */
        transformRow: (row: any) => this.mapApiRowToClient(row as ApiClientRow),
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

    // Grid view — fetch a full page with default params
    const defaultPayload = {
      start:   0,
      length:  1000,
      search:  '',
      sorting: JSON.stringify({ require: 0, col: 'orgId', dir: 'desc' }),
      filter:  JSON.stringify({}),
    };

    this.implService.fetchDataTable(defaultPayload).subscribe({
      next: (res: ApiResponse) => {
        this.clients.set(this.mapApiDataToClients(res.data ?? []));
        this.isLoading.set(false);
      },
     data error:', err);
        this.errorMessage.set('Failed to load data. Please try again.');
        this.isLoading.set(false);
      }
    });
>>>>>>> cb2dd819f68c95769f32c82b5a47dc01c7f52cec
t p = client.overallProgress;
    return (p?.approved ?? 0) > 0 && (p?.approved ?? 0) < (p?.total ?? 0);
  }

  isNotStarted(client: Datum): boolean {
    return (client.overallProgress?.approved ?? 0) === 0;
  }

  getClientProgressPercent(client: Datum): number {
    if (client.overallProgress?.percentage !== undefined && client.overallProgress.percentage > 0) {
      return client.overallProgress.percentage;
    }
    const total    = client.overallProgress?.total ?? 0;
    const approved = client.overallProgress?.approved ?? 0;
    return total === 0 ? 0 : Math.round((approved / total) * 100);
  }

 
  getActiveModuleCount(client: Datum): number {
    if (!client.modules) return 0;
    return (Object.values(client.modules) as { completed: number; total: number }[])
      .filter(m => m.completed > 0).length;
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

 
  getModuleStats(client: Datum, key: keyof Datum['modules']): { completed: number; total: number } {
    const m = client.modules?.[key];
    return { completed: m?.completed ?? 0, total: m?.total ?? 0 };
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
    if (!name) return '?';
    return name
      .split(' ')
      .map(p => p.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
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


  openClientDetails(client: Datum) {
    if (this.closeTimer) { clearTimeout(this.closeTimer); this.closeTimer = null; }
    this.selectedClient.set(client);
    this.selectedModuleTab.set('all');
    this.drawerOpen.set(false);
    this.openTimer = setTimeout(() => this.drawerOpen.set(true), 20);
  }

  closeClientDetails() {
    if (this.openTimer) { clearTimeout(this.openTimer); this.openTimer = null; }
    this.drawerOpen.set(false);
    this.closeTimer = setTimeout(() => this.selectedClient.set(null), 300);
  }
}
