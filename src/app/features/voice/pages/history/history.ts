import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataTable } from '../../../../shared/components/Data-table/data-table';
import { RequestContext, SmartTableConfig } from '../../../../shared/components/Data-table/data-table.types';
import { WebRtcVoiceService } from '../../voice.service';
import { environment } from '../../../../../environments/environment';

/** One row of the Call History table -- reshaped from the raw call_logs
 *  columns returned by GET /api/voice/history into what the grid needs. */
export interface CallHistoryRow {
  id: number;
  direction: 'inbound' | 'outbound';
  toNumber: string;
  clientName: string;
  status: string;
  duration: string;
  createdAt: string;
}

@Component({
  selector: 'app-voice-history',
  standalone: true,
  imports: [CommonModule, DataTable],
  templateUrl: './history.html',
})
export class History {
  private readonly voiceService = inject(WebRtcVoiceService);

  // Same backend the softphone itself talks to (WebRtcVoiceService.API_BASE is
  // private to the service) -- kept as its own constant here, matching the
  // pattern ClientService uses for its own baseUrl.
  private readonly voiceApiBase = `${environment.apiUrl}/api/voice`;

  readonly historyTableConfig: SmartTableConfig<CallHistoryRow> = {
    columns: [
      { key: 'clientName', label: 'Name' },
      {
        key: 'direction',
        label: 'Direction',
        type: 'badge',
        badgeMap: {
          inbound: { label: 'Inbound', color: 'info' },
          outbound: { label: 'Outbound', color: 'pink' },
        },
      },
      { key: 'toNumber', label: 'Customer Number' },
      {
        key: 'status',
        label: 'Status',
        type: 'badge',
        badgeMap: {
          initiated: { label: 'Initiated', color: 'warn' },
          ringing: { label: 'Ringing', color: 'warn' },
          answered: { label: 'Answered', color: 'good' },
          completed: { label: 'Completed', color: 'good' },
          busy: { label: 'Busy', color: 'danger' },
          no_answer: { label: 'No Answer', color: 'danger' },
          failed: { label: 'Failed', color: 'danger' },
        },
      },
      { key: 'duration', label: 'Duration' },
      { key: 'createdAt', label: 'Date', type: 'date' },
    ],

    rowIdKey: 'id',
    showSearch: true,
    showPagination: true,
    defaultPageSize: 10,
    pageSizeOptions: [10, 25, 50],
    exportFileName: 'call-history',
    emptyMessage: 'No call history yet.',
    clickable: false,

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
          { label: 'No Answer', value: 'no_answer' },
          { label: 'Failed', value: 'failed' },
        ],
      },
      {
        key: 'direction',
        label: 'Direction',
        type: 'select',
        options: [
          { label: 'Inbound', value: 'inbound' },
          { label: 'Outbound', value: 'outbound' },
        ],
      },
    ],

    toolbarButtons: [
      { id: 'filter', type: 'filter', label: 'Filter' },
      { id: 'refresh', type: 'refresh' },
    ],

    apiConfig: {
      endpoint: `${this.voiceApiBase}/history`,
      dataPath: 'data',
      totalPath: 'meta.total',

      // GET /api/voice/history?page&limit&phoneNumber&status&direction
      // (page here is 1-indexed on the backend; the table's ctx.page is
      // 0-indexed, matching the same +1 convention ClientTable/ImplementationTable use).
      buildRequest: (ctx: RequestContext) => {
        const params = new URLSearchParams();
        params.set('page', String(ctx.page + 1));
        params.set('limit', String(ctx.pageSize));
        if (ctx.search) params.set('phoneNumber', ctx.search);
        if (ctx.filters['status']) params.set('status', ctx.filters['status']);
        if (ctx.filters['direction']) params.set('direction', ctx.filters['direction']);
        return { method: 'GET' as const, query: params.toString() };
      },

      transformRow: (raw: any): CallHistoryRow | null => {
        if (!raw) return null;
        return {
          id: raw.id,
          direction: raw.direction,
          toNumber: raw.to_number,
          clientName: raw.client_name || '—',
          status: raw.status,
          duration: this.voiceService.formatDuration(Number(raw.duration) || 0),
          createdAt: raw.created_at,
        };
      },
    },
  };
}
