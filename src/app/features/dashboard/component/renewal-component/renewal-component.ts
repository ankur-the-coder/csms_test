// import { Component, computed, inject, signal } from '@angular/core';
// import { ActivatedRoute, Router } from '@angular/router';
// import {
//   BulkAction,
//   RequestContext,
//   SmartColumn,
//   SmartTableConfig,
// } from '../../../../shared/components/Data-table/data-table.types';
// import { DataTable } from '../../../../shared/components/Data-table/data-table';
// import { DashboardService } from '../../service/dashboard-service';
// import { environment } from '../../../../../environments/environment';
// import { CommonModule } from '@angular/common';
// import { CustomColumnDirective } from '../../../../shared/components/Data-table/custom-column.directive';
// import { AuthService } from '../../../../core/services/auth-service';
// import { Utils } from '../../../../shared/utils/utils';
// import { Data } from '../../models/renewalModel';

// export interface ClientRow {
//   id: number;
//   orgId: number;
//   client: string;
//   contactPerson: string;
//   email: string;
//   phone: string;
//   countryCode: string;
//   renewDate: string;
//   endDate: string;
//   createdDate: string;

//   country: string;
//   leadOwner: string;
//   supportOwner: string;
//   PremiumDate: string;
//   renewCount: number;
// }

// @Component({
//   selector: 'app-renewal-component',
//   imports: [DataTable, CommonModule, CustomColumnDirective],
//   templateUrl: './renewal-component.html',
//   styleUrl: './renewal-component.css',
// })
// export class RenewalComponent {
//   private clientApi = inject(DashboardService);
//   private readonly authService = inject(AuthService);
//   private readonly apiUrl = environment.apiUrl;
//   private route = inject(ActivatedRoute);
//   private router = inject(Router);
//   private readonly tableEndpoint = `${this.apiUrl}/fetchRenewablePlanDataTable`;
//   statusFilter = signal<string>('all');
//   fromDate: string = '';
//   toDate: string = '';
//   initialDateFrom = signal('');
//   initialDateTo = signal('');

//   private getTodayDateString(): string {
//     const d = new Date();
//     const year = d.getFullYear();
//     const month = String(d.getMonth() + 1).padStart(2, '0');
//     const day = String(d.getDate()).padStart(2, '0');
//     return `${year}-${month}-${day}`;
//   }

//   private getFirstDayOfMonthString(): string {
//     const d = new Date();
//     const year = d.getFullYear();
//     const month = String(d.getMonth() + 1).padStart(2, '0');
//     return `${year}-${month}-01`;
//   }

//   private getLastDayOfMonthString(): string {
//     const d = new Date();
//     const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
//     const year = d.getFullYear();
//     const month = String(d.getMonth() + 1).padStart(2, '0');
//     const day = String(lastDay).padStart(2, '0');
//     return `${year}-${month}-${day}`;
//   }

//   ngOnInit() {
//     const params = this.route.snapshot.queryParamMap;
//     const from = params.get('from');
//     const to = params.get('to');
//     if (from && to) {
//       this.initialDateFrom.set(from);
//       this.initialDateTo.set(to);
//     } else {
//       this.initialDateFrom.set(this.getFirstDayOfMonthString());
//       this.initialDateTo.set(this.getTodayDateString());
//     }
//     this.route.queryParamMap.subscribe((params) => {
//       const from = params.get('from');
//       const to = params.get('to');
//       this.fromDate = from || '';
//       this.toDate = to || '';
//       if (from && to) {
//         this.initialDateFrom.set(from);
//         this.initialDateTo.set(to);
//       }
//     });

//     this.loadData();
//   }

//   loadData() {}

//   openClientDetails(client: ClientRow) {}

//   private mapDatumToClientRow(raw: Data): ClientRow {
//     return {
//       id: raw.id,
//       orgId: raw.orgId,
//       client: raw.client,
//       contactPerson: raw.contactPerson,
//       countryCode: raw.countryCode,
//       createdDate: raw.createdDate,

//       email: raw.email,
//       endDate: raw.endDate,
//       phone: raw.phone,
//       renewDate: raw.renewDate,
//       country: raw.country,
//       supportOwner: raw.supportOwner,
//       leadOwner: raw.leadOwner,
//       PremiumDate: raw.PremiumDate,
//       renewCount: raw.renewCount,
//     };
//   }

//   // ── Bulk action handlers ────────────────────────────────────────────────
//   private markImplementation(rows: ClientRow[], status: 'Pending' | 'Completed'): void {
//     const ids = rows.map((r) => r.orgId);
//     console.log(`Mark ${status}:`, ids);
//   }

//   private exportSelected(rows: ClientRow[]): void {
//     console.log(
//       'Export selected:',
//       rows.map((r) => r.orgId),
//     );
//   }

