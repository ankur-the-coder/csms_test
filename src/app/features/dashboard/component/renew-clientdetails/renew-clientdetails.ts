// import { Component, computed, inject, signal } from '@angular/core';
// import { DataTable } from '../../../../shared/components/Data-table/data-table';
// import { AuthService } from '../../../../core/services/auth-service';
// import { environment } from '../../../../../environments/environment';
// import { ActivatedRoute, Router } from '@angular/router';
// import { CommonModule, Location } from '@angular/common';
// import {
//   RequestContext,
//   SmartColumn,
//   SmartTableConfig,
// } from '../../../../shared/components/Data-table/data-table.types';
// import { Data } from '../../models/renewalModel';
// import { DashboardService } from '../../service/dashboard-service';

// // ✅ Updated Interface: IDs are strings because backend returns encoded strings
// export interface ClientRow {
//   id: string;
//   orgId: string;
//   renewId?: string;
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
//   selector: 'app-renew-clientdetails',
//   imports: [DataTable, CommonModule],
//   templateUrl: './renew-clientdetails.html',
//   styleUrl: './renew-clientdetails.css',
// })
// export class RenewClientdetails {
//   private readonly authService = inject(AuthService);
//   private clientApi = inject(DashboardService);
//   private readonly apiUrl = environment.apiUrl;
//   private route = inject(ActivatedRoute);
//   private router = inject(Router);

//   private readonly tableEndpoint = `${this.apiUrl}/fetchRenewablePlanDataByOrgId`;

//   orgName = '';
//   orgId: string = ''; // ✅ Typed as string
//   fromDate = '';
//   toDate = '';

//   loading = signal(false);
//   errorMsg = signal('');

//   tableConfig = computed<SmartTableConfig<ClientRow>>(() => {
//     return {
//       columns: [
//         { key: 'client', label: 'Client', sortable: true, hideable: false },
//         { key: 'contactPerson', label: 'Contact Person', sortable: true, hideable: false },
//         { key: 'email', label: 'Email', sortable: true, hideable: false },
//         { key: 'phone', label: 'Phone', sortable: true, hideable: false },
//         { key: 'country', label: 'Country', sortable: true, hideable: false },
//         // { key: 'renewCount', label: 'Renew Count', sortable: true, hideable: false },
//         { key: 'renewDate', label: 'Renewal Start', sortable: true, type: 'date', hideable: false },
//         { key: 'endDate', label: 'Renewal End', sortable: true, type: 'date', hideable: false },
//         {
//           key: 'PremiumDate',
//           label: 'Premium Date',
//           sortable: true,
//           type: 'date',
//           hideable: false,
//         },
//         { key: 'leadOwner', label: 'Lead Owner', sortable: true, hideable: false },
//         { key: 'supportOwner', label: 'Support Owner', sortable: true, hideable: false },
//       ] as SmartColumn<ClientRow>[],

//       apiConfig: {
//         endpoint: this.tableEndpoint,
//         dataPath: 'data',
//         totalPath: 'totalRecords',

//         buildRequest: (ctx: RequestContext) => {
//           const filterObj: Record<string, any> = { ...ctx.filters };

//           // ✅ Use table date filter if available, else fallback to query params
//           const fromDate = ctx.dateFrom ? ctx.dateFrom : this.fromDate;
//           const toDate = ctx.dateTo ? ctx.dateTo : this.toDate;

//           // ✅ Complete sort mapping matching backend expectations
//           const sortColMap: Record<string, string> = {
//             client: 'client',
//             contactPerson: 'contactPerson',
//             email: 'email',
//             phone: 'phone',
//             country: 'country',
//             renewCount: 'renewCount',
//             renewDate: 'renewDate',
//             endDate: 'endDate',
//             PremiumDate: 'PremiumDate',
//             leadOwner: 'leadOwner',
//             supportOwner: 'supportOwner',
//           };

//           const sortCol = ctx.sortKey ? (sortColMap[ctx.sortKey] ?? ctx.sortKey) : 'renewDate';

//           const body = {
//             start: ctx.page * ctx.pageSize,
//             length: ctx.pageSize,
//             search: ctx.search ?? '',
//             sorting: JSON.stringify({
//               require: ctx.sortKey ? 1 : 0,
//               col: sortCol,
//               dir: ctx.sortDir ?? 'desc', // Default to desc for dates
//             }),
//             filter: JSON.stringify(filterObj),
//             fromDate,
//             toDate,
//             orgId: this.orgId, // ✅ Fixed: Use target orgId from query params (encoded)
//             userId: this.authService.getEmpId(),
//           };

//           return { method: 'POST' as const, body };
//         },
//         transformRow: (raw: any): ClientRow | null => this.mapDatumToClientRow(raw),
//       },

