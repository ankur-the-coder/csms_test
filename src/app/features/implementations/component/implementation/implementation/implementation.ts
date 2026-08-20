import { Component, signal, computed, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, catchError, of, switchMap, takeUntil } from 'rxjs';
import { RequestContext, SmartTableConfig } from '../../../../../shared/components/Data-table/data-table.types';
import { DataTable } from "../../../../../shared/components/Data-table/data-table";
import { CustomColumnDirective } from '../../../../../shared/components/Data-table/custom-column.directive';
import { ImplementationService } from '../../../services/implementation/implementation';
import { CardData, DataTablePayload, Datum } from '../../../models/implementation.model';
import { CustomDateSelector } from "../../../../../shared/components/inputs/custom-date-selector/custom-date-selector";
import { ActivatedRoute } from '@angular/router';

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
  rating: number;
  licence_start_date: string;
  licence_end_date: string;
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

interface ClientStatus {
  approved: number;
  total: number;
  percentage: number;
  isCompleted: boolean;
  isInProgress: boolean;
  isNotStarted: boolean;
}

@Component({
  selector: 'app-implementation',
  imports: [CommonModule, FormsModule, DataTable, CustomColumnDirective, CustomDateSelector],
  templateUrl: './implementation.html',
  styleUrl: './implementation.css',
  standalone: true,
})
export class Implementation implements OnInit, OnDestroy {

  private readonly implService = inject(ImplementationService);
  private readonly tableEndpoint = `${this.implService.baseUrl}/imp/fetchDataTable`;
  private selectedDateFrom = signal<string | null>(null);
  private selectedDateTo   = signal<string | null>(null);
  cardData = signal<CardData>({ totalAccounts: 0, completed: 0, inProgress: 0, notStarted: 0 });
  statusFilter = signal<string>('all');
  selectedClient    = signal<Client | null>(null);
  selectedModuleTab = signal<string>('all');
  drawerOpen        = signal<boolean>(false);
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private openTimer:  ReturnType<typeof setTimeout> | null = null;
  private fetchCardTrigger$ = new Subject<void>();
  private destroy$          = new Subject<void>();
    private route = inject(ActivatedRoute);

    // Populated from ?from=...&to=... query params when navigated in from
  // the dashboard (e.g. clicking "Live Clients"). Empty by default, in
  // which case DataTable falls back to its own default ('today').
  initialDateFrom = signal('');
  initialDateTo = signal('');


  get filterTabs() {
    const c = this.cardData();
    return [
      { id: 'all',         label: 'All Organisations', count: c.totalAccounts },
      { id: 'in_progress', label: 'In Progress',       count: c.inProgress },
      { id: 'complete',    label: 'Completed',         count: c.completed },
      { id: 'pending',     label: 'Not Started',       count: c.notStarted },
    ];
  }

  totalClients           = computed(() => this.cardData().totalAccounts);
  completedClientsCount  = computed(() => this.cardData().completed);
  inProgressClientsCount = computed(() => this.cardData().inProgress);
  pendingClientsCount = computed(() => this.cardData().notStarted);

 clientModules = computed<Module[]>(() => {
    const client = this.selectedClient();
    if (!client?.modules) return [];
    return client.modules.filter(mod => this.getModuleTotalCount(client, mod) > 0);
  });

  displayModules = computed<Module[]>(() => {
    const tabKey = this.selectedModuleTab();
    const modules = this.clientModules();
    return tabKey === 'all' ? modules : modules.filter(m => m.key === tabKey);
  });


  private static readonly COLUMNS = [
    { key: 'name',               label: 'Organisation',   sortable: true },
    { key: 'cs_lead',            label: 'Lead Owner',     sortable: false },
    { key: 'support_owner',      label: 'Support Owner',  sortable: false , hidden :true},
    { key: 'country',            label: 'Country',        sortable: false , hidden : true},
    { key: 'rating',             label: 'Rating',         sortable: false, align: 'center' as const },
    {
      key: 'health', label: 'Health', type: 'badge' as const, align: 'center' as const,
      badgeMap: {
        'Good':      { label: 'Good' },
        'Excellent': { label: 'Excellent' },
        'Neutral':   { label: 'Neutral' },
        'Risk':      { label: 'Risk' },
      }
    },
    { key: 'onboarding_date',    label: 'Onboarded',      sortable: false },
    { key: 'licence_start_date', label: 'Start Date',     sortable: false },
    { key: 'licence_end_date',   label: 'End Date',       sortable: false },
    { key: 'overallProgress',    label: 'Progress',       align: 'center' as const, tooltip: 'Overall implementation progress' },
    { key: 'modules',            label: 'Modules',        align: 'center' as const, tooltip: 'Module-wise completion status' },
  ];