//   private deleteSelected(rows: ClientRow[]): void {
//     const ids = rows.map((r) => r.orgId);
//     console.log('Delete:', ids);
//   }

//   get bulkActions(): BulkAction<ClientRow>[] {
//     return [
//       // {
//       //   id: 'markCompleted',
//       //   label: 'Mark Completed',
//       //   icon: 'check',
//       //   color: '#10b981',
//       //   // now based on progress percentage instead of a status string
//       //   hidden: (rows) => rows.every(r => r.progress === 100),
//       //   onClick: (rows) => this.markImplementation(rows, 'Completed'),
//       // },
//       // {
//       //   id: 'markPending',
//       //   label: 'Mark Pending',
//       //   icon: 'circle-dot',
//       //   color: '#f59e0b',
//       //   hidden: (rows) => rows.every(r => r.progress === 0),
//       //   onClick: (rows) => this.markImplementation(rows, 'Pending'),
//       // },
//       // {
//       //   id: 'exportSelected',
//       //   label: 'Export Selected',
//       //   icon: 'download',
//       //   color: '#3b82f6',
//       //   onClick: (rows) => this.exportSelected(rows),
//       // },
//       // {
//       //   id: 'delete',
//       //   label: 'Delete',
//       //   icon: 'delete',
//       //   color: '#ef4444',
//       //   disabled: (rows) => rows.some(r => r.stage === 'PREMIUM'),
//       //   onClick: (rows) => this.deleteSelected(rows),
//       // },
//     ];
//   }

//   tableConfig = computed<SmartTableConfig<ClientRow>>(() => {
//     const statusFilter = this.statusFilter();

//     return {
//       columns: [
//         { key: 'client', label: 'Client', sortable: true, hideable: false },
//         { key: 'contactPerson', label: 'Contact Person', sortable: true, hideable: false },
//         { key: 'email', label: 'Email', sortable: false, hideable: false },
//         { key: 'phone', label: 'Phone', sortable: false },
//         { key: 'country', label: 'Country', sortable: false },
//         { key: 'renewCount', label: 'Renew Count', sortable: false },

//         { key: 'renewDate', label: 'Renewal Start', sortable: true, type: 'date', hideable: false },
//         { key: 'endDate', label: 'Renewal End', sortable: false, type: 'date', hideable: false },
//         {
//           key: 'PremiumDate',
//           label: 'Premium Date',
//           sortable: true,
//           type: 'date',
//           hideable: false,
//         },

//         { key: 'leadOwner', label: 'Lead Owner', sortable: false },
//         { key: 'supportOwner', label: 'Support Owner', sortable: false },
//         // { key: 'countryCode', label: 'Country Code', sortable: false },
//         // { key: 'orgId', label: 'Org ID', sortable: true },
//         // { key: 'renewId', label: 'Renew ID', sortable: true },
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
//             client: 'client',

//             // contactPerson: 'contactPerson',
//             // ticketCount: 'ticketCount',
//             // phone: 'phone',
//             // email: 'email',
//             // connectSts: 'connectSts',
//             // leadOwner: 'leadOwner',
//             // supportOwner: 'suppOwner',
//           };
//           const sortCol = ctx.sortKey ? (sortColMap[ctx.sortKey] ?? ctx.sortKey) : 'client';

//           const body = {
//             start: ctx.page * ctx.pageSize,
//             length: ctx.pageSize,
//             search: ctx.search ?? '',
//             sorting: JSON.stringify({
//               require: ctx.sortKey ? 1 : 0,
//               col: sortCol,
//               dir: ctx.sortDir ?? 'asc',
//             }),
//             filter: JSON.stringify(filterObj),
//             fromDate,
//             toDate,
//             orgId: this.authService.getOrgId(),
//             userId: this.authService.getEmpId(),
//             adminSts: Number(this.authService.adminSts()),
//           };

//           return { method: 'POST' as const, body };
//         },
//         transformRow: (raw: Data): ClientRow | null => this.mapDatumToClientRow(raw),
//       },

//       rowIdKey: 'orgId',
//       showSearch: true,
//       showPagination: true,

//       defaultPageSize: 10,
//       pageSizeOptions: [10, 25, 50, 100, 500],
//       exportFileName: 'Renewal Plans',
//       emptyMessage: 'No renewal plans found.',
//       clickable: true,
//       toolbarButtons: [
//         { id: 'date', type: 'datePicker' as const, label: 'Date' },
//         { id: 'filter', type: 'filter', label: 'Filter' },
//         { id: 'export', type: 'export', label: 'Export' },
//         { id: 'refresh', type: 'refresh' },
//         { id: 'columns', type: 'columnPicker', label: 'Columns' },
//       ],
//     };
//   });

//   goToClientDashboard(row: any): void {
//     console.log(row, 'row');

