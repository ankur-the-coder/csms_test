import { Component, computed, inject, signal } from '@angular/core';
import { DataTable } from '../../../shared/components/Data-table/data-table';
import {
  RequestContext,
  SmartTableConfig,
   ApiRequest,
} from '../../../shared/components/Data-table/data-table.types';
import { Client as ClientApi, DataTablePayload } from '../services/client/client';
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
  private clientApi = inject(ClientApi);

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

  tableConfig = computed<SmartTableConfig<ClientRow>>(() => {
    const statusFilter = this.statusFilter();

    return {
      columns: [
        { key: 'name', label: 'Client', sortable: true, hideable: true },
        { key: 'planStart', label: 'Plan Start', sortable: true, hideable: false, type: 'date' },
        { key: 'planEnd', label: 'Plan End', sortable: true, hideable: false, type: 'date' },
        { key: 'userLimit', label: 'User Limit', sortable: false },
        { key: 'modules', label: 'Modules', sortable: true },
        { key: 'leadOwner', label: 'Lead Owner', sortable: false },
        { key: 'supportOwner', label: 'Support Owner', sortable: false },
        {
          key: 'implementation',
          label: 'Implementation',
          sortable: false,
          type: 'badge',
          badgeMap: { Pending: { label: 'Pending' }, Completed: { label: 'Completed' } },
        },
      ],

      apiConfig: {
        // endpoint zaroori nahi — real URL service ke andar hai
        endpoint: 'clientDataTable',
        dataPath: 'data',
        totalPath: 'totalRecords',

        buildRequest: (ctx: RequestContext) => {
          const filterObj: Record<string, any> = { ...ctx.filters };
          const today = this.getTodayDateString();
          const fromDate = ctx.dateFrom ? ctx.dateFrom : today;
          const toDate = ctx.dateTo ? ctx.dateTo : today;

          const sortColMap: Record<string, string> = {
            name: 'orgName',
            planStart: 'planStart',
            planEnd: 'planEnd',
            userLimit: 'userLimit',
            modules: 'module',
            leadOwner: 'leadOwner',
            supportOwner: 'suppOwner',
          };
          const sortCol = ctx.sortKey ? (sortColMap[ctx.sortKey] ?? ctx.sortKey) : 'orgName';

          // ── body ka type DataTablePayload hai (request), na ki ClientDataTableResponse (response) ──
          const body: DataTablePayload = {
            start: ctx.page * ctx.pageSize,
            length: ctx.pageSize,
            search: ctx.search ?? '',
            sorting: JSON.stringify({ require: 0, col: sortCol, dir: ctx.sortDir ?? 'desc' }),
            filter: JSON.stringify(filterObj),
            tabSts:
              statusFilter === 'complete' ? 1 :
              statusFilter === 'in_progress' ? 2 :
              statusFilter === 'pending' ? 3 : 0,
            fromDate,
            toDate,
          };

          return { method: 'POST' as const, body };
        },


        // fetchFn: (req) => this.clientApi.getClientDataTable(req.body as DataTablePayload),
        fetchFn: (req: ApiRequest) => this.clientApi.getClientDataTable(req.body as DataTablePayload),

        transformRow: (raw: Datum): ClientRow | null => this.mapDatumToClientRow(raw),
      },

      rowIdKey: 'orgId',
      showSearch: true,
      showPagination: true,
      defaultPageSize: 10,
      pageSizeOptions: [10, 25, 50, 100, 500],
      exportFileName: 'client',
      emptyMessage: 'No client records found.',
      clickable: false,
      toolbarButtons: [
        { id: 'date', type: 'datePicker', label: 'Date' },
        { id: 'filter', type: 'filter', label: 'Filter' },
        { id: 'export', type: 'export', label: 'Export' },
        { id: 'refresh', type: 'refresh' },
        { id: 'columns', type: 'columnPicker', label: 'Columns' },
      ],
    };
  });
}
