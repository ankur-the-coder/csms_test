import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WebRtcVoiceService } from '../../voice.service';
import { DataTable } from '../../../../shared/components/Data-table/data-table';
import { RequestContext, SmartTableConfig } from '../../../../shared/components/Data-table/data-table.types';

/** One row of the Call History table -- reshaped from the raw call_logs
 *  columns returned by GET /api/voice/history into what the grid needs. */
export interface CallHistoryRow {
  id: number;
  direction: 'inbound' | 'outbound';
  toNumber: string;
  status: string;
  duration: string;
  createdAt: string;
}

@Component({
  selector: 'app-voice-softphone',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTable],
  templateUrl: './softphone.html',
  styles: [`
    .softphone-card {
      box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.08);
    }
    .pulse-ring {
      animation: pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.05); }
    }
  `]
})
export class Softphone implements OnInit, AfterViewInit, OnDestroy {
  public voiceService = inject(WebRtcVoiceService);

  /** Hidden audio element that receives the remote WebRTC stream */
  @ViewChild('remoteAudio') remoteAudioRef!: ElementRef<HTMLAudioElement>;

  dialNumber = '+13055550100';
  customerNameInput = 'John Doe (Acme Corp)';

  keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

  // ── Call History table ────────────────────────────────────────────────
  // Same backend the softphone itself talks to (VoiceService.API_BASE is
  // private to the service) -- kept as its own constant here, matching
  // the pattern ClientService uses for its own baseUrl.
  private readonly voiceApiBase = 'http://localhost:5000/api/voice';

  readonly historyTableConfig: SmartTableConfig<CallHistoryRow> = {
    columns: [
      {
        key: 'direction',
        label: 'Direction',
        type: 'badge',
        badgeMap: {
          inbound: { label: 'Inbound' },
          outbound: { label: 'Outbound' },
        },
      },
      { key: 'toNumber', label: 'Customer Number' },
      {
        key: 'status',
        label: 'Status',
        type: 'badge',
        badgeMap: {
          initiated: { label: 'Initiated' },
          ringing: { label: 'Ringing' },
          answered: { label: 'Answered' },
          completed: { label: 'Completed' },
          busy: { label: 'Busy' },
          no_answer: { label: 'No Answer' },
          failed: { label: 'Failed' },
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
          status: raw.status,
          duration: this.voiceService.formatDuration(Number(raw.duration) || 0),
          createdAt: raw.created_at,
        };
      },
    },
  };

  ngOnInit(): void {
    // Registration is deferred to ngAfterViewInit so the audio element exists first
  }

  ngAfterViewInit(): void {
    // Register the native audio element with the service BEFORE connecting,
    // so TelnyxRTC can attach the remote stream as soon as a call goes active.
    if (this.remoteAudioRef?.nativeElement) {
      this.voiceService.setRemoteAudioElement(this.remoteAudioRef.nativeElement);
    }
    // Now start the softphone registration flow
    this.voiceService.registerSoftphone();
  }

  ngOnDestroy(): void {
    this.voiceService.unregister();
  }

  appendDigit(digit: string): void {
    this.dialNumber += digit;
  }

  clearLastDigit(): void {
    if (this.dialNumber.length > 0) {
      this.dialNumber = this.dialNumber.slice(0, -1);
    }
  }

  onMakeCall(): void {
    if (!this.dialNumber) return;
    this.voiceService.makeOutboundCall(this.dialNumber, this.customerNameInput);
  }

  simulateIncomingCall(): void {
    const mockId = Math.floor(Math.random() * 1000) + 100;
    this.voiceService.receiveIncomingCall(mockId, '+18005550199', 'Sarah Jenkins (TechGlobal)');
  }
}
