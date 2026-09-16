import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DataTable } from '../../../../shared/components/Data-table/data-table';
import {
  RequestContext,
  SmartColumn,
  SmartTableConfig,
} from '../../../../shared/components/Data-table/data-table.types';
import { environment } from '../../../../../environments/environment';

export interface AdminClientRow {
  orgId: number;
  name: string;
  phoneNumber: string;
  altPhoneNumber: string;
  orgStatus: string;
}

interface AdminClientRaw {
  orgId: number;
  name: string;
  phoneNumber: string | null;
  altPhoneNumber: string | null;
  orgStatus: string | null;
}

@Component({
  selector: 'app-voice-clients',
  standalone: true,
  imports: [DataTable],
  templateUrl: './clients.html',
})
export class Clients {
  private router = inject(Router);
  private readonly tableEndpoint = `${environment.apiUrl}/api/voice/admin-clients-table`;

  loadData() {}

  callClient(row: AdminClientRow): void {
    this.router.navigate(['/voice/softphone'], {
      queryParams: {
        orgId: row.orgId,
        number: row.phoneNumber,
        name: row.name,
      },
    });
  }

  private mapRow(raw: AdminClientRaw): AdminClientRow | null {
    if (!raw.phoneNumber) return null; // no usable number -- nothing to call
    return {
      orgId: raw.orgId,
      name: raw.name,
      phoneNumber: raw.phoneNumber,
      altPhoneNumber: raw.altPhoneNumber || '—',
      orgStatus: raw.orgStatus || '—',
    };
  }

  tableConfig = computed<SmartTableConfig<AdminClientRow>>(() => ({
    columns: [
      { key: 'name', label: 'Client', sortable: true, hideable: true },
      { key: 'phoneNumber', label: 'Phone Number', sortable: false },
      { key: 'altPhoneNumber', label: 'Alt Phone', sortable: false },
      { key: 'leadOwner', label: 'Lead Owner', sortable: false },
      { key: 'supportOwner', label: 'Support Owner', sortable: false },
      { key: 'renewalOwner', label: 'Renewal Owner', sortable: false },
      { key: 'orgStatus', label: 'Status', sortable: true },
      { key: 'leadSource', label: 'Lead Source', sortable: false },
      { key: 'reseller', label: 'Reseller', sortable: false },
      { key: 'tags', label: 'Tags', sortable: false },
      { key: 'rating', label: 'Rating', sortable: false },
    ] as SmartColumn<AdminClientRow>[],

    apiConfig: {
      endpoint: this.tableEndpoint,
      dataPath: 'data',
      totalPath: 'totalRecords',

      buildRequest: (ctx: RequestContext) => {
        // Only 'orgId'/'name'/'orgStatus' are honoured server-side (see
        // fetchAdminClientsDataTable) -- default sort is o.Id DESC to
        // avoid a filesort on the unindexed Name column at 100k+ rows.
        const sortColMap: Record<string, string> = {
          name: 'name',
          orgId: 'orgId',
          orgStatus: 'orgStatus',
        };
        const sortCol = ctx.sortKey ? (sortColMap[ctx.sortKey] ?? ctx.sortKey) : 'orgId';

        const body = {
          start: ctx.page * ctx.pageSize,
          length: ctx.pageSize,
          search: ctx.search ?? '',
          sorting: JSON.stringify({ require: ctx.sortKey ? 1 : 0, col: sortCol, dir: ctx.sortDir ?? 'desc' }),
          filter:   JSON.stringify({ ...ctx.filters }),
        };

        return { method: 'POST' as const, body };
      },

      transformRow: (raw: AdminClientRaw): AdminClientRow | null => this.mapRow(raw),
    },

    rowIdKey: 'orgId',
    showSearch: true,
    showPagination: true,
    defaultPageSize: 25,
    pageSizeOptions: [25, 50, 100],
    exportFileName: 'admin-clients',
    emptyMessage: 'No admin clients found.',
    clickable: true,



    customRowActions: [
      {
        id: 'call',
        label: 'Call',
        icon: 'call',
        onClick: (row) => this.callClient(row),
      },
    ],

    toolbarButtons: [
       { id: 'columns', type: 'columnPicker' as const, label: 'Columns' },
      { id: 'filter', type: 'filter', label: 'Filter' },
      { id: 'refresh', type: 'refresh' },
    ],
  }));
}