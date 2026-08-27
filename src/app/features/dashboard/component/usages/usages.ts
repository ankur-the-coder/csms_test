import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { BulkAction, RequestContext, SmartColumn, SmartTableConfig } from '../../../../shared/components/Data-table/data-table.types';
import { DataTable } from "../../../../shared/components/Data-table/data-table";
import { environment } from '../../../../../environments/environment';
import { DashboardService } from '../../service/dashboard-service';
import { Data } from '../../models/usages.model';
import { AuthService } from '../../../../core/services/auth-service';


export interface ClientRow {
  orgId: string
  id: string,
  client: string,
  // createdDate: string,
  contactPerson: string,
  email: string,
  phone: string,
  // ticketCount: Number,
  useSts: string,
}

@Component({
  selector: 'app-usages',
  imports: [DataTable],
  templateUrl: './usages.html',
  styleUrl: './usages.css',
})
export class Usages {
private readonly authService = inject(AuthService);
  private clientApi = inject(DashboardService);
  private readonly apiUrl = environment.apiUrl;
  private route = inject(ActivatedRoute);
  private readonly tableEndpoint = `${this.apiUrl}/fetchDashBoardUsagesTable`;
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

  loadData() { }

  openClientDetails(client: ClientRow) { }

  private mapDatumToClientRow(raw: Data): ClientRow {
    return {
      id: raw.id,
      orgId: raw.orgId,
      client: raw.client,
      useSts: raw.useSts,


      // createdDate: string,
      contactPerson: raw.contactPerson,
      email: raw.email,
      phone: raw.phone,
      // ticketCount: Number,

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
      // {
      //   id: 'markCompleted',
      //   label: 'Mark Completed',
      //   icon: 'check',
      //   color: '#10b981',
      //   // now based on progress percentage instead of a status string
      //   hidden: (rows) => rows.every(r => r.progress === 100),
      //   onClick: (rows) => this.markImplementation(rows, 'Completed'),
      // },
      // {
      //   id: 'markPending',
      //   label: 'Mark Pending',
      //   icon: 'circle-dot',
      //   color: '#f59e0b',
      //   hidden: (rows) => rows.every(r => r.progress === 0),
      //   onClick: (rows) => this.markImplementation(rows, 'Pending'),
      // },
      // {
      //   id: 'exportSelected',
      //   label: 'Export Selected',
      //   icon: 'download',
      //   color: '#3b82f6',
      //   onClick: (rows) => this.exportSelected(rows),
      // },
      // {
      //   id: 'delete',
      //   label: 'Delete',
      //   icon: 'delete',
      //   color: '#ef4444',
      //   disabled: (rows) => rows.some(r => r.stage === 'PREMIUM'),
      //   onClick: (rows) => this.deleteSelected(rows),
      // },
    ];
  }

  tableConfig = computed<SmartTableConfig<ClientRow>>(() => {
    const statusFilter = this.statusFilter();

    return {
      columns: [
        { key: 'client', label: 'Client', sortable: true, hideable: true },
        // { key: 'planStart', label: 'Plan Start', sortable: true, hideable: false, type: 'date' },
        { key: 'phone', label: 'Phone', sortable: false, },
        { key: 'email', label: 'Email', sortable: true },
        { key: 'contactPerson', label: 'Contact Person', sortable: false },
        { key: 'useSts', label: 'user Status', sortable: false },
        // { key: 'supportOwner', label: 'Support Owner', sortable: false },
        // { key: 'progress', label: 'Implementation', sortable: false },
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
            // planStart: 'planStart',
            // planEnd: 'planEnd',
            // userLimit: 'userLimit',
            // stage: 'stage',
            // modules: 'module',
            // leadOwner: 'leadOwner',
            // supportOwner: 'suppOwner',
          };
          const sortCol = ctx.sortKey ? (sortColMap[ctx.sortKey] ?? ctx.sortKey) : 'client';

          const body = {
            start: ctx.page * ctx.pageSize,
            length: ctx.pageSize,
            search: ctx.search ?? '',
            sorting: JSON.stringify({ require: ctx.sortKey ? 1 : 0, col: sortCol, dir: ctx.sortDir ?? 'asc' }),
            filter: JSON.stringify(filterObj),
            fromDate,
            toDate,orgId:Number(this.authService.getOrgId())
          };

          return { method: 'POST' as const, body };
        },

        transformRow: (raw: Data): ClientRow | null => this.mapDatumToClientRow(raw),
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
        // { id: 'filter', type: 'filter', label: 'Filter' },
        { id: 'export', type: 'export', label: 'Export' },
        { id: 'refresh', type: 'refresh' },
        { id: 'columns', type: 'columnPicker', label: 'Columns' },
      ],
    };
  });
}
