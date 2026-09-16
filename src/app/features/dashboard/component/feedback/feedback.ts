
// import { Component, computed, inject, signal } from '@angular/core';
// import { ActivatedRoute } from '@angular/router';

// import { BulkAction, RequestContext, SmartColumn, SmartTableConfig } from '../../../../shared/components/Data-table/data-table.types';
// import { DataTable } from "../../../../shared/components/Data-table/data-table";
// import { DashboardService } from '../../service/dashboard-service';
// import { environment } from '../../../../../environments/environment';
// import { Datum } from '../../models/feedback.model';
// import { CustomColumnDirective } from '../../../../shared/components/Data-table/custom-column.directive';
// import { CommonModule } from '@angular/common';
// import { AuthService } from '../../../../core/services/auth-service';
// import { Utils } from '../../../../shared/utils/utils';
// import { CustomDateSelector } from '../../../../shared/components/inputs/custom-date-selector/custom-date-selector';

// export interface ClientRow {
//   orgId: string;
//   id: string;
//   client: string;
//   contactPerson: string;
//   phone: string;
//   email: string;
//   ticketId: number;
//   ticketUid: string;
//   customerName: string;
//   customerPhone: string;
//   customerEmail: string;
//   subject: string;
//   rating: number;
//   ratingSubmittedAt: string;
//   likedMost: string;
//   improveFeedback: string;
//   status: string;
//   priority: string;
//   assignedAgent: string;
//   createdAt: string;
// }

// interface RatingCard {
//   stars: number;
//   count: number;
//   colorClasses: {
//     card: string;
//     icon: string;
//     star: string;
//   };
// }

// @Component({
//   selector: 'app-feedback',
//   imports: [DataTable, CustomColumnDirective, CommonModule, CustomDateSelector],
//   templateUrl: './feedback.html',
//   styleUrl: './feedback.css',
// })
// export class Feedback {
//   private clientApi = inject(DashboardService);
//   private readonly authService = inject(AuthService);
//   private route = inject(ActivatedRoute);
//   private readonly apiUrl = environment.apiUrl;
//   private readonly tableEndpoint = `${this.apiUrl}/fetchFeedbackDataTable`;

//   statusFilter = signal<string>('all');

//   initialDateFrom = signal('');
//   initialDateTo = signal('');

//   cardData = signal({
//     ratingCounts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } as Record<number, number>,
//   });

//   private ratingColorMap: Record<number, RatingCard['colorClasses']> = {
//     1: {
//       card: 'border-red-200 bg-gradient-to-br from-red-50 to-white hover:border-red-400 hover:shadow-red-500/10',
//       icon: 'bg-red-100 text-red-600',
//       star: 'text-red-400',
//     },
//     2: {
//       card: 'border-green-200 bg-gradient-to-br from-green-50 to-white hover:border-green-400 hover:shadow-green-500/10',
//       icon: 'bg-green-100 text-green-600',
//       star: 'text-green-400',
//     },
//     3: {
//       card: 'border-blue-200 bg-gradient-to-br from-blue-50 to-white hover:border-blue-400 hover:shadow-blue-500/10',
//       icon: 'bg-blue-100 text-blue-600',
//       star: 'text-blue-400',
//     },
//     4: {
//       card: 'border-yellow-200 bg-gradient-to-br from-yellow-50 to-white hover:border-yellow-400 hover:shadow-yellow-500/10',
//       icon: 'bg-yellow-100 text-yellow-600',
//       star: 'text-yellow-400',
//     },
//     5: {
//       card: 'border-purple-200 bg-gradient-to-br from-purple-50 to-white hover:border-purple-400 hover:shadow-purple-500/10',
//       icon: 'bg-purple-100 text-purple-600',
//       star: 'text-purple-400',
//     },
//     // 6: {
//     //   card: 'border-purple-200 bg-gradient-to-br from-purple-50 to-white hover:border-purple-400 hover:shadow-purple-500/10',
//     //   icon: 'bg-purple-100 text-purple-600',
//     //   star: 'text-purple-400',
//     // },

//   };

//   ratingCards = computed<RatingCard[]>(() => {
//     const counts = this.cardData().ratingCounts;
//     return [5, 4, 3, 2, 1].map(stars => ({
//       stars,
//       count: counts[stars] ?? 0,
//       colorClasses: this.ratingColorMap[stars],
//     }));
//   });

//   ngOnInit() {
//     this.route.queryParamMap.subscribe(params => {
//       const from = params.get('from');
//       const to = params.get('to');
//       if (from && to) {
//         this.initialDateFrom.set(from);
//         this.initialDateTo.set(to);
//       }
//     });

//     const orgId = Utils.encode5t(this.authService.getOrgId().toString());
//     const today = this.getTodayDateString();
//     const from = this.initialDateFrom() || today;
//     const to = this.initialDateTo() || today;

//     this.fetchDashboardCards(from, to, orgId);
//     this.loadData();
//   }

