import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TelnyxRTC } from '@telnyx/webrtc';
import { environment } from '../../../environments/environment';

// ─── State Types ────────────────────────────────────────────────────────────

/** Overall softphone connection state */
export type ConnectionState =
  | 'idle'
  | 'initializing'
  | 'microphone_ready'
  | 'registering'
  | 'registered'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'Disconnected'
  | 'Connecting'
  | 'Connected'
  | 'Registered';

export type MicPermissionState = 'Granted' | 'Denied' | 'Blocked' | 'Prompt';

export interface ActiveCallInfo {
  callLogId?: number;
  providerCallId?: string;
  customerNumber: string;
  customerName?: string;
  direction: 'inbound' | 'outbound';
  status: 'dialing' | 'ringing' | 'active' | 'held' | 'ended';
  isMuted: boolean;
  isHeld: boolean;
  startTime?: Date;
  durationSeconds: number;
}

export interface VoiceNumber {
  id: number;
  phone_number: string;
  label: string | null;
  department: string | null;
  is_active: number;
  provider?: string;
  account_label?: string | null;
}

export interface AdminClient {
  orgId: number;
  name: string;
  phoneNumber: string | null;
  altPhoneNumber: string | null;
}

/** Lightweight shape for the dialer's "recent calls" quick-access strip. */
export interface RecentCall {
  number: string;
  name: string;
  date: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class WebRtcVoiceService {
  private readonly API_BASE = `${environment.apiUrl}/api/voice`;

  // ── Public Signals ──────────────────────────────────────────────────────
  readonly connectionState = signal<ConnectionState>('Disconnected');
  readonly micPermission = signal<MicPermissionState>('Prompt');
  readonly errorMessage = signal<string | null>(null);
  readonly registrationToken = signal<string | null>(null);
  readonly activeCall = signal<ActiveCallInfo | null>(null);
  readonly sseConnected = signal<boolean>(false);
  readonly lastNotification = signal<{ message: string; type: 'info' | 'success' | 'warn' | 'error' } | null>(null);
  readonly voiceNumbers = signal<VoiceNumber[]>([]);
  readonly selectedNumberId = signal<number | null>(null);
  readonly syncingNumbers = signal<boolean>(false);
  readonly adminClients = signal<AdminClient[]>([]);
  readonly loadingAdminClients = signal<boolean>(false);
  readonly missedCalls = signal<Array<{ id: string; number: string; name?: string; timestamp: Date; reason: string }>>([]);

  readonly missedCallsCount = signal<number>(0);
  /** Total inbound calls today (all statuses), used for the Call History tab badge. */
  readonly inboundCallsCount = signal<number>(0);
  /** Last number this session dialed out to, for the dialer's Redial button. Session-only (not persisted). */
  readonly lastDialedNumber = signal<{ number: string; name?: string } | null>(null);
  /** Last 5 outbound calls, fetched from call history for the dialer's quick-access strip. */
  readonly recentOutboundCalls = signal<RecentCall[]>([]);

  readonly callAnnouncement = signal<string>('');

  // ── Telnyx Balance ──────────────────────────────────────────────────────
  /** Live Telnyx available_credit, formatted as a dollar string (e.g. "12.34"). Null until first fetch. */
  readonly telnyxBalance = signal<string | null>(null);
  readonly telnyxBalanceLoading = signal<boolean>(false);
  readonly telnyxBalanceError = signal<string | null>(null);

  // ── Private State ───────────────────────────────────────────────────────
  private telnyxClient: TelnyxRTC | null = null;
  private activeRTCCall: any = null;          // TelnyxRTC Call instance
  private localStream: MediaStream | null = null;
  private remoteAudioEl: HTMLAudioElement | null = null;

  private eventSource: EventSource | null = null;
  private sseReconnectTimer: any = null;
  get currentEmployeeId(): string {
    if (this.isBrowser) {
      return localStorage.getItem('empId') || '1';
    }
    return '1';
  }
  private isIntentionallyClosed = false;
  private timerInterval: any = null;
  // Guards against stale SSE events (e.g. delayed call.answered webhook
  // arriving after the call has already been terminated). Once a callLogId
  // is in this set, all "call is alive" SSE events for it are ignored.
  private terminatedCallLogIds = new Set<number>();

  private awaitingBridgeAnswer = false;
  private ringTimeoutTimer: any = null;
  private readonly RING_TIMEOUT_MS = 60000; // tune this — 15-25s is typical
  private readonly platformId = inject(PLATFORM_ID);
  private get isBrowser(): boolean { return isPlatformBrowser(this.platformId); }
  private notifyClearTimer: any = null;
  // Dynamic tab title flashing and Browser Desktop Notification support
  private titleFlashInterval: any = null;
  private originalDocumentTitle: string = '';
  private activeDesktopNotification: Notification | null = null;
  private ringAudioCtx: AudioContext | null = null;
  private ringLoopTimer: any = null;
  private previousCallStatus: ActiveCallInfo['status'] | null = null;
  private previousCallDuration = 0;
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    if (this.isBrowser) {
      this.checkMicrophonePermissionStatus();
      this.fetchVoiceNumbers();
      this.requestNotificationPermission();
      this.fetchMissedCallsCount();
      this.initCrossTabSync();
      effect(() => {
        this.announceCallStatusChange(this.activeCall());
      });
    }
  }

  /** Cross-tab synchronization so all open browser tabs/windows immediately reflect answered or rejected calls. */
  private initCrossTabSync(): void {
    if (!this.isBrowser || typeof BroadcastChannel === 'undefined') return;
    try {
      this.broadcastChannel = new BroadcastChannel('csms_voice_cross_tab_sync');
      this.broadcastChannel.onmessage = (event: MessageEvent) => {
        this.handleCrossTabMessage(event.data);
      };
    } catch (err) {
      console.warn('[Voice][CrossTab] BroadcastChannel initialization error:', err);
    }
  }

