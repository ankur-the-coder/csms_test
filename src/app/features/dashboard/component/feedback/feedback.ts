import { Component, computed, inject, signal } from '@angular/core';

import { ActivatedRoute } from '@angular/router';



import { BulkAction, RequestContext, SmartColumn, SmartTableConfig } from '../../../../shared/components/Data-table/data-table.types';
import { DataTable } from "../../../../shared/components/Data-table/data-table";
import { DashboardService } from '../../service/dashboard-service';
import { environment } from '../../../../../environments/environment';
import { Datum } from '../../models/feedback.model';
import { CustomColumnDirective } from '../../../../shared/components/Data-table/custom-column.directive';
import { CommonModule, NgClass } from '@angular/common';
import { AuthService } from '../../../../core/services/auth-service';
import { Utils } from '../../../../shared/utils/utils';

export interface ClientRow {
  orgId: string;
  id: string;
  client: string;
  contactPerson: string;
  phone: string;
  email: string;
  ticketId: number;
  ticketUid: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  subject: string;
  rating: number;
  ratingSubmittedAt: string;
  likedMost: string;
  improveFeedback: string;
  status: string;
  priority: string;
  assignedAgent: string;
  createdAt: string;
}

@Component({
  selector: 'app-feedback',
imports: [DataTable, CustomColumnDirective,CommonModule],
  templateUrl: './feedback.html',
  styleUrl: './feedback.css',
})
export class Feedback {
  private clientApi = inject(DashboardService);
private readonly authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private readonly apiUrl = environment.apiUrl;
  private readonly tableEndpoint = `${this.apiUrl}/fetchFeedbackDataTable`;
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

  private mapDatumToClientRow(raw: Datum): ClientRow {
    return {
      orgId: raw.orgId,
      id: raw.id,
      client: raw.client,
      contactPerson: raw.contactPerson,
      phone: raw.phone,
      email: raw.email,
      ticketId: raw.ticketId,
      ticketUid: raw.ticketUid,
      customerName: raw.customerName,
      customerPhone: raw.customerPhone,
      customerEmail: raw.customerEmail,
      subject: raw.subject,
      rating: raw.rating,
      ratingSubmittedAt: raw.ratingSubmittedAt,
      likedMost: raw.likedMost,
      improveFeedback: raw.improveFeedback,
      status: raw.status,
      priority: raw.priority,
      assignedAgent: raw.assignedAgent,
      createdAt: raw.createdAt,
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
  // { key: 'orgId', label: 'Organization ID', sortable: true, hideable: true },

  { key: 'client', label: 'Client', sortable: true, hideable: true },

  { key: 'contactPerson', label: 'Contact Person', sortable: true, hideable: true },

  // { key: 'phone', label: 'Phone', sortable: true, hideable: true },

  // { key: 'email', label: 'Email', sortable: true, hideable: true },

  // { key: 'ticketId', label: 'Ticket ID', sortable: true, hideable: true },
//
  // { key: 'ticketUid', label: 'Ticket UID', sortable: true, hideable: true },

  { key: 'customerName', label: 'Customer Name', sortable: true, hideable: true },

  { key: 'phone', label: 'Customer Phone', sortable: true, hideable: true },

  { key: 'customerEmail', label: 'Customer Email', sortable: true, hideable: true },

  { key: 'subject', label: 'Subject', sortable: true, hideable: true },

  { key: 'rating', label: 'Rating', sortable: true, hideable: true },

  // { key: 'ratingSubmittedAt', label: 'Rating Submitted At', sortable: true, hideable: true },

  // { key: 'likedMost', label: 'Liked Most', sortable: false, hideable: true },

  // { key: 'improveFeedback', label: 'Improve Feedback', sortable: false, hideable: true },

  // { key: 'status', label: 'Status', sortable: true, hideable: true },

  // { key: 'priority', label: 'Priority', sortable: true, hideable: true },

  // { key: 'assignedAgent', label: 'Assigned Agent', sortable: true, hideable: true },

  // { key: 'createdAt', label: 'Created At', sortable: true, hideable: true, type: 'date' },
]  as SmartColumn<ClientRow>[],

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
            toDate,orgId:Utils.encode5t(this.authService.getOrgId().toString()),
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
        // { id: 'filter', type: 'filter', label: 'Filter' },
        { id: 'export', type: 'export', label: 'Export' },
        { id: 'refresh', type: 'refresh' },
        { id: 'columns', type: 'columnPicker', label: 'Columns' },
      ],
    };
  });
}