//   private getTodayDateString(): string {
//     const d = new Date();
//     const year = d.getFullYear();
//     const month = String(d.getMonth() + 1).padStart(2, '0');
//     const day = String(d.getDate()).padStart(2, '0');
//     return `${year}-${month}-${day}`;
//   }

//   loadData() { }

//   openClientDetails(client: ClientRow) { }

//   private mapDatumToClientRow(raw: Datum): ClientRow {
//     return {
//       orgId: raw.orgId,
//       id: raw.id,
//       client: raw.client,
//       contactPerson: raw.contactPerson,
//       phone: raw.phone,
//       email: raw.email,
//       ticketId: raw.ticketId,
//       ticketUid: raw.ticketUid,
//       customerName: raw.customerName,
//       customerPhone: raw.customerPhone,
//       customerEmail: raw.customerEmail,
//       subject: raw.subject,
//       rating: raw.rating,
//       ratingSubmittedAt: raw.ratingSubmittedAt,
//       likedMost: raw.likedMost,
//       improveFeedback: raw.improveFeedback,
//       status: raw.status,
//       priority: raw.priority,
//       assignedAgent: raw.assignedAgent,
//       createdAt: raw.createdAt,
//     };
//   }

//   // ── Bulk action handlers ────────────────────────────────────────────────
//   private markImplementation(rows: ClientRow[], status: 'Pending' | 'Completed'): void {
//     const ids = rows.map(r => r.orgId);
//     console.log(`Mark ${status}:`, ids);
//   }

//   private exportSelected(rows: ClientRow[]): void {
//     console.log('Export selected:', rows.map(r => r.orgId));
//   }

//   private deleteSelected(rows: ClientRow[]): void {
//     const ids = rows.map(r => r.orgId);
//     console.log('Delete:', ids);
//   }

//   get bulkActions(): BulkAction<ClientRow>[] {
//     return [];
//   }

//   tableConfig = computed<SmartTableConfig<ClientRow>>(() => {
//     return {
//       columns: [
//         { key: 'client', label: 'Client', sortable: true, hideable: true },
//         { key: 'contactPerson', label: 'Contact Person', sortable: true, hideable: true },
//         { key: 'customerName', label: 'Customer Name', sortable: true, hideable: true },
//         { key: 'phone', label: 'Customer Phone', sortable: true, hideable: true },
//         { key: 'customerEmail', label: 'Customer Email', sortable: true, hideable: true },
//         { key: 'subject', label: 'Subject', sortable: true, hideable: true },
//         { key: 'rating', label: 'Rating', sortable: true, hideable: true },
//       ] as SmartColumn<ClientRow>[],

//       apiConfig: {
//         endpoint: this.tableEndpoint,
//         dataPath: 'data',
//         totalPath: 'totalRecords',

//         buildRequest: (ctx: RequestContext) => {
//           const filterObj: Record<string, any> = { ...ctx.filters };
//           const today = this.getTodayDateString();
//           const fromDate = ctx.dateFrom ? ctx.dateFrom : today;
//           const toDate = ctx.dateTo ? ctx.dateTo : today;

//           const sortColMap: Record<string, string> = {
//             name: 'client',
//           };
//           const sortCol = ctx.sortKey ? (sortColMap[ctx.sortKey] ?? ctx.sortKey) : 'client';

//           const body = {
//             start: ctx.page * ctx.pageSize,
//             length: ctx.pageSize,
//             search: ctx.search ?? '',
//             sorting: JSON.stringify({ require: ctx.sortKey ? 1 : 0, col: sortCol, dir: ctx.sortDir ?? 'asc' }),
//             filter: JSON.stringify(filterObj),
//             fromDate,
//             toDate,
//             orgId: Utils.encode5t(this.authService.getOrgId().toString()),
//           };

//           return { method: 'POST' as const, body };
//         },

//         transformRow: (raw: Datum): ClientRow | null => this.mapDatumToClientRow(raw),
//       },

//       rowIdKey: 'orgId',
//       showSearch: true,
//       showPagination: true,
//       defaultPageSize: 10,
//       pageSizeOptions: [10, 25, 50, 100, 500],
//       exportFileName: 'client',
//       emptyMessage: 'No client records found.',
//       clickable: true,

//       toolbarButtons: [
//         { id: 'date', type: 'datePicker' as const, label: 'Date' },
//         { id: 'export', type: 'export', label: 'Export' },
//         { id: 'refresh', type: 'refresh' },
//         { id: 'columns', type: 'columnPicker', label: 'Columns' },
//       ],
//     };
//   });

//   onDateApplied(from: string, to: string): void {
//     const orgId = Utils.encode5t(this.authService.getOrgId().toString());
//     this.fetchDashboardCards(from, to, orgId);
//   }

//   private fetchDashboardCards(from: string, to: string, orgId: string): void {
//     this.clientApi.fetchFeedbackCards(from, to, orgId).subscribe({
//       next: (res: any) => {
//         if (!res?.data) {
//           return;
//         }

//         const data = res.data;