  private static readonly TOOLBAR_BUTTONS = [
    { id: 'date',    type: 'datePicker'   as const, label: 'Date' },
    { id: 'filter',  type: 'filter'       as const, label: 'Filter' },
    { id: 'export',  type: 'export'       as const, label: 'Export' },
    { id: 'refresh', type: 'refresh'      as const },
    { id: 'columns', type: 'columnPicker' as const, label: 'Columns' },
  ];

  private static readonly SORT_COL_MAP: Record<string, string> = {
    'name':            'orgName',
    'cs_lead':         'csLead',
    'support_owner':   'suppOwner',
    'country':         'country',
    'health':          'health',
    'onboarding_date': 'onboardedDate',
    'orgId':           'orgId',
  };

  // ── DataTable config — only apiConfig depends on statusFilter ─────────────
  tableConfig = computed<SmartTableConfig<Client>>(() => {
    const statusFilter = this.statusFilter();
    const tabSts = statusFilter === 'complete' ? 1 : statusFilter === 'in_progress' ? 2 : statusFilter === 'pending' ? 3 : 0;

    return {
      columns: Implementation.COLUMNS,

      apiConfig: {
        endpoint:  this.tableEndpoint,
        dataPath:  'data',
        totalPath: 'meta.total',

        buildRequest: (ctx: RequestContext) => {
  // Jab bhi ctx se real date aaye (user ne date picker se select kiya),
  // usko state me save kar lo.
  if (ctx.dateFrom) this.selectedDateFrom.set(ctx.dateFrom);
  if (ctx.dateTo)   this.selectedDateTo.set(ctx.dateTo);

  const today = this.getTodayDateString();
  const body: DataTablePayload = {
    start:   ctx.page * ctx.pageSize,
    length:  ctx.pageSize,
    search:  ctx.search ?? '',
    sorting: JSON.stringify({
      require: 1,
      col: ctx.sortKey ? (Implementation.SORT_COL_MAP[ctx.sortKey] ?? ctx.sortKey) : 'orgName',
      dir: ctx.sortDir ?? 'desc',
    }),
    filter:   JSON.stringify({ ...ctx.filters }),
    tabSts,

    fromDate: this.selectedDateFrom() || today,
    toDate:   this.selectedDateTo()   || today,
  };
  return { method: 'POST' as const, body };
},

        transformRow: (row: any): Client | null => {
          const client = this.mapApiRowToClient(row as Datum);
          if (statusFilter === 'all') return client;

          const { isCompleted, isInProgress, isNotStarted } = this.getClientStatus(client);
          if (statusFilter === 'complete'    && !isCompleted)  return null;
          if (statusFilter === 'in_progress' && !isInProgress) return null;
          if (statusFilter === 'pending'     && !isNotStarted) return null;
          return client;
        },
      },

      rowIdKey:        'id',
      showSearch:      true,
      showPagination:  true,
      defaultPageSize: 10,
      pageSizeOptions: [10, 25, 50, 100, 500],
      exportFileName:  'Implementation Progress',
      emptyMessage:    'No implementation records found.',
      clickable:       false,
      toolbarButtons: Implementation.TOOLBAR_BUTTONS,
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
  ngOnInit() {
    this.route.queryParamMap.subscribe(params => {
      const from = params.get('from');
      const to   = params.get('to');
      const tab  = params.get('tab');

      if (from && to) {
        this.initialDateFrom.set(from);
        this.initialDateTo.set(to);
      }

      // Auto-select the tab when navigated from dashboard (e.g. "Pending Implementations" card)
      if (tab) {
        this.statusFilter.set(tab);
      }
    });
    this.setupCardFetchStream();
    this.fetchCardTrigger$.next();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.closeTimer) clearTimeout(this.closeTimer);
    if (this.openTimer)  clearTimeout(this.openTimer);
  }

  private setupCardFetchStream() {
    this.fetchCardTrigger$
      .pipe(
        switchMap(() =>
          this.implService.fetchImpCardData().pipe(
            catchError((err) => {
              console.error('Card data error:', err);
              return of(null);
            })
          )
        ),
        takeUntil(this.destroy$)
      )
      .subscribe((data) => {
        if (!data) return;
        this.cardData.set(data);
      });
  }


  private mapApiRowToClient(row: Datum): Client {
    const modules: Module[] = [];
    const checklist: Record<number, FeatureChecklistRow> = {};
    const apiModules: Record<string, { completed: number; total: number }> = {};

    if (row.modules && typeof row.modules === 'object') {
      const moduleEntries = Object.entries(row.modules)
        .sort(([, a], [, b]) => (a?.tabOrder ?? 0) - (b?.tabOrder ?? 0));

      moduleEntries.forEach(([key, modData]) => {
        const featuresList: Feature[] = [];
        let completedCount = 0;
        const totalCount = Array.isArray(modData?.features) ? modData.features.length : 0;

        if (Array.isArray(modData?.features)) {
          modData.features.forEach((feat) => {
            featuresList.push({ mod_id: feat.mod_id, name: feat.name });

            if (feat.approval_status === 1) completedCount++;

            checklist[feat.mod_id] = {
              approval_status: feat.approval_status ?? 0,
              remark: feat.remark ?? '',
              started_at:   feat.started_at   ? this.formatDate(feat.started_at.toString())   : null,
              completed_at: feat.completed_at ? this.formatDate(feat.completed_at.toString()) : null,
            };
          });
        }

        modules.push({
          tab_id: modData?.tabOrder ?? (modules.length + 1),
          key,
          label: modData?.label || key,
          features: featuresList,
        });

        apiModules[key] = { completed: completedCount, total: totalCount };
      });
    }

    return {
      id:                  row.orgId,
      org_id:              row.orgId,
      name:                row.organization,
      industry:            '',
      onboarding_date:     this.formatDate(row.onboardedDate?.toString() ?? ''),
      cs_lead:             row.csLead        || '-',
      support_owner:       row.supportOwner  || '—',
      country:             row.country       || '—',
      rating:              row.rating        ?? 0,
      licence_start_date:  this.formatDate(row.licenceStartDate?.toString() ?? ''),
      licence_end_date:    this.formatDate(row.licenceEndDate?.toString()   ?? ''),
      health:              row.health,
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

  private formatDate(isoDate: string): string {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // ── Shared status logic (single source of truth, used by table filtering) ─
  private getClientStatus(client: Client): ClientStatus {
    const approved   = client.overallProgress?.approved   ?? this.getClientApprovedCount(client);
    const total      = client.overallProgress?.total      ?? this.getClientTotalFeaturesCount(client);
    const percentage = client.overallProgress?.percentage ?? (total > 0 ? Math.round((approved / total) * 100) : 0);

    const isCompleted  = percentage === 100 || (total > 0 && approved === total);
    const isNotStarted = percentage === 0 || approved === 0;
    const isInProgress = !isCompleted && !isNotStarted;

    return { approved, total, percentage, isCompleted, isInProgress, isNotStarted };
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
    return this.getClientStatus(client).percentage;
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

  // Kept for template backward-compatibility; now backed by memoized computed signals
  // when called with the currently-open drawer's client.
  getClientModules(client: Client | null): Module[] {
    if (client === this.selectedClient()) return this.clientModules();
    if (!client?.modules) return [];
    return client.modules.filter(mod => this.getModuleTotalCount(client, mod) > 0);
  }

  getDisplayModules(): Module[] {
    return this.displayModules();
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
        completed_at: next === 1 ? stamp : null,
      },
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

    const updated: Client = {
      ...client,
      checklist: updatedChecklist,
      apiModules: updatedApiModules,
      overallProgress: {
        approved: totalApproved,
        total: totalFeatures,
        percentage: totalFeatures > 0 ? Math.round((totalApproved / totalFeatures) * 100) : 0,
      },
    };

    if (this.selectedClient()?.id === client.id) this.selectedClient.set(updated);
  }

  updateRemark(client: Client, modId: number, event: Event) {
    const remark = (event.target as HTMLInputElement).value;
    const updatedChecklist = { ...client.checklist, [modId]: { ...client.checklist[modId], remark } };
    if (this.selectedClient()?.id === client.id) {
      this.selectedClient.set({ ...client, checklist: updatedChecklist });
    }
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
          completed_at: stamp,
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
      overallProgress: { approved: totalFeatures, total: totalFeatures, percentage: 100 },
    };
    this.selectedClient.set(updated);
  }
 onDateApplied(from: string, to: string): void {
    // this.dateFrom.set(from);
    // this.dateTo.set(to);
    // this.page.set(0);
  }
  getModulesTooltip(row: any): string {
    return this.getClientModules(row)
      .filter((mod: any) => this.getModuleTotalCount(row, mod) > 0)
      .map((mod: any) => `${mod.label}: ${this.getModuleApprovedCount(row, mod)}/${this.getModuleTotalCount(row, mod)}`)
      .join('\n');
  }
}