  private broadcastCallAction(action: 'answered' | 'rejected' | 'ended', callLogId?: number, providerCallId?: string): void {
    if (!this.broadcastChannel) return;
    try {
      this.broadcastChannel.postMessage({
        type: 'VOICE_CALL_ACTION',
        action,
        callLogId: callLogId ?? this.activeCall()?.callLogId,
        providerCallId: providerCallId ?? this.activeCall()?.providerCallId,
        empId: this.currentEmployeeId,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.warn('[Voice][CrossTab] Error broadcasting call action:', err);
    }
  }

  private handleCrossTabMessage(data: any): void {
    if (!data || data.type !== 'VOICE_CALL_ACTION') return;
    const cur = this.activeCall();
    if (!cur) return;

    // If another tab answered or rejected or ended the call while this tab is showing an incoming ringing popup
    if (cur.status === 'ringing') {
      if (data.action === 'answered') {
        console.log('[Voice][CrossTab] Call was answered in another tab — closing incoming call popup');
        this.cleanupCallMedia();
        this.endCallSession();
        this.notify('Call answered in another tab', 'info');
      } else if (data.action === 'rejected' || data.action === 'ended') {
        console.log('[Voice][CrossTab] Call was declined/ended in another tab — closing incoming call popup');
        if (data.callLogId) this.terminatedCallLogIds.add(data.callLogId);
        this.cleanupCallMedia();
        this.endCallSession();
      }
    }
  }

  /** See callAnnouncement doc comment above -- this is the one place call-state announcements are decided. */
  private announceCallStatusChange(call: ActiveCallInfo | null): void {
    if (!call) {
      this.stopTitleFlashing();
      this.stopRingtone();
      if (this.previousCallStatus && this.previousCallStatus !== 'ended') {
        const durationPart = this.previousCallDuration > 0
          ? `, duration ${this.formatDuration(this.previousCallDuration)}`
          : '';
        this.callAnnouncement.set(`Call ended${durationPart}`);
      }
      this.previousCallStatus = null;
      this.previousCallDuration = 0;
      return;
    }

    if (call.status !== this.previousCallStatus) {
      switch (call.status) {
        case 'dialing':
          this.callAnnouncement.set(`Calling ${call.customerName || call.customerNumber}`);
          break;
        case 'ringing':
          this.callAnnouncement.set(
            call.direction === 'inbound'
              ? `Incoming call from ${call.customerName || call.customerNumber}`
              : 'Ringing'
          );
          if (call.direction === 'inbound') {
            this.showInboundDesktopNotification(call.customerName || '', call.customerNumber);
            this.startRingtone();
          }
          break;
        case 'active':
          this.stopTitleFlashing();
          this.stopRingtone();
          this.callAnnouncement.set('Call answered');
          break;
        case 'held':
          this.callAnnouncement.set('Call on hold');
          break;
      }
      this.previousCallStatus = call.status;
    }
    this.previousCallDuration = call.durationSeconds;
  }

  /** Prompts the browser for desktop notification permission if not already granted/denied. */
  public async requestNotificationPermission(): Promise<void> {
    if (!this.isBrowser || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (e) {
        console.warn('[Voice][Notification] Permission request error:', e);
      }
    }
  }

  /** Triggers a browser desktop notification when an incoming call arrives while tab is not focused or visible. */
  private showInboundDesktopNotification(callerName: string, callerNumber: string): void {
    if (!this.isBrowser) return;

    // Start title flashing for all unfocused/background tabs
    this.startTitleFlashing(`📞 INCOMING CALL: ${callerName || callerNumber}`);

    // If browser supports Notifications and permission is granted
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        if (this.activeDesktopNotification) {
          this.activeDesktopNotification.close();
        }

        const title = `📞 Incoming Call from ${callerName || callerNumber}`;
        const options: any = {
          body: `Call from ${callerNumber}. Click to open softphone.`,
          icon: '/favicon.ico',
          tag: 'inbound-voice-call',
          requireInteraction: true,
          renotify: true,
        };

        const notification = new Notification(title, options);
        this.activeDesktopNotification = notification;

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (err) {
        console.warn('[Voice][Notification] Failed to show desktop notification:', err);
      }
    }
  }


  private startRingtone(): void {
    if (!this.isBrowser || this.ringAudioCtx) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ringAudioCtx = new AudioCtx();
      if (this.ringAudioCtx.state === 'suspended') {
        this.ringAudioCtx.resume().catch(() => {
          console.warn('[Voice][Ringtone] AudioContext resume was blocked -- ringtone may be silent until the next click/keypress on the page.');
        });
      }

      const playBurst = () => {
        const ctx = this.ringAudioCtx;
        if (!ctx) return;

        const gain = ctx.createGain();
        gain.gain.value = 0.15; // audible but not jarring
        gain.connect(ctx.destination);

        const osc1 = ctx.createOscillator();
        osc1.frequency.value = 440;
        osc1.connect(gain);

        const osc2 = ctx.createOscillator();
        osc2.frequency.value = 480;
        osc2.connect(gain);

        const now = ctx.currentTime;
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 2); // 2s "on" burst
        osc2.stop(now + 2);
      };

      playBurst();
      // Repeats every 6s (2s ring + 4s silence) to match the cadence above.
      this.ringLoopTimer = setInterval(playBurst, 6000);
    } catch (e) {
      console.warn('[Voice][Ringtone] Could not start ringtone (Web Audio unavailable):', e);
    }
  }

  private stopRingtone(): void {
    if (this.ringLoopTimer) {
      clearInterval(this.ringLoopTimer);
      this.ringLoopTimer = null;
    }
    if (this.ringAudioCtx) {
      try { this.ringAudioCtx.close(); } catch { /* ignore */ }
      this.ringAudioCtx = null;
    }
  }

  /** Flashes browser document title dynamically (e.g. 📞 INCOMING CALL...) */
  private startTitleFlashing(flashText: string): void {
    if (!this.isBrowser) return;
    if (!this.originalDocumentTitle) {
      this.originalDocumentTitle = document.title || 'Client Management System';
    }
    this.stopTitleFlashing();

    let step = 0;
    this.titleFlashInterval = setInterval(() => {
      document.title = step % 2 === 0 ? flashText : `🔔 ${this.originalDocumentTitle}`;
      step++;
    }, 1000);
  }

  /** Stops flashing document title and restores original tab title */
  private stopTitleFlashing(): void {
    if (!this.isBrowser) return;
    if (this.titleFlashInterval) {
      clearInterval(this.titleFlashInterval);
      this.titleFlashInterval = null;
    }
    if (this.originalDocumentTitle) {
      document.title = this.originalDocumentTitle;
    }
    if (this.activeDesktopNotification) {
      this.activeDesktopNotification.close();
      this.activeDesktopNotification = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DID NUMBERS (voice_numbers, synced from Telnyx)
  // ─────────────────────────────────────────────────────────────────────────

  /** Loads currently synced voice_numbers rows and auto-selects the first active one. */
  async fetchVoiceNumbers(): Promise<void> {
    try {
      const res = await fetch(`${this.API_BASE}/numbers`);
      const data = await res.json();
      const list: VoiceNumber[] = data.data || [];
      this.voiceNumbers.set(list);

      // Keep the current selection if it's still in the list; otherwise
      // fall back to the first active number.
      const stillValid = list.some(n => n.id === this.selectedNumberId());
      if (!stillValid) {
        const firstActive = list.find(n => n.is_active) || list[0];
        this.selectedNumberId.set(firstActive?.id ?? null);
      }
    } catch (err: any) {
      console.warn('[Voice][Numbers] Failed to fetch numbers:', err.message);
    }
  }

  /** Pulls DIDs from Telnyx into voice_numbers, then refreshes the local list. */
  async syncNumbersFromTelnyx(): Promise<void> {
    this.syncingNumbers.set(true);
    this.errorMessage.set(null);
    try {
      const res = await fetch(`${this.API_BASE}/numbers/sync`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.status) throw new Error(data.message || 'Sync failed');

      this.notify(
        `Synced ${data.total} number(s) from Telnyx (${data.created} new, ${data.updated} updated)`,
        'success'
      );
      await this.fetchVoiceNumbers();
    } catch (err: any) {
      this.errorMessage.set(`Number sync failed: ${err.message}`);
    } finally {
      this.syncingNumbers.set(false);
    }
  }

  selectNumber(id: number): void {
    this.selectedNumberId.set(id);
  }


  async fetchAdminClients(
    search: string = '',
    length: number = 25,
    start: number = 0,
    statusFilter: string | string[] = [],
    sorting?: { col: string; dir: 'asc' | 'desc' }
  ): Promise<void> {
    this.loadingAdminClients.set(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('length', String(length));
      params.set('start', String(start));

      if (statusFilter && statusFilter.length > 0) {
        const filterValue = Array.isArray(statusFilter) ? statusFilter.join(',') : statusFilter;
        params.set('statusFilter', filterValue);
      }

      if (sorting) {
        params.set('sorting', JSON.stringify({ require: 1, col: sorting.col, dir: sorting.dir }));
      }

      const res = await fetch(`${this.API_BASE}/admin-clients?${params.toString()}`);
      const json = await res.json();
      this.adminClients.set(json.data || []);
    } catch (err: any) {
      console.warn('[Voice][AdminClients] Failed to fetch admin clients:', err.message);
    } finally {
      this.loadingAdminClients.set(false);
    }
  }

  async fetchRecentCalls(limit: number = 5): Promise<void> {
    try {
      const rowFetchLimit = Math.max(limit * 10, 50);
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('limit', String(rowFetchLimit));
      params.set('direction', 'outbound');
       const isAdmin = localStorage.getItem('adminSts') == '1';
  if (!isAdmin) {
    const empId = localStorage.getItem('empId');
    if (empId) params.set('userId', empId);
  }
      const res = await fetch(`${this.API_BASE}/history?${params.toString()}`);
      const json = await res.json();
      const rows: any[] = json.data || [];

      const seenNumbers = new Set<string>();
      const unique: RecentCall[] = [];
      for (const r of rows) {
        const number = r.to_number || '';
        if (!number || seenNumbers.has(number)) continue;
        seenNumbers.add(number);
        unique.push({
          number,
          name: r.client_name || '',
          date: r.created_at || '',
        });
        if (unique.length >= limit) break;
      }

      this.recentOutboundCalls.set(unique);
    } catch (err: any) {
      console.warn('[Voice][RecentCalls] Failed to fetch recent calls:', err.message);
    }
  }

  /** The E.164 number currently selected in the DID dropdown, used as callerNumber for outbound calls. */
  get selectedCallerNumber(): string | null {
    const n = this.voiceNumbers().find(v => v.id === this.selectedNumberId());
    return n?.phone_number || null;
  }

  async fetchMissedCallsCount(): Promise<void> {
    try {
      const res = await fetch(`${this.API_BASE}/missed-calls-count`);
      const json = await res.json();
      if (json.status && json.data) {
        this.missedCallsCount.set(Number(json.data.count) || 0);
      }
    } catch (err: any) {
      console.warn('[Voice][MissedCalls] Failed to fetch missed calls count:', err.message);
    }
    // Also refresh total inbound calls count for the badge
    await this.fetchInboundCallsCount();
  }

  /** Fetch total inbound calls today (all statuses) for the Call History tab badge. */
  async fetchInboundCallsCount(): Promise<void> {
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('limit', '1'); // we only need the total count from meta
      params.set('direction', 'inbound');
      // Scope to today
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      params.set('dateFrom', `${yyyy}-${mm}-${dd}`);
      params.set('dateTo', `${yyyy}-${mm}-${dd}`);

      const isAdmin = localStorage.getItem('adminSts') == '1';
      if (!isAdmin) {
        const empId = localStorage.getItem('empId');
        if (empId) params.set('userId', empId);
      }

      const res = await fetch(`${this.API_BASE}/history?${params.toString()}`);
      const json = await res.json();
      if (json.status !== false) {
        // If backend returns meta.total, use it; otherwise count data array length
        const total = json.meta?.total ?? json.meta?.count ?? (json.data?.length || 0);
        this.inboundCallsCount.set(Number(total) || 0);
      }
    } catch (err: any) {
      console.warn('[Voice][InboundCount] Failed to fetch inbound calls count:', err.message);
    }
  }


  notify(message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
    this.lastNotification.set({ message, type });
    if (this.notifyClearTimer) clearTimeout(this.notifyClearTimer);
    this.notifyClearTimer = setTimeout(() => {
      this.lastNotification.set(null);
    }, 3000);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AUDIO ELEMENT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Called from VoiceComponent with the #remoteAudio ViewChild reference.
   * Must be called before registerSoftphone().
   */
  setRemoteAudioElement(el: HTMLAudioElement): void {
    this.remoteAudioEl = el;
    console.log('[Voice][Media] Remote audio element registered.');
    this.wireRemoteAudioActiveDetection();
  }


  private wireRemoteAudioActiveDetection(): void {
    if (!this.remoteAudioEl || (this.remoteAudioEl as any).__activeDetectionWired) return;
    (this.remoteAudioEl as any).__activeDetectionWired = true;

    this.remoteAudioEl.addEventListener('playing', () => {
      console.log('[Voice][Call] Remote audio element fired "playing" (early media/audio started playing).');
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MICROPHONE
  // ─────────────────────────────────────────────────────────────────────────

  async checkMicrophonePermissionStatus(): Promise<MicPermissionState> {
    try {
      if (navigator.permissions?.query) {
        const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        this.micPermission.set(status.state === 'granted' ? 'Granted' : status.state === 'denied' ? 'Denied' : 'Prompt');
        status.onchange = () => {
          this.micPermission.set(status.state === 'granted' ? 'Granted' : status.state === 'denied' ? 'Denied' : 'Prompt');
        };
      }
    } catch { /* Permissions API not supported */ }
    return this.micPermission();
  }

  /**
   * Requests real microphone access. No silent fallback.
   * Returns true if microphone is available, false otherwise.
   */
  async requestMicrophonePermission(): Promise<boolean> {
    if (!this.isBrowser) return false;
    console.log('[Voice][Audio] Microphone permission requested');
    try {
      if (this.localStream && this.localStream.getAudioTracks().some(track => track.readyState === 'live')) {
        console.log('[Voice][Audio] Reusing active microphone stream');
        return true;
      }
      if (this.localStream) {
        console.log('[Voice][Audio] Stopping old microphone stream tracks before re-acquiring');
        this.localStream.getTracks().forEach(t => t.stop());
        this.localStream = null;
      }
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.micPermission.set('Granted');
      this.errorMessage.set(null);
      console.log('[Voice][Audio] Microphone acquired');
      return true;
    } catch (error: any) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        this.micPermission.set('Denied');
        this.errorMessage.set('Microphone permission was denied. Please allow microphone access in your browser settings.');
        console.error('[Voice][Audio] Microphone unavailable — permission denied');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        this.micPermission.set('Blocked');
        this.errorMessage.set('Microphone/input device not found. Please connect a microphone to use the softphone.');
        console.error('[Voice][Audio] Microphone unavailable — no device found');
      } else {
        this.micPermission.set('Blocked');
        this.errorMessage.set(`Microphone error: ${error.message}`);
        console.error('[Voice][Audio] Microphone unavailable —', error.message);
      }
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REGISTRATION / WEBRTC SESSION
  // ─────────────────────────────────────────────────────────────────────────


  async registerSoftphone(): Promise<void> {
    if (!this.isBrowser) return;
    if (
      this.telnyxClient ||
      this.connectionState() === 'registering' ||
      this.connectionState() === 'Registered' ||
      this.connectionState() === 'registered' ||
      this.connectionState() === 'initializing'
    ) {
      console.log('[Voice][WebRTC] Softphone client registration already active or ready. Ignoring duplicate call.');
      return;
    }

    this.connectionState.set('Connecting');
    this.errorMessage.set(null);
    this.connectionState.set('initializing');
    const micOk = await this.requestMicrophonePermission();
    if (!micOk) {
      console.warn('[Voice][WebRTC] Microphone unavailable — continuing registration without it. Calls will be blocked until a mic is available.');
    }

    // Step 2: Fetch real WebRTC JWT from backend
    let token: string;
    let sipUsername: string;

    console.log('[Voice][WebRTC] Fetching WebRTC token from backend...');
    try {
      const res = await fetch(`${this.API_BASE}/token?employeeId=${encodeURIComponent(this.currentEmployeeId)}`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `Token endpoint returned HTTP ${res.status}`);
      }
      const json = await res.json();
      token = json.data?.token;
      sipUsername = json.data?.sipUsername;

      if (!token) {
        throw new Error('Backend returned no token. Check TELNYX_CONNECTION_ID configuration.');
      }
      console.log('[Voice][WebRTC] JWT token received for sip_username:', sipUsername);
    } catch (err: any) {
      this.connectionState.set('error');
      this.errorMessage.set(`Unable to initialize browser calling: ${err.message}`);
      console.error('[Voice][WebRTC] Token fetch failed:', err.message);
      return;
    }

    this.registrationToken.set(token);

    // Step 3: Initialize TelnyxRTC client
    console.log('[Voice][WebRTC] Initializing TelnyxRTC client...');
    this.connectionState.set('registering');

    try {
      // Destroy any previous client
      if (this.telnyxClient) {
        (this.telnyxClient as any).disconnect();
        this.telnyxClient = null;
      }

      this.telnyxClient = new TelnyxRTC({
        login_token: token,   // JWT-based auth (preferred over login/password)
        debug: false,
      });

      // ── TelnyxRTC Event Handlers ──────────────────────────────────────

      this.telnyxClient.on('telnyx.ready', () => {
        console.log('[Voice][WebRTC] Connected — TelnyxRTC is ready');
        this.connectionState.set('Registered');
        this.errorMessage.set(null);
      });

      this.telnyxClient.on('telnyx.error', (error: any) => {
        const msg = error?.error?.message || error?.message || JSON.stringify(error);
        console.error('[Voice][WebRTC] TelnyxRTC error:', msg);
        if (msg.includes('hang up') || msg.includes('CALL DOES NOT EXIST') || msg.includes('bye failed') || msg.includes('cleanly')) {
          console.warn('[Voice][WebRTC] Ignored expected hangup/bye error:', msg);
          return;
        }
        this.connectionState.set('error');
        this.errorMessage.set(`Browser calling error: ${msg}`);
      });

      this.telnyxClient.on('telnyx.socket.close', () => {
        console.warn('[Voice][WebRTC] Disconnected — WebSocket closed');
        if (this.connectionState() === 'Registered' || this.connectionState() === 'registered') {
          this.connectionState.set('Disconnected');
        }
      });

      this.telnyxClient.on('telnyx.notification', (notification: any) => {
        this.handleTelnyxNotification(notification);
      });

      // Step 4: Connect (triggers SIP registration)
      console.log('[Voice][WebRTC] Connecting...');
      this.telnyxClient.connect();

    } catch (err: any) {
      this.connectionState.set('error');
      this.errorMessage.set(`TelnyxRTC initialization failed: ${err.message}`);
      console.error('[Voice][WebRTC] Failed:', err.message);
      return;
    }

    // Step 5: SSE for call state signaling
    this.initSSE(this.currentEmployeeId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TELNYX NOTIFICATION HANDLER (WebRTC call state)
  // ─────────────────────────────────────────────────────────────────────────

  private handleTelnyxNotification(notification: any): void {
    const call = notification?.call;
    const type = notification?.type;

    console.log('[Voice][WebRTC] Notification:', type, call?.state);

    switch (type) {
      case 'callUpdate': {
        if (!call) return;
        const state: string = call.state;

        // Extract provider call ID from Telnyx Call object
        const providerCallId = call.call_control_id || call.id || call.telnyxIDs?.callId;
        if (providerCallId && this.activeCall()?.callLogId && !this.activeCall()?.providerCallId) {
          const cur = this.activeCall();
          if (cur) this.activeCall.set({ ...cur, providerCallId });
          this.attachProviderCallIdToBackend(providerCallId);
        }
        if (state === 'ringing') {
          const fromNumber = call.options?.remoteCallerNumber || 'Unknown';
          const direction = call.options?.direction || 'inbound';
          const cur = this.activeCall();
          const isBusy = !!cur && cur.status !== 'ended';

          if (cur && cur.direction === 'outbound') {
            // Explicitly handle outbound calls when PSTN reports 180 Ringing / 183 Session Progress
            console.log('[Voice][Call] Outbound call is now ringing target phone');
            this.activeCall.set({ ...cur, status: 'ringing' });
          } else if (this.awaitingBridgeAnswer) {
            this.activeRTCCall = call;
            this.awaitingBridgeAnswer = false;
            console.log('[Voice][Call] Bridged WebRTC leg is ringing -- auto-accepting (agent already answered via REST).');
            this.autoAcceptBridgedCall(call);
          } else if (direction === 'inbound' && !isBusy) {
            // Genuinely idle -- this is a new inbound call.
            this.activeRTCCall = call;
            this.activeCall.set({
              providerCallId: call.id,
              customerNumber: fromNumber,
              customerName: call.options?.remoteCallerName || undefined,
              direction: 'inbound',
              status: 'ringing',
              isMuted: false,
              isHeld: false,
              durationSeconds: 0,
            });
          } else if (direction === 'inbound' && isBusy) {
            console.warn('[Voice][Call] Second inbound call rang while already busy -- ignoring at the WebRTC layer (SSE path handles the missed-call UI).');
          }
        }

        if (state === 'active') {
          // Both sides connected — wire up remote audio
          console.log('[Voice][Call] Call state changed → active');
          this.clearRingTimeout(); // ← add this — call is genuinely answered, stop the countdown
          this.attachRemoteAudio(call);
          const cur = this.activeCall();
          if (cur) {
            this.activeCall.set({ ...cur, status: 'active', startTime: new Date() });
            this.startTimer();
          }
        }
        if (state === 'hangup' || state === 'destroy' || state === 'purge') {
          this.clearRingTimeout(); // ← add this

          const cause: string = (call.cause || '').toLowerCase();
          console.log('[Voice][Call] Terminal state:', state, 'cause:', cause);

          const unansweredCauses = ['rejected', 'userbusy', 'user_busy', 'noanswer', 'originatorcancel', 'timeout', 'busy'];
          const explicitStatus = unansweredCauses.some(c => cause.includes(c)) ? 'no_answer' : 'completed';

          // Immediately log to backend before clearing local activeCall state
          this.logCallEndToBackend(explicitStatus);
          this.endCallSession();

          // Only attempt SDK hangup on first terminal state
          if (state === 'hangup') {
            this.cleanupCallMedia();
          }
          return;
        }
        if (state === 'held') {
          const cur = this.activeCall();
          if (cur) this.activeCall.set({ ...cur, status: 'held', isHeld: true });
        }

        break;
      }

      case 'participantData': {
        // Inbound call ringing in browser
        if (!call) return;
        console.log('[Voice][Call] Inbound call notification received');
        const fromNumber = call.options?.remoteCallerNumber || call.options?.destinationNumber || 'Unknown';
        const fromName = call.options?.remoteCallerName || undefined;

        if (this.awaitingBridgeAnswer) {
          this.awaitingBridgeAnswer = false;
          console.log('[Voice][Call] Bridged WebRTC leg (participantData) -- auto-accepting.');
          this.autoAcceptBridgedCall(call);
          break;
        }

        const existing = this.activeCall();
        if (!existing || existing.status === 'ended') {
          this.activeRTCCall = call;
          this.activeCall.set({
            providerCallId: call.id,
            customerNumber: fromNumber,
            customerName: fromName,
            direction: 'inbound',
            status: 'ringing',
            isMuted: false,
            isHeld: false,
            durationSeconds: 0,
          });
        }
        break;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REMOTE AUDIO
  // ─────────────────────────────────────────────────────────────────────────

  private attachRemoteAudio(call: any): void {
    // Check multiple locations for the remote stream: direct stream, options stream, peer stream, or fallback to peerConnection receivers
    const remoteStream: MediaStream | undefined =
      call.remoteStream ||
      call.options?.remoteStream ||
      call.peer?.remoteStream ||
      (call.peerConnection && call.peerConnection.getReceivers && new MediaStream(call.peerConnection.getReceivers().map((r: any) => r.track).filter(Boolean)));

    if (!remoteStream) {
      console.warn('[Voice][Media] No remote stream on call object yet — relying on remoteElement auto-attach');
      return;
    }

    if (this.remoteAudioEl) {
      // Prevent resetting the stream if it's already assigned to avoid audio glitched restarts
      if (this.remoteAudioEl.srcObject !== remoteStream) {
        this.remoteAudioEl.srcObject = remoteStream;
      }
      this.remoteAudioEl.play().then(() => {
        console.log('[Voice][Media] Remote audio attached and playing');
      }).catch((e: any) => {
        console.warn('[Voice][Media] Remote audio autoplay blocked, will play on next user gesture:', e.message);
        // Attach a one-shot click handler to unblock autoplay
        const resume = () => {
          this.remoteAudioEl?.play().catch(() => { });
          document.removeEventListener('click', resume);
        };
        document.addEventListener('click', resume, { once: true });
      });
    } else {
      console.warn('[Voice][Media] No remoteAudioEl registered — call setRemoteAudioElement() from component');
    }
  }


  private diagnosePeerConnectionAudio(label: string): void {
    setTimeout(() => {
      const call: any = this.activeRTCCall;
      if (!call) {
        console.warn(`[Voice][Debug][${label}] No activeRTCCall to inspect.`);
        return;
      }

      const pc: RTCPeerConnection | undefined =
        call.peerConnection ||
        call.peer?.instance ||
        call.options?.peer?.instance ||
        call.session?.peerConnection;

      if (!pc) {
        console.warn(`[Voice][Debug][${label}] Could not locate RTCPeerConnection on activeRTCCall. Inspect this.activeRTCCall in devtools manually.`, call);
        return;
      }

      const senders = pc.getSenders();
      const audioSenders = senders.filter(s => s.track?.kind === 'audio');

      console.log(`[Voice][Debug][${label}] All senders:`, senders.map(s => ({
        kind: s.track?.kind ?? '(no track)',
        readyState: s.track?.readyState,
        enabled: s.track?.enabled,
        muted: s.track?.muted,
      })));

      if (audioSenders.length === 0) {
        console.error(`[Voice][Debug][${label}] NO AUDIO SENDER FOUND — local mic track was never attached to the peer connection. This is the outbound-audio bug.`);
      } else {
        audioSenders.forEach((s, i) => {
          if (!s.track || s.track.readyState !== 'live' || !s.track.enabled) {
            console.error(`[Voice][Debug][${label}] Audio sender #${i} exists but track is not live/enabled:`, {
              hasTrack: !!s.track,
              readyState: s.track?.readyState,
              enabled: s.track?.enabled,
              muted: s.track?.muted,
            });
          } else {
            console.log(`[Voice][Debug][${label}] Audio sender #${i} looks healthy (live + enabled). If the far end still can't hear you, check chrome://webrtc-internals for outbound-rtp packetsSent — this points to a network/NAT/TURN issue, not this code.`);
          }
        });
      }

      // ICE connection state is also worth surfacing here — a stuck
      // 'checking' or 'disconnected' state points to NAT/firewall issues.
      console.log(`[Voice][Debug][${label}] iceConnectionState=${pc.iceConnectionState}, connectionState=${(pc as any).connectionState}`);
    }, 2000);
  }

  private cleanupCallMedia(): void {
    const callToHangup = this.activeRTCCall;
    this.activeRTCCall = null; // clear immediately

    if (callToHangup && typeof callToHangup.hangup === 'function') {
      const state = callToHangup.state;
      const cause = (callToHangup.cause || '').toLowerCase();
      const alreadyEnded = ['hangup', 'destroy', 'ended'].includes(state)
        || ['user_busy', 'userbusy', 'rejected', 'busy'].includes(cause);

      if (!alreadyEnded) {
        try { callToHangup.hangup(); } catch { /* ignore */ }
      }
    }

    // Always clean audio element
    if (this.isBrowser && this.remoteAudioEl) {
      try {
        this.remoteAudioEl.pause();
        this.remoteAudioEl.srcObject = null;
      } catch { /* ignore */ }
    }
  }
  private startRingTimeout(): void {
    this.clearRingTimeout(); // safety, in case one is somehow already running

    this.ringTimeoutTimer = setTimeout(() => {
      const cur = this.activeCall();
      // Only force-end if we're still waiting — if it already went active,
      // this timer should have been cleared already, but double-check
      // status here as a belt-and-suspenders guard against a race.
      if (cur && (cur.status === 'dialing' || cur.status === 'ringing')) {
        console.warn('[Voice][Call] Ring timeout hit — forcing hangup (no answer within', this.RING_TIMEOUT_MS / 1000, 's).');
        this.logCallEndToBackend('no_answer');

        if (this.activeRTCCall && typeof this.activeRTCCall.hangup === 'function') {
          try { this.activeRTCCall.hangup(); } catch { /* ignore */ }
        }

        this.cleanupCallMedia();
        this.endCallSession();
        this.notify('No answer — call ended after timeout', 'warn');
      }
    }, this.RING_TIMEOUT_MS);
  }

  private clearRingTimeout(): void {
    if (this.ringTimeoutTimer) {
      clearTimeout(this.ringTimeoutTimer);
      this.ringTimeoutTimer = null;
    }
  }
  // ─────────────────────────────────────────────────────────────────────────
  // OUTBOUND CALL
  // ─────────────────────────────────────────────────────────────────────────

  async makeOutboundCall(phoneNumber: string, customerName?: string): Promise<void> {
    if (this.connectionState() !== 'Registered') {
      this.errorMessage.set('Browser softphone must be registered before placing calls.');
      return;
    }
    if (!this.telnyxClient) {
      this.errorMessage.set('TelnyxRTC client is not initialized.');
      return;
    }
    // Registration no longer guarantees a working mic (see registerSoftphone).
    // Check it explicitly here so a missing/blocked device fails fast with a
    // clear message instead of surfacing as a raw getUserMedia error further
    // down inside the try block below.
    if (this.micPermission() === 'Blocked' || this.micPermission() === 'Denied') {
      this.errorMessage.set('Microphone is unavailable. Connect a microphone (or grant permission) before placing a call.');
      return;
    }

    this.errorMessage.set(null);
    this.activeCall.set({
      customerNumber: phoneNumber,
      customerName: customerName || undefined,
      direction: 'outbound',
      status: 'dialing',
      isMuted: false,
      isHeld: false,
      durationSeconds: 0,
    });

    console.log('[Voice][Call] Call requested to:', phoneNumber);
    this.lastDialedNumber.set({ number: phoneNumber, name: customerName });

    // Use the DID selected in the dropdown; fall back to the hardcoded
    // number only if nothing has synced/loaded yet, so a fresh page load
    // before fetchVoiceNumbers() resolves doesn't hard-fail the call.
    const callerNumber = this.selectedCallerNumber || '+14029489500';
    if (!this.selectedCallerNumber) {
      console.warn('[Voice][Call] No DID selected from voice_numbers -- falling back to hardcoded number. Sync/select a number first.');
    }


    await this.logOutboundCallToBackend(phoneNumber, callerNumber);
    try {
      // Fix 1 & 2: Re-acquire fresh mic stream specifically for this call
      console.log('[Voice][Audio] Acquiring fresh mic stream for outbound call');
      if (this.localStream) {
        this.localStream.getTracks().forEach(t => t.stop());
      }

      const freshStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.localStream = freshStream;

      const audioTracks = this.localStream.getAudioTracks();
      console.log('[Voice][Debug] Outbound Mic tracks:', audioTracks.map(t => ({ label: t.label, enabled: t.enabled, muted: t.muted, readyState: t.readyState })));

      // Place the call through TelnyxRTC — this dials via the SIP Connection
      // which is linked to the Telnyx network and routes to PSTN.
      this.activeRTCCall = this.telnyxClient.newCall({
        destinationNumber: phoneNumber,
        callerNumber: callerNumber,
        audio: true,
        video: false,
        // Attach remote audio automatically to our audio element
        remoteElement: this.remoteAudioEl || undefined,
        // Attach local microphone stream
        localStream: this.localStream,
      });

      console.log('[Voice][Media] Local audio track added, outbound call initiated');
      this.startRingTimeout();


      const sdkCallId = (this.activeRTCCall as any)?.id || (this.activeRTCCall as any)?.telnyxIDs?.callId;
      if (sdkCallId) {
        this.attachProviderCallIdToBackend(sdkCallId);
      }

      // DEBUG: verify the mic track actually landed on the peer connection.
      this.diagnosePeerConnectionAudio('outbound');
      // Call state transitions (ringing → active → hangup) come via telnyx.notification

    } catch (err: any) {
      this.errorMessage.set(`Outbound Call Error: ${err.message}`);
      console.error('[Voice][Call] Call failed:', err.message);

      this.cleanupCallMedia();
      this.endCallSession();
    }
  }

  /** POST /api/voice/log-outbound -- creates the call_logs row up front (see makeOutboundCall). */
  private async logOutboundCallToBackend(toNumber: string, fromNumber: string): Promise<void> {
    try {
        const empId = localStorage.getItem('empId');
      const res = await fetch(`${this.API_BASE}/log-outbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_number: toNumber, from_number: fromNumber, user_id: empId, }),
      });
      const data = await res.json();
      if (!res.ok || !data.status) {
        console.warn('[Voice][History] Failed to log outbound call:', data.message);
        return;
      }
      const cur = this.activeCall();
      // Guard: only attach if this is still the same outbound call (user
      // hasn't already hung up/started a new one while this request was in flight).
      if (cur && cur.direction === 'outbound' && !cur.callLogId) {
        this.activeCall.set({ ...cur, callLogId: data.call_log_id });
      }
    } catch (err: any) {
      console.warn('[Voice][History] Network error logging outbound call:', err.message);
    }
  }

  /** POST /api/voice/attach-provider-call-id -- best-effort, see makeOutboundCall. */
  private async attachProviderCallIdToBackend(providerCallId: string): Promise<void> {
    const cur = this.activeCall();
    if (!cur?.callLogId || !providerCallId) return;

    try {
      await fetch(`${this.API_BASE}/attach-provider-call-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callLogId: cur.callLogId, providerCallId }),
      });
      console.log('[Voice][History] Attached providerCallId:', providerCallId, 'to callLogId:', cur.callLogId);
    } catch (err: any) {
      console.warn('[Voice][History] Network error attaching provider call id:', err.message);
    }
  }


  private async logCallEndToBackend(explicitStatus?: 'completed' | 'rejected' | 'no_answer' | 'failed' | 'busy'): Promise<void> {
    const cur = this.activeCall();
    if (!cur?.callLogId) return; // nothing to update -- row was never linked (e.g. log-outbound request hadn't resolved yet)

    const finalStatus = explicitStatus
      ?? (cur.status === 'active' || cur.status === 'held' ? 'completed' : 'no_answer');

    try {
      const empId = this.currentEmployeeId || localStorage.getItem('empId');
      await fetch(`${this.API_BASE}/log-call-end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callLogId: cur.callLogId,
          status: finalStatus,
          durationSeconds: cur.durationSeconds,
          userId: empId,
          user_id: empId,
          employeeId: empId,
        }),
      });
    } catch (err: any) {
      console.warn('[Voice][History] Network error logging call end:', err.message);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INBOUND CALL
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Called by SSE handler when an incoming_call event arrives.
   * Sets up UI state; actual media comes via telnyx.notification.
   */
  receiveIncomingCall(callLogId: number, fromNumber: string, customerName?: string): void {
    const existing = this.activeCall();
    if (existing && existing.direction === 'inbound' && existing.status === 'ringing' && !existing.callLogId) {
      this.activeCall.set({ ...existing, callLogId });
      return;
    }

    if (existing && (existing.status === 'active' || existing.status === 'dialing' || existing.status === 'held' || existing.status === 'ringing' || this.awaitingBridgeAnswer)) {
      console.warn('[Concurrent Call Protection] Already on active call. Logging missed call for', fromNumber);
      const entry = {
        id: `missed-${Date.now()}-${callLogId}`,
        number: fromNumber,
        name: customerName || 'Incoming Call',
        timestamp: new Date(),
        reason: 'Agent busy on active call',
      };
      this.missedCalls.update(list => [entry, ...list.slice(0, 19)]);
      this.notify(`⚠️ Missed Call from ${customerName || fromNumber} (Line Busy)`, 'warn');
      if (this.isBrowser && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(`⚠️ Missed Call from ${customerName || fromNumber}`, {
            body: `Caller received busy signal while you were on another call.`,
            icon: '/favicon.ico',
            tag: 'missed-voice-call',
          });
        } catch (e) { /* ignore */ }
      }

      if (callLogId) {
        this.rejectBusyInboundCallOnBackend(callLogId);
      }
      return;
    }

    this.activeCall.set({
      callLogId,
      customerNumber: fromNumber,
      customerName: customerName || undefined,
      direction: 'inbound',
      status: 'ringing',
      isMuted: false,
      isHeld: false,
      durationSeconds: 0,
    });
  }


  private async rejectBusyInboundCallOnBackend(callLogId: number): Promise<void> {
    try {
      const empId = this.currentEmployeeId || localStorage.getItem('empId');
      const res = await fetch(`${this.API_BASE}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callLogId,
          employeeId: empId,
          userId: empId,
          user_id: empId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.status) {
        console.warn('[Voice][Call] Busy-call reject was not applied (call may have already ended):', data.message);
        return;
      }
      this.terminatedCallLogIds.add(callLogId);
      console.log('[Voice][Call] Declined busy-agent inbound call on backend, callLogId:', callLogId);
      this.fetchMissedCallsCount();
    } catch (err: any) {
      console.warn('[Voice][Call] Network error declining busy-agent inbound call:', err.message);
    }
  }

  private async autoAcceptBridgedCall(call: any): Promise<void> {
    this.activeRTCCall = call;
    try {
      if (this.localStream) {
        this.localStream.getTracks().forEach(t => t.stop());
      }
      const freshStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.localStream = freshStream;

      await call.answer({
        audio: true,
        video: false,
        remoteElement: this.remoteAudioEl || undefined,
        localStream: this.localStream,
      });
      console.log('[Voice][Call] Bridged leg auto-answered successfully.');
    } catch (e: any) {
      console.error('[Voice][Call] Failed to auto-answer bridged leg:', e.message);
      this.errorMessage.set(`Could not connect audio: ${e.message}`);
    }
  }

  async answerCall(): Promise<void> {
    const current = this.activeCall();
    if (!current) return;

    // Broadcast immediately so other open tabs close their ringing popups
    this.broadcastCallAction('answered', current.callLogId, current.providerCallId);

    if (this.micPermission() === 'Blocked' || this.micPermission() === 'Denied') {
      this.errorMessage.set('Microphone is unavailable. Connect a microphone (or grant permission) before answering a call.');
      return;
    }
    // Clean up activeRTCCall if it's dead/ended
    if (this.activeRTCCall && ['hangup', 'destroy', 'purge', 'ended'].includes(this.activeRTCCall.state)) {
      this.activeRTCCall = null;
    }

    const isRtcCallValid =
      this.activeRTCCall &&
      typeof this.activeRTCCall.answer === 'function' &&
      !['hangup', 'destroy', 'purge', 'ended'].includes(this.activeRTCCall.state);

    const rtcCallMatchesCurrent =
      isRtcCallValid &&
      (this.activeRTCCall.id === current.providerCallId || (
        !current.providerCallId &&
        (this.activeRTCCall.options?.direction === 'inbound' || this.activeRTCCall.direction === 'inbound' || !this.activeRTCCall.options?.direction)
      ));

    // If TelnyxRTC already has the inbound call, answer via SDK (WebRTC media is immediate)
    if (rtcCallMatchesCurrent) {
      try {
        console.log('[Voice][Audio] Acquiring fresh mic stream to answer inbound call');
        if (this.localStream) {
          this.localStream.getTracks().forEach(t => t.stop());
        }

        const freshStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this.localStream = freshStream;

        const audioTracks = this.localStream.getAudioTracks();
        console.log('[Voice][Debug] Inbound Answer Mic tracks:', audioTracks.map(t => ({ label: t.label, enabled: t.enabled, muted: t.muted, readyState: t.readyState })));

        await this.activeRTCCall.answer({
          audio: true,
          video: false,
          remoteElement: this.remoteAudioEl || undefined,
          localStream: this.localStream,
        });
        console.log('[Voice][Call] Inbound call answered via TelnyxRTC SDK');

        // Claim call on backend for this user
        if (current.callLogId) {
          fetch(`${this.API_BASE}/answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callLogId: current.callLogId,
              employeeId: this.currentEmployeeId,
              userId: this.currentEmployeeId,
              user_id: this.currentEmployeeId,
            }),
          }).catch(() => {});
        }

        // DEBUG: verify the mic track actually landed on the peer connection.
        this.diagnosePeerConnectionAudio('inbound-answer');
        return;
      } catch (e: any) {
        console.warn('[Voice][Call] SDK answer failed, falling back to REST answer:', e.message);
      }
    }

    // Fallback: answer via Call Control REST API
    if (!current.callLogId) return;
    try {
      this.errorMessage.set(null);

      this.awaitingBridgeAnswer = true;
      const res = await fetch(`${this.API_BASE}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callLogId: current.callLogId,
          employeeId: this.currentEmployeeId,
          userId: this.currentEmployeeId,
          user_id: this.currentEmployeeId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.status) throw new Error(data.message || 'Answer failed');

      this.activeCall.set({ ...current, status: 'active', startTime: new Date() });
      this.startTimer();
    } catch (err: any) {
      this.awaitingBridgeAnswer = false;
      this.errorMessage.set(`Answer Call Failed: ${err.message}`);
    }
  }

  async rejectCall(): Promise<void> {
    const current = this.activeCall();

    // Broadcast immediately so other open tabs close their ringing popups
    this.broadcastCallAction('rejected', current?.callLogId, current?.providerCallId);

    // Same timing reasoning as hangupCall() above -- log before clearing.
    // 'rejected' since this is an explicit user decline, not a plain hangup.
    this.logCallEndToBackend('rejected');
    const isUnansweredInbound =
      current?.direction === 'inbound' && current.status !== 'active' && current.status !== 'held';

    const empId = this.currentEmployeeId || localStorage.getItem('empId');
    if (isUnansweredInbound && current?.callLogId) {
      try {
        await fetch(`${this.API_BASE}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callLogId: current.callLogId,
            employeeId: empId,
            userId: empId,
            user_id: empId,
          }),
        });
      } catch (e) {
        console.warn('[Voice][Call] Reject network error:', e);
      }
    } else if (this.activeRTCCall && typeof this.activeRTCCall.hangup === 'function') {
      try { this.activeRTCCall.hangup(); } catch { /* ignore */ }
    } else if (current?.callLogId) {
      try {
        await fetch(`${this.API_BASE}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callLogId: current.callLogId,
            employeeId: empId,
            userId: empId,
            user_id: empId,
          }),
        });
      } catch (e) {
        console.warn('[Voice][Call] Reject network error:', e);
      }
    }

    this.cleanupCallMedia();
    this.endCallSession();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // IN-CALL CONTROLS
  // ─────────────────────────────────────────────────────────────────────────

  toggleMute(): void {
    const current = this.activeCall();
    if (!current) return;

    const nextMuteState = !current.isMuted;

    // Mute via SDK (preferred — affects WebRTC track)
    if (this.activeRTCCall) {
      try {
        if (nextMuteState) {
          this.activeRTCCall.muteAudio?.();
        } else {
          this.activeRTCCall.unmuteAudio?.();
        }
      } catch { /* ignore */ }
    }

    // Also mute local MediaStream track directly as backup
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(t => (t.enabled = !nextMuteState));
    }

    this.activeCall.set({ ...current, isMuted: nextMuteState });
  }

  async toggleHold(): Promise<void> {
    const current = this.activeCall();
    if (!current) return;

    const isHolding = current.isHeld;

    if (!this.activeRTCCall) {
      console.warn('[Voice][Hold] No activeRTCCall -- there is no live SDK call session to hold.');
      this.errorMessage.set('No active call session to hold.');
      return;
    }

    try {
      if (isHolding) {
        await this.activeRTCCall.unhold();
        console.log('[Voice][Call] Telnyx confirmed UNHOLD.');
      } else {
        await this.activeRTCCall.hold();
        console.log('[Voice][Call] Telnyx confirmed HOLD.');
      }
    } catch (err: any) {
      console.error(`[Voice][Call] Telnyx REJECTED ${isHolding ? 'unhold' : 'hold'}:`, err);
      this.errorMessage.set(`Hold/Resume was rejected by Telnyx: ${err?.message || err}`);
      return; // do NOT flip the UI -- the call is genuinely still not held
    }

    this.activeCall.set({ ...current, isHeld: !isHolding, status: !isHolding ? 'held' : 'active' });
  }

  async hangupCall(): Promise<void> {
    const current = this.activeCall();
    const explicitStatus = (current?.status === 'ringing' && current?.direction === 'inbound')
      ? 'rejected'
      : (current?.status === 'active' || current?.status === 'held' ? 'completed' : 'no_answer');

    this.broadcastCallAction('ended', current?.callLogId, current?.providerCallId);
    this.logCallEndToBackend(explicitStatus);

    if (this.activeRTCCall && typeof this.activeRTCCall.hangup === 'function') {
      try {
        this.activeRTCCall.hangup();
        console.log('[Voice][Call] Call hung up via TelnyxRTC SDK');
      } catch { /* ignore */ }
    } else if (current?.callLogId) {
      try {
        await fetch(`${this.API_BASE}/hangup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callLogId: current.callLogId }),
        });
      } catch (e) {
        console.warn('[Voice][Call] Hangup REST error:', e);
      }
    }

    this.cleanupCallMedia();
    this.endCallSession();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UNREGISTER / CLEANUP
  // ─────────────────────────────────────────────────────────────────────────

  unregister(): void {
    this.endCallSession();
    this.cleanupCallMedia();
    this.closeSSE(true);

    if (this.telnyxClient) {
      try { this.telnyxClient.disconnect(); } catch { /* ignore */ }
      this.telnyxClient = null;
      console.log('[Voice][WebRTC] Disconnected — TelnyxRTC client destroyed');
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
      console.log('[Voice][Audio] Local microphone tracks stopped');
    }

    this.connectionState.set('Disconnected');
    this.registrationToken.set(null);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SSE — Call State Signaling (unchanged responsibility)
  // ─────────────────────────────────────────────────────────────────────────

  initSSE(employeeId?: string): void {
    const targetEmpId = employeeId || this.currentEmployeeId;
    this.isIntentionallyClosed = false;

    if (this.eventSource) {
      console.log('[SSE] Closing existing connection before re-init.');
      this.closeSSE(false);
    }

    if (!targetEmpId?.trim()) {
      console.warn('[SSE] Invalid employee ID. SSE aborted.');
      return;
    }

    try {
      const url = `${this.API_BASE}/events?employeeId=${encodeURIComponent(targetEmpId)}`;
      console.log(`[SSE] Establishing SSE for Employee [${targetEmpId}]`);
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        console.log('[SSE] Connection established.');
        this.sseConnected.set(true);
        if (this.sseReconnectTimer) { clearTimeout(this.sseReconnectTimer); this.sseReconnectTimer = null; }
      };

      this.eventSource.addEventListener('voice_event', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          console.log('[SSE] Event:', payload.type || 'unknown');
          this.handleIncomingSSEEvent(payload);
        } catch { /* ignore parse errors */ }
      });

      this.eventSource.onmessage = (e: MessageEvent) => {
        try { this.handleIncomingSSEEvent(JSON.parse(e.data)); } catch { /* ignore */ }
      };

      this.eventSource.onerror = () => {
        this.sseConnected.set(false);
        if (this.isIntentionallyClosed) return;
        console.warn('[SSE] Connection interrupted.');
        if (this.eventSource) { this.eventSource.close(); this.eventSource = null; }
        if (!this.sseReconnectTimer) {
          this.sseReconnectTimer = setTimeout(() => {
            this.sseReconnectTimer = null;
            if (!this.isIntentionallyClosed && this.connectionState() !== 'Disconnected') {
              this.initSSE(this.currentEmployeeId);
            }
          }, 5000);
        }
      };
    } catch (e: any) {
      console.error('[SSE] Could not create EventSource:', e?.message);
      this.sseConnected.set(false);
    }
  }

  closeSSE(isExplicitLogout = true): void {
    if (isExplicitLogout) this.isIntentionallyClosed = true;
    if (this.sseReconnectTimer) { clearTimeout(this.sseReconnectTimer); this.sseReconnectTimer = null; }
    if (this.eventSource) {
      try { this.eventSource.close(); } catch { /* ignore */ }
      this.eventSource = null;
      console.log('[SSE] Connection closed.');
    }
    this.sseConnected.set(false);
  }

  private handleIncomingSSEEvent(payload: any): void {
    if (!payload || typeof payload !== 'object') return;
    const { type, callLogId, phoneNumber, customerName, recordingUrl, message } = payload;

    const ALIVE_EVENTS = new Set(['incoming_call', 'call_ringing', 'call_answered', 'call_hold', 'call_resume']);
    if (ALIVE_EVENTS.has(type) && callLogId && this.terminatedCallLogIds.has(callLogId)) {
      console.warn(`[SSE] Ignoring stale "${type}" event for already-terminated callLogId:`, callLogId);
      return;
    }

    switch (type) {
      case 'incoming_call':
        console.log('[SSE UI State] Incoming call from:', phoneNumber);
        this.receiveIncomingCall(callLogId, phoneNumber || 'Unknown', customerName);
        this.notify(`Incoming Call from ${phoneNumber || 'Unknown'}`, 'info');
        // Refresh inbound count badge immediately when a new call arrives
        this.fetchInboundCallsCount();
        break;

      case 'call_ringing': {
        const cur = this.activeCall();
        if (cur) this.activeCall.set({ ...cur, status: 'ringing', callLogId });
        console.log('[SSE UI State] Call ringing, callLogId:', callLogId);
        break;
      }

      case 'call_answered': {
        const cur = this.activeCall();
        if (cur) {
          const isMeAnswering =
            this.awaitingBridgeAnswer ||
            (this.activeRTCCall && this.activeRTCCall.state === 'active') ||
            (payload.employeeId && String(payload.employeeId) === String(this.currentEmployeeId)) ||
            (payload.userId && String(payload.userId) === String(this.currentEmployeeId));

          if (isMeAnswering) {
            this.activeCall.set({ ...cur, status: 'active', callLogId });
            this.startTimer();
            this.notify('Call connected', 'success');
            console.log('[Voice][Call] Call state changed → active (via SSE)');
          } else {
            // Another agent or user ID answered the call — remove the ringing popup for this user immediately!
            console.log('[Voice][Call] Call answered by another ID/agent — dismissing ringing popup');
            if (callLogId) this.terminatedCallLogIds.add(callLogId);
            this.cleanupCallMedia();
            this.endCallSession();
            this.notify('Call answered by another agent', 'info');
            this.fetchInboundCallsCount();
          }
        } else {
          console.warn('[SSE] call_answered received but no activeCall exists — ignoring (likely a stale/reordered webhook).');
        }
        break;
      }

      case 'call_hold': {
        const cur = this.activeCall();
        if (cur) this.activeCall.set({ ...cur, status: 'held', isHeld: true, callLogId });
        this.notify('Call placed on hold', 'info');
        break;
      }

      case 'call_resume': {
        const cur = this.activeCall();
        if (cur) this.activeCall.set({ ...cur, status: 'active', isHeld: false, callLogId });
        this.notify('Call resumed', 'info');
        break;
      }

      case 'call_completed':
      case 'call_ended':
      case 'call_hangup':
        console.log('[Voice][Call] Call state changed → ended (via SSE)');
        if (callLogId) this.terminatedCallLogIds.add(callLogId);
        this.cleanupCallMedia();
        this.endCallSession();
        this.notify('Call completed', 'info');
        this.fetchInboundCallsCount();
        break;

      case 'call_rejected':
      case 'call_declined':
      case 'call_canceled':
      case 'call_cancelled':
        if (callLogId) this.terminatedCallLogIds.add(callLogId);
        this.cleanupCallMedia();
        this.endCallSession();
        this.notify('Call rejected', 'warn');
        this.fetchMissedCallsCount();
        this.fetchInboundCallsCount();
        break;

      case 'call_no_answer':
      case 'call_missed':
      case 'call_timeout':
        // Fired when call is not answered by anyone before timeout or customer hangs up
        console.log('[Voice][Call] Call state changed → missed (via SSE)');
        if (callLogId) this.terminatedCallLogIds.add(callLogId);
        this.cleanupCallMedia();
        this.endCallSession();
        this.notify('Call missed', 'warn');
        this.fetchMissedCallsCount(); // also calls fetchInboundCallsCount internally
        break;

      case 'call_failed':
        if (callLogId) this.terminatedCallLogIds.add(callLogId);
        this.cleanupCallMedia();
        this.endCallSession();
        this.errorMessage.set(message || 'Call failed or network error.');
        this.notify(message || 'Call failed', 'error');
        break;

      case 'recording_ready':
        this.notify(`Recording available for call ${callLogId || ''}`, 'success');
        break;

      default:
        break;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TIMER & HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  private startTimer(): void {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      const cur = this.activeCall();
      if (cur?.status === 'active') {
        this.activeCall.set({ ...cur, durationSeconds: cur.durationSeconds + 1 });
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
  }

  private endCallSession(): void {
    this.stopTimer();
    this.awaitingBridgeAnswer = false;
    // Record the callLogId before clearing so the terminatedCallLogIds guard
    // can reject any delayed SSE events that arrive after this point.
    const ending = this.activeCall();
    if (ending?.callLogId) {
      this.terminatedCallLogIds.add(ending.callLogId);
      // Keep the set bounded — prune entries older than the last 20 calls so
      // it doesn't grow unboundedly in long-running sessions.
      if (this.terminatedCallLogIds.size > 20) {
        const oldest = this.terminatedCallLogIds.values().next().value;
        if (oldest !== undefined) this.terminatedCallLogIds.delete(oldest);
      }
    }
    this.activeCall.set(null);
  }


  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }


  async fetchTelnyxBalance(): Promise<void> {
    if (this.telnyxBalanceLoading()) return; // prevent duplicate concurrent requests
    this.telnyxBalanceLoading.set(true);
    this.telnyxBalanceError.set(null);
    try {
      const res = await fetch(`${this.API_BASE}/balance`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).message || (body as any).error || `HTTP ${res.status}`);
      }
      const json = await res.json() as {
        status?: boolean;
        message?: string;
        error?: string;
        data?: {
          balance?: string | number;
          availableCredit?: string | number;
          currency?: string;
          creditLimit?: string | number;
        };
        balance?: string | number;
      };
      if (json.status === false || json.error) {
        throw new Error(json.message || json.error || 'Failed to fetch balance');
      }
      const raw = json.data?.availableCredit ?? json.data?.balance ?? json.balance;
      if (raw !== undefined && raw !== null && raw !== '') {
        // Format to 2 decimal places (e.g. "10.47")
        const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
        this.telnyxBalance.set(isNaN(num) ? String(raw) : num.toFixed(2));
      } else {
        this.telnyxBalance.set(null);
      }
    } catch (err: any) {
      this.telnyxBalanceError.set(err?.message || 'Failed to fetch balance');
      this.telnyxBalance.set(null);
    } finally {
      this.telnyxBalanceLoading.set(false);
    }
  }
}

