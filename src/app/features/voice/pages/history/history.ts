import { Component, inject, ViewChild, TemplateRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DataTable } from '../../../../shared/components/Data-table/data-table';
import { RequestContext, SmartTableConfig } from '../../../../shared/components/Data-table/data-table.types';
import { WebRtcVoiceService } from '../../voice.service';
import { environment } from '../../../../../environments/environment';

/** One row of the Call History table -- reshaped from the raw call_logs
 *  columns returned by GET /api/voice/history into what the grid needs. */
export interface CallHistoryRow {
  id: number;
  direction: 'inbound' | 'outbound';
  customerNumber: string;
  fromNumber: string;
  toNumber: string;
  receivedOnNumber: string;
  clientName: string;
  status: string;
  duration: string;
  createdAt: string;
  userId?: string | number;
}

@Component({
  selector: 'app-voice-history',
  standalone: true,
  imports: [CommonModule, DataTable],
  templateUrl: './history.html',
})
export class History implements OnInit {
  private readonly router = inject(Router);
  private readonly voiceService = inject(WebRtcVoiceService);

  // static: true works here because ng-template elements are never actually
  // rendered/conditional in the DOM -- this resolves in time for ngOnInit,
  // which is why historyTableConfig (below) is built there instead of as a
  // field initializer: field initializers run in the constructor, before
  // ViewChild resolution, so these templates would still be undefined then.
  @ViewChild('directionCell', { static: true }) directionCellTemplate!: TemplateRef<any>;
  @ViewChild('didCell', { static: true }) didCellTemplate!: TemplateRef<any>;
  @ViewChild('statusCell', { static: true }) statusCellTemplate!: TemplateRef<any>;
  @ViewChild('dateCell', { static: true }) dateCellTemplate!: TemplateRef<any>;
  @ViewChild('durationCell', { static: true }) durationCellTemplate!: TemplateRef<any>;

  // Same backend the softphone itself talks to (WebRtcVoiceService.API_BASE is
  // private to the service) -- kept as its own constant here, matching the
  // pattern ClientService uses for its own baseUrl.
  private readonly voiceApiBase = `${environment.apiUrl}/api/voice`;

  historyTableConfig!: SmartTableConfig<CallHistoryRow>;

  callNumber(row: CallHistoryRow): void {
    const target = row.customerNumber && row.customerNumber !== '—'
      ? row.customerNumber
      : (row.direction === 'inbound' ? row.fromNumber : row.toNumber);
    if (!target) return;
    this.router.navigate(['/voice/softphone'], {
      queryParams: {
        number: target,
        name: row.clientName && row.clientName !== '—' ? row.clientName : '',
      },
    });
  }

  getCallStatusLabel(status: string): string {
    const s = (status || '').toLowerCase().trim();
    const labels: Record<string, string> = {
      initiated: 'Initiated',
      ringing: 'Ringing',
      answered: 'Answered',
      completed: 'Completed',
      busy: 'Busy',
      no_answer: 'No Answer',
      missed: 'Missed',
      rejected: 'Rejected',
      declined: 'Rejected',
      failed: 'Failed',
      canceled: 'Missed',
      cancelled: 'Missed',
    };
    return labels[s] ?? (s ? s.charAt(0).toUpperCase() + s.slice(1) : '—');
  }

  /** Status text color -- theme's subtle text tokens (success/warning/danger-text),
   *  not the saturated badge-pill colors used before. */
  getStatusTextClass(status: string): string {
    const s = (status || '').toLowerCase().trim();
    if (s === 'completed' || s === 'answered') return 'text-success-text';
    if (s === 'initiated' || s === 'ringing') return 'text-warning-text';
    return 'text-danger-text'; // busy, no_answer, missed, rejected, failed
  }

  /** Matching solid dot color for the status text above. */
  getStatusDotClass(status: string): string {
    const s = (status || '').toLowerCase().trim();
    if (s === 'completed' || s === 'answered') return 'bg-success';
    if (s === 'initiated' || s === 'ringing') return 'bg-warning';
    return 'bg-danger'; // busy, no_answer, missed, rejected, failed
  }