//     this.router.navigate(['/renewal/renewal-details'], {
//       queryParams: {
//         orgId: row.orgId,
//         orgName: row.client,
//         country: row.country,
//         from: this.fromDate || this.getTodayDateString(),
//         to: this.toDate || this.getTodayDateString(),
//       },
//     });
//   }
// }
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  BulkAction,
  RequestContext,
  SmartColumn,
  SmartTableConfig,
} from '../../../../shared/components/Data-table/data-table.types';
import { DataTable } from '../../../../shared/components/Data-table/data-table';
import { DashboardService } from '../../service/dashboard-service';
import { environment } from '../../../../../environments/environment';
import { CommonModule } from '@angular/common';
import { CustomColumnDirective } from '../../../../shared/components/Data-table/custom-column.directive';
import { AuthService } from '../../../../core/services/auth-service';
import { Data } from '../../models/renewalModel';

export interface ClientRow {
  id: number;
  orgId: number;
  client: string;
  contactPerson: string;
  email: string;
  phone: string;
  countryCode: string;
  renewDate: string;
  endDate: string;
  createdDate: string;

  country: string;
  leadOwner: string;
  supportOwner: string;
  PremiumDate: string;
  renewCount: number;
}

@Component({
  selector: 'app-renewal-component',
  imports: [DataTable, CommonModule, CustomColumnDirective],
  templateUrl: './renewal-component.html',
  styleUrl: './renewal-component.css',
})
export class RenewalComponent {
  private clientApi = inject(DashboardService);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = environment.apiUrl;
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private readonly tableEndpoint =
    `${this.apiUrl}/fetchRenewablePlanDataTable`;

  statusFilter = signal<string>('all');

  fromDate: string = '';
  toDate: string = '';

  initialDateFrom = signal('');
  initialDateTo = signal('');

  // Actual dates currently being used by the table
  tableFromDate = '';
  tableToDate = '';