//       rowIdKey: 'orgId',
//       showSearch: true,
//       showPagination: true,
//       defaultPageSize: 10,
//       pageSizeOptions: [10, 25, 50, 100, 500],
//       exportFileName: 'Renewal_Plans',
//       emptyMessage: 'No renewal plans found for this organization in the selected date range.',
//       clickable: true,
//       showDateFilter: true, // ✅ Set to true if you want users to change dates from the table
//       toolbarButtons: [
//         { id: 'date', type: 'datePicker' as const, label: 'Date' },
//         { id: 'filter', type: 'filter', label: 'Filter' },
//         { id: 'export', type: 'export', label: 'Export' },
//         { id: 'refresh', type: 'refresh' },
//         { id: 'columns', type: 'columnPicker', label: 'Columns' },
//       ],
//     };
//   });

//   private mapDatumToClientRow(raw: any): ClientRow {
//     return {
//       id: raw.renewId || raw.orgId, // Fallback to orgId if renewId is null
//       orgId: raw.orgId,
//       renewId: raw.renewId,
//       client: raw.client || '-',
//       contactPerson: raw.contactPerson || '-',
//       countryCode: raw.countryCode || '-',
//       createdDate: raw.createdDate || '-',
//       email: raw.email || '-',
//       endDate: raw.endDate || '-',
//       phone: raw.phone || '-',
//       renewDate: raw.renewDate || '-',
//       country: raw.country || '-',
//       supportOwner: raw.supportOwner || '-',
//       leadOwner: raw.leadOwner || '-',
//       PremiumDate: raw.PremiumDate || '-',
//       renewCount: raw.renewCount ? Number(raw.renewCount) : 0,
//     };
//   }

//   ngOnInit() {
//     this.route.queryParamMap.subscribe((params) => {
//       this.orgName = params.get('orgName') ?? '';
//       this.orgId = params.get('orgId') ?? ''; // ✅ Ensure it's a string

//       this.fromDate = params.get('from') ?? this.defaultRange().from;
//       this.toDate = params.get('to') ?? this.defaultRange().to;

//       if (this.orgId) {
//         // Note: If DataTable's apiConfig is handling the fetch, this manual call is redundant.
//         // You can keep it if you need to load other dashboard data simultaneously.
//         // this.loadDashboard(this.orgId);
//       }
//     });
//   }

//   private loadDashboard(orgId: string): void {
//     this.loading.set(true);
//     this.errorMsg.set('');

//     this.clientApi.fetchRenewablePlanDataByOrgId(this.fromDate, this.toDate, orgId).subscribe({
//       next: (res: any) => {
//         this.loading.set(false);
//         if (res?.status) {
//           // this.dashboardData.set(res.data);
//         } else {
//           this.errorMsg.set(res?.msg || 'Failed to load dashboard');
//         }
//       },
//       error: (err: any) => {
//         this.loading.set(false);
//         this.errorMsg.set(err?.error?.msg || 'Failed to load dashboard');
//       },
//     });
//   }

//   private defaultRange(): { from: string; to: string } {
//     const now = new Date();
//     const pad = (n: number) => String(n).padStart(2, '0');
//     const y = now.getFullYear();
//     const m = pad(now.getMonth() + 1);
//     return { from: `${y}-${m}-01`, to: `${y}-${m}-${pad(now.getDate())}` };
//   }

//   loadData() {
//     // If you need to manually trigger table reload, you can call table's reload method here
//   }

//   goBack(): void {
//     console.log('Navigating back to /renewal');
//     this.router.navigate(['/renewal']);
//   }
// }

import { Component, computed, inject, signal } from '@angular/core';
import { DataTable } from '../../../../shared/components/Data-table/data-table';
import { AuthService } from '../../../../core/services/auth-service';
import { environment } from '../../../../../environments/environment';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  RequestContext,
  SmartColumn,
  SmartTableConfig,
} from '../../../../shared/components/Data-table/data-table.types';
import { DashboardService } from '../../service/dashboard-service';

export interface ClientRow {
  id: string;
  orgId: string;
  renewId?: string;
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
  selector: 'app-renew-clientdetails',
  imports: [DataTable, CommonModule],
  templateUrl: './renew-clientdetails.html',
  styleUrl: './renew-clientdetails.css',
})
export class RenewClientdetails {
  private readonly authService = inject(AuthService);
  private readonly clientApi = inject(DashboardService);
  private readonly apiUrl = environment.apiUrl;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly tableEndpoint = `${this.apiUrl}/fetchRenewablePlanDataByOrgId`;

  orgName = '';
  orgId = '';

  // Dates received from query params
  fromDate = '';
  toDate = '';

  loading = signal(false);
  errorMsg = signal('');