  ngOnInit(): void {
    // Refresh the missed-calls badge count when the agent actually opens
    // Call History -- cheap, and keeps it in sync with whatever the
    // backend currently has even if the nav badge's own refresh triggers
    // (call end events) missed something (e.g. a tab that reconnected).
    this.voiceService.fetchMissedCallsCount(); // also refreshes inboundCallsCount internally
    this.voiceService.fetchInboundCallsCount();

    this.historyTableConfig = {
    columns: [
      { key: 'clientName', label: 'Name' },
      { key: 'customerNumber', label: 'Customer Number' },
      { key: 'direction', label: 'Direction', type: 'template', cellTemplate: this.directionCellTemplate },
      // { key: 'receivedOnNumber', label: 'Line / DID', type: 'template', cellTemplate: this.didCellTemplate },
      { key: 'status', label: 'Status', type: 'template', cellTemplate: this.statusCellTemplate },
      { key: 'duration', label: 'Duration', type: 'template', cellTemplate: this.durationCellTemplate },
      { key: 'createdAt', label: 'Date', type: 'template', cellTemplate: this.dateCellTemplate },
    ],

    rowIdKey: 'id',
    showSearch: true,
    showPagination: true,
    defaultPageSize: 10,
    pageSizeOptions: [10, 25, 50],
    exportFileName: 'call-history',
    emptyMessage: 'No call history yet.',
    clickable: false,

    customRowActions: [
      {
        id: 'call',
        label: 'Call',
        icon: 'call',
        onClick: (row) => this.callNumber(row),
      },
    ],

    filters: [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { label: 'Initiated', value: 'initiated' },
          { label: 'Ringing', value: 'ringing' },
          { label: 'Answered', value: 'answered' },
          { label: 'Completed', value: 'completed' },
          { label: 'Busy', value: 'busy' },
          { label: 'Missed', value: 'no_answer' },
          { label: 'Rejected', value: 'rejected' },
          { label: 'Failed', value: 'failed' },
        ],
      },
      {
        key: 'direction',
        label: 'Direction',
        type: 'select',
        options: [
          { label: 'Incoming', value: 'inbound' },
          { label: 'Outgoing', value: 'outbound' },
        ],
      },
    ],

    toolbarButtons: [
      { id: 'filter', type: 'filter', label: 'Filter' },
      { id: 'refresh', type: 'refresh' },
    ],