//         this.cardData.set({
//           ratingCounts: {
//             1: Number(data.rating1 ?? 0),
//             2: Number(data.rating2 ?? 0),
//             3: Number(data.rating3 ?? 0),
//             4: Number(data.rating4 ?? 0),
//             5: Number(data.rating5 ?? 0),
//             // 6: Number(data.rating6 ?? 0),
//           },
//         });
//       },
//       error: (error) => {
//         console.error('Error fetching dashboard cards:', error);
//       },
//     });
//   }

//   navigateToRating(stars: number) {
//     console.log('Navigate to rating:', stars);
//   }
// }




























































import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { BulkAction, RequestContext, SmartColumn, SmartTableConfig } from '../../../../shared/components/Data-table/data-table.types';
import { DataTable } from "../../../../shared/components/Data-table/data-table";
import { DashboardService } from '../../service/dashboard-service';
import { environment } from '../../../../../environments/environment';
import { Datum } from '../../models/feedback.model';
import { CustomColumnDirective } from '../../../../shared/components/Data-table/custom-column.directive';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../core/services/auth-service';
import { Utils } from '../../../../shared/utils/utils';
import { CustomDateSelector } from '../../../../shared/components/inputs/custom-date-selector/custom-date-selector';

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

interface RatingCard {
  stars: number;
  count: number;
  colorClasses: {
    iconBg: string;
    iconColor: string;
  };
}

@Component({
  selector: 'app-feedback',
  imports: [DataTable, CustomColumnDirective, CommonModule, CustomDateSelector],
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

  cardData = signal({
    ratingCounts: { 6: 0, 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } as Record<number, number>,
  });

  // Flat icon-badge colors only — no card border/background color needed anymore
  private ratingColorMap: Record<number, RatingCard['colorClasses']> = {
    6: { iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
    5: { iconBg: 'bg-fuchsia-100', iconColor: 'text-fuchsia-600' },
    4: { iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600' },
    3: { iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
    2: { iconBg: 'bg-green-100', iconColor: 'text-green-600' },
    1: { iconBg: 'bg-red-100', iconColor: 'text-red-600' },
  };

  ratingCards = computed<RatingCard[]>(() => {
    const counts = this.cardData().ratingCounts;
    return [6, 5, 4, 3, 2, 1].map(stars => ({
      stars,
      count: counts[stars] ?? 0,
      colorClasses: this.ratingColorMap[stars],
    }));
  });

  ngOnInit() {
    this.route.queryParamMap.subscribe(params => {
      const from = params.get('from');
      const to = params.get('to');
      if (from && to) {
        this.initialDateFrom.set(from);
        this.initialDateTo.set(to);
      }
    });

    const orgId = Utils.encode5t(this.authService.getOrgId().toString());
    const today = this.getTodayDateString();
    const from = this.initialDateFrom() || today;
    const to = this.initialDateTo() || today;

    this.fetchDashboardCards(from, to, orgId);
    this.loadData();
  }

  private getTodayDateString(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
    return [];
  }

  tableConfig = computed<SmartTableConfig<ClientRow>>(() => {
    return {
      columns: [
        { key: 'client', label: 'Client', sortable: true, hideable: true },
        { key: 'contactPerson', label: 'Contact Person', sortable: true, hideable: true },
        { key: 'customerName', label: 'Customer Name', sortable: true, hideable: true },
        { key: 'phone', label: 'Customer Phone', sortable: true, hideable: true },
        { key: 'customerEmail', label: 'Customer Email', sortable: true, hideable: true },
        { key: 'subject', label: 'Subject', sortable: true, hideable: true },
        { key: 'rating', label: 'Rating', sortable: true, hideable: true },
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
            orgId: Utils.encode5t(this.authService.getOrgId().toString()),
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
      exportFileName: 'Feetdback Data',
      emptyMessage: 'No client records found.',
      clickable: true,

      toolbarButtons: [
        { id: 'date', type: 'datePicker' as const, label: 'Date' },
        { id: 'export', type: 'export', label: 'Export' },
        { id: 'refresh', type: 'refresh' },
        { id: 'columns', type: 'columnPicker', label: 'Columns' },
      ],
    };
  });

  onDateApplied(from: string, to: string): void {
    const orgId = Utils.encode5t(this.authService.getOrgId().toString());
    this.fetchDashboardCards(from, to, orgId);
  }

  private fetchDashboardCards(from: string, to: string, orgId: string): void {
    this.clientApi.fetchFeedbackCards(from, to, orgId).subscribe({
      next: (res: any) => {
        if (!res?.data) {
          return;
        }

        const data = res.data;

        this.cardData.set({
          ratingCounts: {
            1: Number(data.rating1 ?? 0),
            2: Number(data.rating2 ?? 0),
            3: Number(data.rating3 ?? 0),
            4: Number(data.rating4 ?? 0),
            5: Number(data.rating5 ?? 0),
            6: Number(data.total ?? 0),
          },
        });
      },
      error: (error) => {
        console.error('Error fetching dashboard cards:', error);
      },
    });
  }

  navigateToRating(stars: number) {
    console.log('Navigate to rating:', stars);
  }
}
