import { Component, computed, inject, signal } from '@angular/core';
import { DataTable } from '../../../shared/components/Data-table/data-table';
import {
  BulkAction,
  RequestContext,
  SmartColumn,
  SmartTableConfig,
} from '../../../shared/components/Data-table/data-table.types';
import { ClientService } from '../services/client/client';
import { Datum } from '../models/client/client.model';

export interface ClientRow {
  orgId: number;
  name: string;
  planStart: string;
  planEnd: string;
  userLimit: number;
  modules: string;
  leadOwner: string;
  supportOwner: string;
  implementation: string;
  stage: string;
}

@Component({
  selector: 'app-client',
  imports: [DataTable],
  templateUrl: './client.html',
  styleUrl: './client.css',
})
export class Client {
  // 'ClientApi' — same alias se inject karna hoga
  private clientApi = inject(ClientService);
  private readonly tableEndpoint = `${this.clientApi.baseUrl}/clientDataTable`;
  statusFilter = signal<string>('all');

  private getTodayDateString(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  ngOnInit() {
    this.loadData();
  }

  loadData() {}

  openClientDetails(client: ClientRow) {}

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
      implementation: raw.implementation,
      stage: raw.stage,
    };
  }

  // ── Bulk action handlers ────────────────────────────────────────────────
  // Keep the actual logic in normal methods; the getter below just wires
  // each action's id/label/icon to one of these.
  private markImplementation(rows: ClientRow[], status: 'Pending' | 'Completed'): void {
    const ids = rows.map(r => r.orgId);
    // TODO: call clientApi.updateImplementationStatus(ids, status) then this.loadData()
    console.log(`Mark ${status}:`, ids);
  }

  private exportSelected(rows: ClientRow[]): void {
    // TODO: call clientApi.exportClients(rows.map(r => r.orgId))
    console.log('Export selected:', rows.map(r => r.orgId));
  }

  private deleteSelected(rows: ClientRow[]): void {
    const ids = rows.map(r => r.orgId);
    // TODO: confirm + call clientApi.deleteClients(ids) then this.loadData()
    console.log('Delete:', ids);
  }

  // Getter (not a plain field) so it re-evaluates with fresh closures each
  // time Angular reads it — matches the pattern used elsewhere in this app.
  get bulkActions(): BulkAction<ClientRow>[] {
    return [
      {
        id: 'markCompleted',
        label: 'Mark Completed',
        icon: 'check',
        color: '#10b981',
        // hide this action entirely if every selected row is already Completed
        hidden: (rows) => rows.every(r => r.implementation === 'Completed'),
        onClick: (rows) => this.markImplementation(rows, 'Completed'),
      },
      {
        id: 'markPending',
        label: 'Mark Pending',
        icon: 'circle-dot',
        color: '#f59e0b',
        hidden: (rows) => rows.every(r => r.implementation === 'Pending'),
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
        // example: disable delete when a row that shouldn't be removable is selected
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
        { key: 'planStart', label: 'Plan Start', sortable: true, hideable: false, type: 'date' },
        { key: 'planEnd', label: 'Plan End', sortable: false, hideable: false, type: 'date' },
        { key: 'userLimit', label: 'User Limit', sortable: true },
        // {
        //   key: 'stage',
        //   label: 'Stage',
        //   sortable: false,
        //   type: 'badge',
        //   badgeMap: { PREMIUM: { label: 'PREMIUM' } },
        // },
        { key: 'modules', label: 'Modules', sortable: false },
        { key: 'leadOwner', label: 'Lead Owner', sortable: false },
        { key: 'supportOwner', label: 'Support Owner', sortable: false },
        {
          key: 'implementation',
          label: 'Implementation',
          sortable: false,
          type: 'badge',
          badgeMap: { Pending: { label: 'Pending' }, Completed: { label: 'Completed' } },
        },
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

          // POST body with all required fields
          const body = {
            start: ctx.page * ctx.pageSize,
            length: ctx.pageSize,
            search: ctx.search ?? '',
            sorting: JSON.stringify({ require: ctx.sortKey ? 1 : 0, col: sortCol, dir: ctx.sortDir ?? 'asc' }),
            filter: JSON.stringify(filterObj),
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

      // ── Bulk actions — this is all you need ────────────────────────────
      selectable: true,
      bulkActions: this.bulkActions,
      bulkActionButtonLabel: 'Actions',
      bulkActionButtonIcon: 'users',

      toolbarButtons: [
        { id: 'filter', type: 'filter', label: 'Filter' },
        { id: 'export', type: 'export', label: 'Export' },
        { id: 'refresh', type: 'refresh' },
        { id: 'columns', type: 'columnPicker', label: 'Columns' },
      ],
    };
  });
}