  private getTodayDateString(): string {
    const d = new Date();

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private getFirstDayOfMonthString(): string {
    const d = new Date();

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');

    return `${year}-${month}-01`;
  }

  private getLastDayOfMonthString(): string {
    const d = new Date();

    const lastDay = new Date(
      d.getFullYear(),
      d.getMonth() + 1,
      0,
    ).getDate();

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(lastDay).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  ngOnInit() {
    const params = this.route.snapshot.queryParamMap;

    const from = params.get('from');
    const to = params.get('to');

    if (from && to) {
      this.initialDateFrom.set(from);
      this.initialDateTo.set(to);

      this.fromDate = from;
      this.toDate = to;

      // Initial table dates
      this.tableFromDate = from;
      this.tableToDate = to;
    } else {
      const defaultFrom = this.getFirstDayOfMonthString();
      const defaultTo = this.getTodayDateString();

      this.initialDateFrom.set(defaultFrom);
      this.initialDateTo.set(defaultTo);

      this.fromDate = defaultFrom;
      this.toDate = defaultTo;

      // Initial table dates
      this.tableFromDate = defaultFrom;
      this.tableToDate = defaultTo;
    }

    this.route.queryParamMap.subscribe((params) => {
      const from = params.get('from');
      const to = params.get('to');

      this.fromDate = from || '';
      this.toDate = to || '';

      if (from && to) {
        this.initialDateFrom.set(from);
        this.initialDateTo.set(to);
      }
    });

    this.loadData();
  }

  loadData() {}

  openClientDetails(client: ClientRow) {}

  private mapDatumToClientRow(raw: Data): ClientRow {
    return {
      id: raw.id,
      orgId: raw.orgId,
      client: raw.client,
      contactPerson: raw.contactPerson,
      countryCode: raw.countryCode,
      createdDate: raw.createdDate,

      email: raw.email,
      endDate: raw.endDate,
      phone: raw.phone,
      renewDate: raw.renewDate,
      country: raw.country,
      supportOwner: raw.supportOwner,
      leadOwner: raw.leadOwner,
      PremiumDate: raw.PremiumDate,
      renewCount: raw.renewCount,
    };
  }

  // ── Bulk action handlers ────────────────────────────────────────────────

  private markImplementation(
    rows: ClientRow[],
    status: 'Pending' | 'Completed',
  ): void {
    const ids = rows.map((r) => r.orgId);

    console.log(`Mark ${status}:`, ids);
  }

  private exportSelected(rows: ClientRow[]): void {
    console.log(
      'Export selected:',
      rows.map((r) => r.orgId),
    );
  }

  private deleteSelected(rows: ClientRow[]): void {
    const ids = rows.map((r) => r.orgId);

    console.log('Delete:', ids);
  }

  get bulkActions(): BulkAction<ClientRow>[] {
    return [
      // {
      //   id: 'markCompleted',
      //   label: 'Mark Completed',
      //   icon: 'check',
      //   color: '#10b981',
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
        {
          key: 'client',
          label: 'Client',
          sortable: true,
          hideable: false,
        },

        {
          key: 'contactPerson',
          label: 'Contact Person',
          sortable: true,
          hideable: false,
        },

        {
          key: 'email',
          label: 'Email',
          sortable: false,
          hideable: false,
        },

        {
          key: 'phone',
          label: 'Phone',
          sortable: false,
        },

        {
          key: 'country',
          label: 'Country',
          sortable: false,
        },

        {
          key: 'renewCount',
          label: 'Renew Count',
          sortable: false,
        },

        {
          key: 'renewDate',
          label: 'Renewal Start',
          sortable: true,
          type: 'date',
          hideable: false,
        },

        {
          key: 'endDate',
          label: 'Renewal End',
          sortable: false,
          type: 'date',
          hideable: false,
        },

        {
          key: 'PremiumDate',
          label: 'Premium Date',
          sortable: true,
          type: 'date',
          hideable: false,
        },

        {
          key: 'leadOwner',
          label: 'Lead Owner',
          sortable: false,
        },

        {
          key: 'supportOwner',
          label: 'Support Owner',
          sortable: false,
        },

        // {
        //   key: 'countryCode',
        //   label: 'Country Code',
        //   sortable: false,
        // },

        // {
        //   key: 'orgId',
        //   label: 'Org ID',
        //   sortable: true,
        // },

        // {
        //   key: 'renewId',
        //   label: 'Renew ID',
        //   sortable: true,
        // },
      ] as SmartColumn<ClientRow>[],

      apiConfig: {
        endpoint: this.tableEndpoint,
        dataPath: 'data',
        totalPath: 'totalRecords',

        buildRequest: (ctx: RequestContext) => {
          const filterObj: Record<string, any> = {
            ...ctx.filters,
          };

          const today = this.getTodayDateString();

          /*
           * These are the ACTUAL dates being used by the table.
           *
           * If date picker has selected dates:
           * ctx.dateFrom / ctx.dateTo will contain them.
           *
           * Otherwise today will be used.
           */
          const fromDate = ctx.dateFrom
            ? ctx.dateFrom
            : today;

          const toDate = ctx.dateTo
            ? ctx.dateTo
            : today;

          /*
           * Save the exact table dates.
           *
           * These values will be used when opening
           * the renewal details page.
           */
          this.tableFromDate = fromDate;
          this.tableToDate = toDate;

          const sortColMap: Record<string, string> = {
            client: 'client',
          };

          const sortCol = ctx.sortKey
            ? (sortColMap[ctx.sortKey] ?? ctx.sortKey)
            : 'client';

          const body = {
            start: ctx.page * ctx.pageSize,

            length: ctx.pageSize,

            search: ctx.search ?? '',

            sorting: JSON.stringify({
              require: ctx.sortKey ? 1 : 0,
              col: sortCol,
              dir: ctx.sortDir ?? 'asc',
            }),

            filter: JSON.stringify(filterObj),

            fromDate,

            toDate,

            orgId: this.authService.getOrgId(),

            userId: this.authService.getEmpId(),

            adminSts: Number(
              this.authService.adminSts(),
            ),
          };

          console.log('Table Request Date:', {
            fromDate,
            toDate,
          });

          return {
            method: 'POST' as const,
            body,
          };
        },

        transformRow: (
          raw: Data,
        ): ClientRow | null => {
          return this.mapDatumToClientRow(raw);
        },
      },

      rowIdKey: 'orgId',

      showSearch: true,

      showPagination: true,

      defaultPageSize: 10,

      pageSizeOptions: [
        10,
        25,
        50,
        100,
        500,
      ],

      exportFileName: 'Renewed Client',

      emptyMessage: 'No renewal plans found.',

      clickable: true,

      toolbarButtons: [
        {
          id: 'date',
          type: 'datePicker' as const,
          label: 'Date',
        },

        {
          id: 'filter',
          type: 'filter',
          label: 'Filter',
        },

        {
          id: 'export',
          type: 'export',
          label: 'Export',
        },

        {
          id: 'refresh',
          type: 'refresh',
        },

        {
          id: 'columns',
          type: 'columnPicker',
          label: 'Columns',
        },
      ],
    };
  });

  goToClientDashboard(row: ClientRow): void {
    console.log('Selected Row:', row);

    console.log('Table Date:', {
      from: this.tableFromDate,
      to: this.tableToDate,
    });

    this.router.navigate(
      ['/renewal/renewal-details'],
      {
        queryParams: {
          orgId: row.orgId,

          orgName: row.client,

          // country: row.country,

          // Exact dates currently used by table
          from: this.tableFromDate,

          to: this.tableToDate,
        },
      },
    );
  }
}