    apiConfig: {
      endpoint: `${this.voiceApiBase}/history`,
      // endpoint: `http://127.0.0.1:5000/api/voice/history`,
      dataPath: 'data',
      totalPath: 'meta.total',

      // GET /api/voice/history?page&limit&phoneNumber&status&direction
      // (page here is 1-indexed on the backend; the table's ctx.page is
      // 0-indexed, matching the same +1 convention ClientTable/ImplementationTable use).
      // buildRequest: (ctx: RequestContext) => {
      //   const params = new URLSearchParams();
      //   params.set('page', String(ctx.page + 1));
      //   params.set('limit', String(ctx.pageSize));
      //   if (ctx.search) params.set('phoneNumber', ctx.search);
      //   if (ctx.filters['status']) params.set('status', ctx.filters['status']);
      //   if (ctx.filters['direction']) params.set('direction', ctx.filters['direction']);
      //   return { method: 'GET' as const, query: params.toString() };
      // },

buildRequest: (ctx: RequestContext) => {
  const params = new URLSearchParams();

  params.set('page', String(ctx.page + 1));
  params.set('limit', String(ctx.pageSize));

  const currentEmpId = localStorage.getItem('empId');
  const isAdmin = localStorage.getItem('adminSts') === '1';

  if (!isAdmin && currentEmpId) {
    params.set('userId', currentEmpId);
  }

  if (ctx.search) {
    params.set('phoneNumber', ctx.search);
  }

  if (ctx.filters['status']) {
    params.set('status', ctx.filters['status']);
  }

  if (ctx.filters['direction']) {
    params.set('direction', ctx.filters['direction']);
  }

  return {
    method: 'GET' as const,
    query: params.toString()
  };
},


      // transformRow: (raw: any): CallHistoryRow | null => {
      //   if (!raw) return null;

      //   // --- Filter out Telnyx internal SIP bridge legs ---
      //   // When an inbound call is answered via WebRTC bridge, Telnyx creates a
      //   // second outbound SIP leg (e.g. to_number = 'sip:gencredF2T5Ln1AA').
      //   // These are internal routing artifacts — not real outgoing calls.
      //   const toNum: string = raw.to_number || '';
      //   const fromNum: string = raw.from_number || '';
      //   if (toNum.startsWith('sip:') || fromNum.startsWith('sip:')) {
      //     return null;
      //   }

      //   const currentEmpId = localStorage.getItem('empId');
      //   const isAdmin = localStorage.getItem('adminSts') == '1';

      //   const rowUserId = raw.user_id ?? raw.employee_id ?? raw.userId;
      //   const isInbound = raw.direction === 'inbound';
      //   const isOutbound = raw.direction === 'outbound';
      //   const status = (raw.status || '').toLowerCase();

      //   // If not admin, apply specific user-wise filtering
      //   if (!isAdmin && currentEmpId) {
      //     // 1. Outgoing calls: only show to the user who placed the call
      //     if (isOutbound) {
      //       if (rowUserId && String(rowUserId) !== String(currentEmpId)) {
      //         return null;
      //       }
      //       if (!rowUserId) {
      //         return null;
      //       }
      //     }

      //     // 2. Incoming calls:
      //     // - If answered/completed or rejected/cut by a specific user -> only show in that user's history
      //     // - If missed / no answer / unhandled (nobody answered or cut it) -> show to everyone
      //     if (isInbound) {
      //       const isHandledBySomeone =
      //         (status === 'completed' || status === 'answered' || status === 'rejected' || status === 'declined' || status === 'busy') &&
      //         rowUserId !== null && rowUserId !== undefined && rowUserId !== '' && rowUserId !== 0 && rowUserId !== '0';

      //       if (isHandledBySomeone) {
      //         if (String(rowUserId) !== String(currentEmpId)) {
      //           return null;
      //         }
      //       }
      //     }
      //   }

      //   // Customer number: for inbound = caller (from_number), for outbound = callee (to_number)
      //   const customerNum = isInbound
      //     ? (raw.from_number || raw.to_number || '—')
      //     : (raw.to_number || raw.from_number || '—');
      //   // Line / DID: for inbound = which DID received it (to_number), for outbound = which DID dialed from (from_number)
      //   const didNum = isInbound
      //     ? (raw.to_number || '—')
      //     : (raw.from_number || '—');

      //   return {
      //     id: raw.id,
      //     direction: raw.direction,
      //     customerNumber: customerNum,
      //     fromNumber: raw.from_number || '',
      //     toNumber: raw.to_number || '',
      //     receivedOnNumber: didNum,
      //     clientName: raw.client_name || raw.customer_name || '—',
      //     status: raw.status,
      //     duration: this.voiceService.formatDuration(Number(raw.duration) || 0),
      //     createdAt: raw.created_at,
      //     userId: rowUserId,
      //   };
      // },

transformRow: (raw: any): CallHistoryRow | null => {
  if (!raw) return null;

  // Filter Telnyx internal SIP bridge legs
  const toNum: string = raw.to_number || '';
  const fromNum: string = raw.from_number || '';

  if (
    toNum.startsWith('sip:') ||
    fromNum.startsWith('sip:')
  ) {
    return null;
  }

  const rowUserId =
    raw.user_id ??
    raw.employee_id ??
    raw.userId;

  const isInbound =
    raw.direction === 'inbound';

  const customerNum = isInbound
    ? (raw.from_number || raw.to_number || '—')
    : (raw.to_number || raw.from_number || '—');

  const didNum = isInbound
    ? (raw.to_number || '—')
    : (raw.from_number || '—');

  return {
    id: raw.id,
    direction: raw.direction,
    customerNumber: customerNum,
    fromNumber: raw.from_number || '',
    toNumber: raw.to_number || '',
    receivedOnNumber: didNum,
    clientName:
      raw.client_name ||
      raw.customer_name ||
      '—',
    status: raw.status,
    duration: this.voiceService.formatDuration(
      Number(raw.duration) || 0
    ),
    createdAt: raw.created_at,
    userId: rowUserId,
  };
},



    },
    };
  }
}
