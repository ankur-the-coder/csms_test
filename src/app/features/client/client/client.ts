import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { DataTable } from '../../../shared/components/Data-table/data-table';
import { CustomColumnDirective } from '../../../shared/components/Data-table/custom-column.directive';
import {
  BulkAction,
  RequestContext,
  SmartColumn,
  SmartTableConfig,
} from '../../../shared/components/Data-table/data-table.types';
import { ClientService } from '../services/client/client';
import { Datum } from '../models/client/client.model';
import { ActivatedRoute,  Router  } from '@angular/router';
import { NgClass } from '@angular/common';

export interface ClientRow {
  orgId: number;
  name: string;
  planStart: string;
  planEnd: string;
  userLimit: number;
  modules: string;
  leadOwner: string;
  supportOwner: string;
  progress: number;
  stage: string;
  trainingStatus: number;
  trainingProgress: number;
  contactPerson: string;
  email: string;
  phoneNumber: string;
  country: string;
}

@Component({
  selector: 'app-client',
  imports: [DataTable, CustomColumnDirective, NgClass],
  templateUrl: './client.html',
  styleUrl: './client.css',
})
export class Client {
  private clientApi = inject(ClientService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private readonly tableEndpoint = `${this.clientApi.baseUrl}/clientDataTable`;
  statusFilter = signal<string>('all');

  initialDateFrom = signal('');
  initialDateTo = signal('');

  private getTodayDateString(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  ngOnInit() {
    this.route.queryParamMap.subscribe(params => {
      const from = params.get('from');
      const to = params.get('to');
      if (from && to) {
        this.initialDateFrom.set(from);
        this.initialDateTo.set(to);
      }
    });
    this.loadData();
  }

  loadData() {}

  openClientDetails(client: ClientRow) {}

  actionMenuOpenRowId = signal<number | null>(null);
  actionMenuRow = signal<ClientRow | null>(null);
  actionMenuPosition = signal<{ top: number; left: number } | null>(null);

  toggleActionMenu(row: ClientRow, event: MouseEvent): void {
    event.stopPropagation();

    if (this.actionMenuOpenRowId() === row.orgId) {
      this.closeActionMenu();
      return;
    }

    const trigger = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const menuWidth = 176;

    this.actionMenuOpenRowId.set(row.orgId);
    this.actionMenuRow.set(row);
    this.actionMenuPosition.set({
      top: trigger.bottom + 6,
      left: Math.max(8, trigger.right - menuWidth),
    });
  }

  closeActionMenu(): void {
    this.actionMenuOpenRowId.set(null);
    this.actionMenuRow.set(null);
    this.actionMenuPosition.set(null);
  }

  @HostListener('document:click')
  onDocumentClickCloseActionMenu(): void {
    if (this.actionMenuOpenRowId() !== null) {
      this.closeActionMenu();
    }
  }

  @HostListener('window:resize')
  onWindowResizeCloseActionMenu(): void {
    if (this.actionMenuOpenRowId() !== null) {
      this.closeActionMenu();
    }
  }

  onClientMenuAction(action: string, row: ClientRow): void {
    console.log(`${action}:`, row.orgId);
    this.closeActionMenu();

  //    if (action === 'Meeting Schedule') {
  //   this.router.navigate(['/meetings/schedule']);
  // }

if (action === 'Meeting Schedule') {
    this.router.navigate(['/meetings/schedule'], {
      queryParams: {
        orgName: row.name,
        email: row.email,
      },
    });
  }

  }

  private mapDatumToClientRow(raw: Datum): ClientRow {
    return {
      orgId: raw.orgId,
      name: raw.client,
      planStart: String(raw.planStart),
      planEnd: String(raw.planEnd),
      userLimit: raw.userLimit,
      modules: raw.module,
      leadOwner: raw.leadOwner,
      supportOwner: raw.supportOwner && String(raw.supportOwner) !== '-' ? String(raw.supportOwner) : '—',
      progress: raw.progress,
      stage: raw.stage,
      trainingStatus: raw.trainingStatus,
      trainingProgress: raw.trainingProgress,
      contactPerson: raw.contactPerson,
      email: raw.email,
      phoneNumber: raw.phoneNumber,
      country: raw.country,
    };
  }

  // ── Bulk action handlers ────────────────────────────────────────────────
  private markImplementation(rows: ClientRow[], status: 'Pending' | 'Completed'): void {
    const ids = rows.map(r => r.orgId);
    console.log(`Mark ${status}:`, ids);
  }

  private exportSelected(rows: ClientRow[]): void {
    console.log('Export selected:', rows.map(r => r.orgId));
  }

  private deleteSelected(rows: ClientRow[]): void {
    const ids = rows.map(r => r.orgId);
    console.log('Delete:', ids);
  }

  get bulkActions(): BulkAction<ClientRow>[] {
    return [
      {
        id: 'markCompleted',
        label: 'Mark Completed',
        icon: 'check',
        color: '#10b981',
        // now based on progress percentage instead of a status string
        hidden: (rows) => rows.every(r => r.progress === 100),
        onClick: (rows) => this.markImplementation(rows, 'Completed'),
      },
      {
        id: 'markPending',
        label: 'Mark Pending',
        icon: 'circle-dot',
        color: '#f59e0b',
        hidden: (rows) => rows.every(r => r.progress === 0),
        onClick: (rows) => this.markImplementation(rows, 'Pending'),
      },
      {
        id: 'exportSelected',
        label: 'Export Selected',
        icon: 'download',
        color: '#3b82f6',
        onClick: (rows) => this.exportSelected(rows),
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: 'delete',
        color: '#ef4444',
        disabled: (rows) => rows.some(r => r.stage === 'PREMIUM'),
        onClick: (rows) => this.deleteSelected(rows),
      },
    ];
  }

  tableConfig = computed<SmartTableConfig<ClientRow>>(() => {
    const statusFilter = this.statusFilter();

    return {
      columns: [
        { key: 'name', label: 'Client', sortable: true, hideable: true },
        { key: 'contactPerson', label: 'Contact Name', sortable: false },
        { key: 'email', label: 'Email', sortable: false },
        { key: 'phoneNumber', label: 'Phone', sortable: false },
        { key: 'country', label: 'Country', sortable: false },
        { key: 'planStart', label: 'Plan Start', sortable: false, hideable: false, type: 'date' },
        { key: 'planEnd', label: 'Plan End', sortable: false, hideable: false, type: 'date' },
        { key: 'userLimit', label: 'User Limit', sortable: true },
        { key: 'modules', label: 'Modules', sortable: false },
        { key: 'leadOwner', label: 'Lead Owner', sortable: false },
        { key: 'supportOwner', label: 'Support Owner', sortable: false },
        // { key: 'progress', label: 'Implementation', sortable: false },
        // { key: 'trainingStatus', label: 'Training', sortable: false },
        { key: 'action', label: 'Action', sortable: false },
      ] as SmartColumn<ClientRow>[],

      apiConfig: {
        endpoint: this.tableEndpoint,
        dataPath: 'data',
        totalPath: 'totalRecords',

        buildRequest: (ctx: RequestContext) => {
          const filterObj: Record<string, any> = { ...ctx.filters };
          const today = this.getTodayDateString();
          const fromDate = ctx.dateFrom ? ctx.dateFrom : today;
          const toDate = ctx.dateTo ? ctx.dateTo : today;

          const sortColMap: Record<string, string> = {
            name: 'client',
            planStart: 'planStart',
            planEnd: 'planEnd',
            userLimit: 'userLimit',
            stage: 'stage',
            modules: 'module',
            leadOwner: 'leadOwner',
            supportOwner: 'suppOwner',
          };
          const sortCol = ctx.sortKey ? (sortColMap[ctx.sortKey] ?? ctx.sortKey) : 'client';

          const body = {
            start: ctx.page * ctx.pageSize,
            length: ctx.pageSize,
            search: ctx.search ?? '',
            sorting: JSON.stringify({ require: ctx.sortKey ? 1 : 0, col: sortCol, dir: ctx.sortDir ?? 'asc' }),
            filter: JSON.stringify(filterObj),
            fromDate,
            toDate,
          };

          return { method: 'POST' as const, body };
        },

        transformRow: (raw: Datum): ClientRow | null => this.mapDatumToClientRow(raw),
      },

      rowIdKey: 'orgId',
      showSearch: true,
      showPagination: true,
      defaultPageSize: 10,
      pageSizeOptions: [10, 25, 50, 100, 500],
      exportFileName: 'client',
      emptyMessage: 'No client records found.',
      clickable: true,

      toolbarButtons: [
        { id: 'date', type: 'datePicker' as const, label: 'Date' },
        { id: 'filter', type: 'filter', label: 'Filter' },
        { id: 'export', type: 'export', label: 'Export' },
        { id: 'refresh', type: 'refresh' },
        { id: 'columns', type: 'columnPicker', label: 'Columns' },
      ],
    };
  });
}