  tableConfig = computed<SmartTableConfig<ClientRow>>(() => {
    return {
      columns: [
        {
          key: 'client',
          label: 'Client',
          sortable: false,
          hideable: false,
        },
        {
          key: 'contactPerson',
          label: 'Contact Person',
          sortable: false,
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
          hideable: false,
        },
        {
          key: 'country',
          label: 'Country',
          sortable: false,
          hideable: false,
        },
        {
          key: 'renewDate',
          label: 'Renewal Start',
          sortable: false,
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
          sortable: false,
          type: 'date',
          hideable: false,
        },
        {
          key: 'leadOwner',
          label: 'Lead Owner',
          sortable: false,
          hideable: false,
        },
        {
          key: 'supportOwner',
          label: 'Support Owner',
          sortable: false,
          hideable: false,
        },
      ] as SmartColumn<ClientRow>[],

      apiConfig: {
        endpoint: this.tableEndpoint,

        dataPath: 'data',

        totalPath: 'totalRecords',

        buildRequest: (ctx: RequestContext) => {
          const filterObj: Record<string, any> = {
            ...ctx.filters,
          };

          /*
           * IMPORTANT:
           * Use dates received from query params.
           *
           * Example:
           * ?from=2026-10-01&to=2026-10-14
           *
           * API will receive:
           * fromDate = 2026-10-01
           * toDate   = 2026-10-14
           */
          const fromDate = this.fromDate;
          const toDate = this.toDate;

          const sortColMap: Record<string, string> = {
            client: 'client',
            contactPerson: 'contactPerson',
            email: 'email',
            phone: 'phone',
            country: 'country',
            renewCount: 'renewCount',
            renewDate: 'renewDate',
            endDate: 'endDate',
            PremiumDate: 'PremiumDate',
            leadOwner: 'leadOwner',
            supportOwner: 'supportOwner',
          };

          const sortCol = ctx.sortKey ? (sortColMap[ctx.sortKey] ?? ctx.sortKey) : 'renewDate';

          const body = {
            // Query param dates
            fromDate: fromDate,
            toDate: toDate,

            // Target organization from query params
            orgId: this.orgId,

            userId: this.authService.getEmpId(),
          };

          console.log('Renewal Details API Request:', body);

          return {
            method: 'POST' as const,
            body,
          };
        },

        transformRow: (raw: any): ClientRow | null => {
          return this.mapDatumToClientRow(raw);
        },
      },

      rowIdKey: 'orgId',

      showSearch: false,

      showPagination: false,

      defaultPageSize: 10,

      pageSizeOptions: [10, 25, 50, 100, 500],

      exportFileName: 'Renew Client Details',

      emptyMessage: 'No renewal plans found for this organization in the selected date range.',

      clickable: true,

      showDateFilter: false,

      toolbarButtons: [
        {
          id: 'export',
          type: 'export',
          label: 'Export',
        },
        {
          id: 'refresh',
          type: 'refresh',
        },
      ],
    };
  });

  private mapDatumToClientRow(raw: any): ClientRow {
    return {
      id: raw.renewId || raw.orgId,
      orgId: raw.orgId,
      renewId: raw.renewId,
      client: raw.client || '-',
      contactPerson: raw.contactPerson || '-',
      countryCode: raw.countryCode || '-',
      createdDate: raw.createdDate || '-',
      email: raw.email || '-',
      endDate: raw.endDate || '-',
      phone: raw.phone || '-',
      renewDate: raw.renewDate || '-',
      country: raw.country || '-',
      supportOwner: raw.supportOwner || '-',
      leadOwner: raw.leadOwner || '-',
      PremiumDate: raw.PremiumDate || '-',
      renewCount: raw.renewCount ? Number(raw.renewCount) : 0,
    };
  }

  ngOnInit() {
    this.route.queryParamMap.subscribe((params) => {
      // Get organization from query params
      this.orgName = params.get('orgName') ?? '';

      this.orgId = params.get('orgId') ?? '';

      // Get dates from query params
      this.fromDate = params.get('from') ?? this.defaultRange().from;

      this.toDate = params.get('to') ?? this.defaultRange().to;

      console.log('Query Params:', {
        orgId: this.orgId,
        orgName: this.orgName,
        fromDate: this.fromDate,
        toDate: this.toDate,
      });

      if (this.orgId) {
        this.loadDashboard(this.orgId);
      }
    });
  }

  private loadDashboard(orgId: string): void {
    this.loading.set(true);

    this.errorMsg.set('');

    /*
     * API receives query-param dates here.
     */
    this.clientApi.fetchRenewablePlanDataByOrgId(this.fromDate, this.toDate, orgId).subscribe({
      next: (res: any) => {
        this.loading.set(false);

        if (res?.status) {
          // this.dashboardData.set(res.data);
        } else {
          this.errorMsg.set(res?.msg || 'Failed to load dashboard');
        }
      },

      error: (err: any) => {
        this.loading.set(false);

        this.errorMsg.set(err?.error?.msg || 'Failed to load dashboard');
      },
    });
  }

  private defaultRange(): {
    from: string;
    to: string;
  } {
    const now = new Date();

    const pad = (n: number) => String(n).padStart(2, '0');

    const y = now.getFullYear();

    const m = pad(now.getMonth() + 1);

    return {
      from: `${y}-${m}-01`,
      to: `${y}-${m}-${pad(now.getDate())}`,
    };
  }

  loadData() {}

  goBack(): void {
    this.router.navigate(['/renewal']);
  }
}
