import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
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
  // legacy aliases used by the existing template
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

  // ── Private State ───────────────────────────────────────────────────────
  private telnyxClient: TelnyxRTC | null = null;
  private activeRTCCall: any = null;          // TelnyxRTC Call instance
  private localStream: MediaStream | null = null;
  private remoteAudioEl: HTMLAudioElement | null = null;

  private eventSource: EventSource | null = null;
  private sseReconnectTimer: any = null;
  private currentEmployeeId: string = '1';
  private isIntentionallyClosed = false;
  private timerInterval: any = null;

  private readonly platformId = inject(PLATFORM_ID);
  private get isBrowser(): boolean { return isPlatformBrowser(this.platformId); }

  constructor() {
    if (this.isBrowser) {
      this.checkMicrophonePermissionStatus();
      this.fetchVoiceNumbers();
      // No eager full-list load anymore -- fetchAdminClients() is search-
      // driven now (this org table has 100k+ rows). Softphone/Clients
      // pages call it themselves as the user types.
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

      this.lastNotification.set({
        message: `Synced ${data.total} number(s) from Telnyx (${data.created} new, ${data.updated} updated)`,
        type: 'success',
      });
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

  /**
   * Loads admin-tier clients (Organization + Userprofile.AdminSts=1) for
   * the dialer's client picker. Search-driven and capped server-side
   * (default 25, max 100) -- this table is huge, so callers should pass
   * a `search` term once the user has typed a couple characters rather
   * than relying on the unfiltered default list.
   */
  async fetchAdminClients(search: string = '', limit: number = 25): Promise<void> {
    this.loadingAdminClients.set(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('limit', String(limit));
      const res = await fetch(`${this.API_BASE}/admin-clients?${params.toString()}`);
      const json = await res.json();
      this.adminClients.set(json.data || []);
    } catch (err: any) {
      console.warn('[Voice][AdminClients] Failed to fetch admin clients:', err.message);
    } finally {
      this.loadingAdminClients.set(false);
    }
  }

  /** The E.164 number currently selected in the DID dropdown, used as callerNumber for outbound calls. */
  get selectedCallerNumber(): string | null {
    const n = this.voiceNumbers().find(v => v.id === this.selectedNumberId());
    return n?.phone_number || null;
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

  /**
   * Main entry point. Called from VoiceComponent.ngOnInit().
   * Steps:
   *  1. Request microphone
   *  2. Fetch JWT token from backend (credentials generated against SIP Connection)
   *  3. Initialize TelnyxRTC client with the JWT
   *  4. Connect — 'telnyx.ready' fires when actually registered
   *  5. Start SSE for call state signaling
   */
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

    // Step 1: Microphone
    this.connectionState.set('initializing');
    const micOk = await this.requestMicrophonePermission();
    if (!micOk) {
      this.connectionState.set('Disconnected');
      return;
    }

    // Step 2: Fetch real WebRTC JWT from backend
    let token: string;
    let sipUsername: string;

    console.log('[Voice][WebRTC] Fetching WebRTC token from backend...');
    try {
      const res = await fetch(`${this.API_BASE}/token`);
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
    this.initSSE('1');
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

        if (state === 'ringing') {
          // Outbound: remote side is ringing
          console.log('[Voice][Call] Call state changed → ringing');
          const cur = this.activeCall();
          if (cur) this.activeCall.set({ ...cur, status: 'ringing' });
        }

        if (state === 'active') {
          // Both sides connected — wire up remote audio
          console.log('[Voice][Call] Call state changed → active');
          this.attachRemoteAudio(call);
          const cur = this.activeCall();
          if (cur) {
            this.activeCall.set({ ...cur, status: 'active', startTime: new Date() });
            this.startTimer();
          }
        }

        if (state === 'hangup' || state === 'destroy' || state === 'purge') {
          console.log('[Voice][Call] Call state changed → ended');
          this.cleanupCallMedia();
          this.endCallSession();
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
        const fromName = call.options?.remoteCallerName || fromNumber;

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

  /**
   * DEBUG ONLY — diagnostic helper to trace the one-way-audio bug.
   * Locates the underlying RTCPeerConnection on a TelnyxRTC call object
   * and logs its outbound audio sender(s). If no audio sender exists (or
   * its track is null/ended), the local mic was never attached to the
   * peer connection — that's the root cause of "they can't hear me".
   * Safe to remove once the bug is confirmed/fixed.
   */
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
    console.log('[Voice][Media] Cleaning up call media...');
    if (this.isBrowser && this.remoteAudioEl) {
      try {
        if (typeof this.remoteAudioEl.pause === 'function') {
          this.remoteAudioEl.pause();
        }
        this.remoteAudioEl.srcObject = null;
      } catch (err) {
        console.warn('[Voice][Media] Error pausing or cleaning remote audio element:', err);
      }
    }
    this.activeRTCCall = null;
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

    this.errorMessage.set(null);
    this.activeCall.set({
      customerNumber: phoneNumber,
      customerName: customerName || 'Customer',
      direction: 'outbound',
      status: 'dialing',
      isMuted: false,
      isHeld: false,
      durationSeconds: 0,
    });

    console.log('[Voice][Call] Call requested to:', phoneNumber);

    // Use the DID selected in the dropdown; fall back to the hardcoded
    // number only if nothing has synced/loaded yet, so a fresh page load
    // before fetchVoiceNumbers() resolves doesn't hard-fail the call.
    const callerNumber = this.selectedCallerNumber || '+14029489500';
    if (!this.selectedCallerNumber) {
      console.warn('[Voice][Call] No DID selected from voice_numbers -- falling back to hardcoded number. Sync/select a number first.');
    }

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

      // DEBUG: verify the mic track actually landed on the peer connection.
      this.diagnosePeerConnectionAudio('outbound');
      // Call state transitions (ringing → active → hangup) come via telnyx.notification

    } catch (err: any) {
      this.errorMessage.set(`Outbound Call Error: ${err.message}`);
      console.error('[Voice][Call] Call failed:', err.message);
      this.endCallSession();
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
    if (existing && (existing.status === 'active' || existing.status === 'dialing' || existing.status === 'held')) {
      console.warn('[Concurrent Call Protection] Already on an active call. Ignoring incoming call from', fromNumber);
      this.lastNotification.set({ message: `Incoming call from ${fromNumber} ignored — already on an active call.`, type: 'warn' });
      return;
    }

    this.activeCall.set({
      callLogId,
      customerNumber: fromNumber,
      customerName: customerName || 'Incoming Call',
      direction: 'inbound',
      status: 'ringing',
      isMuted: false,
      isHeld: false,
      durationSeconds: 0,
    });
  }

  async answerCall(): Promise<void> {
    const current = this.activeCall();
    if (!current) return;

    // If TelnyxRTC already has the inbound call, answer via SDK (WebRTC media is immediate)
    if (this.activeRTCCall && typeof this.activeRTCCall.answer === 'function') {
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
      const res = await fetch(`${this.API_BASE}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callLogId: current.callLogId }),
      });
      const data = await res.json();
      if (!res.ok || !data.status) throw new Error(data.message || 'Answer failed');

      this.activeCall.set({ ...current, status: 'active', startTime: new Date() });
      this.startTimer();
    } catch (err: any) {
      this.errorMessage.set(`Answer Call Failed: ${err.message}`);
    }
  }

  async rejectCall(): Promise<void> {
    const current = this.activeCall();

    // Reject via SDK if we have the call
    if (this.activeRTCCall && typeof this.activeRTCCall.hangup === 'function') {
      try { this.activeRTCCall.hangup(); } catch { /* ignore */ }
    }

    if (current?.callLogId) {
      try {
        await fetch(`${this.API_BASE}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callLogId: current.callLogId }),
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

    // SDK hold/unhold if available — this must run regardless of whether
    // callLogId has arrived yet, since the WebRTC-level hold/unhold is
    // independent of the backend record. Previously this whole method
    // returned early on missing callLogId, silently skipping even the
    // SDK-level toggle for freshly-answered outbound calls.
    if (this.activeRTCCall) {
      try {
        if (isHolding) {
          this.activeRTCCall.unhold?.();
        } else {
          this.activeRTCCall.hold?.();
        }
      } catch { /* fall through to REST */ }
    }

    if (!current.callLogId) {
      // No backend record yet to sync against — still reflect the SDK-level
      // toggle locally so the UI isn't stuck, but warn since the backend
      // (and other connected clients via SSE) won't know about this yet.
      console.warn('[Voice][Hold] No callLogId yet — toggled via SDK only, backend not notified. It will resync once callLogId arrives via SSE.');
      this.activeCall.set({ ...current, isHeld: !isHolding, status: !isHolding ? 'held' : 'active' });
      return;
    }

    const endpoint = isHolding ? 'resume' : 'hold';

    try {
      const res = await fetch(`${this.API_BASE}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callLogId: current.callLogId }),
      });
      const data = await res.json();
      if (!res.ok || !data.status) throw new Error(data.message || `${endpoint} failed`);

      this.activeCall.set({ ...current, isHeld: !isHolding, status: !isHolding ? 'held' : 'active' });
    } catch (err: any) {
      this.errorMessage.set(`Hold/Resume Failed: ${err.message}`);
    }
  }

  async hangupCall(): Promise<void> {
    const current = this.activeCall();

    // Hangup via SDK (terminates WebRTC media immediately)
    if (this.activeRTCCall && typeof this.activeRTCCall.hangup === 'function') {
      try {
        this.activeRTCCall.hangup();
        console.log('[Voice][Call] Call hung up via TelnyxRTC SDK');
      } catch { /* ignore */ }
    }

    // Also tell the backend (Call Control hangup)
    if (current?.callLogId) {
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

  initSSE(employeeId: string = '1'): void {
    this.currentEmployeeId = employeeId;
    this.isIntentionallyClosed = false;

    if (this.eventSource) {
      console.log('[SSE] Closing existing connection before re-init.');
      this.closeSSE(false);
    }

    if (!employeeId?.trim()) {
      console.warn('[SSE] Invalid employee ID. SSE aborted.');
      return;
    }

    try {
      const url = `${this.API_BASE}/events?employeeId=${encodeURIComponent(employeeId)}`;
      console.log(`[SSE] Establishing SSE for Employee [${employeeId}]`);
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

    switch (type) {
      case 'incoming_call':
        console.log('[SSE UI State] Incoming call from:', phoneNumber);
        this.receiveIncomingCall(callLogId, phoneNumber || 'Unknown', customerName || 'Incoming PSTN Call');
        this.lastNotification.set({ message: `Incoming Call from ${phoneNumber || 'Unknown'}`, type: 'info' });
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
          this.activeCall.set({ ...cur, status: 'active', callLogId });
          this.startTimer();
        } else {
          this.activeCall.set({
            callLogId, customerNumber: phoneNumber || 'Connected', customerName: customerName || 'Customer',
            direction: 'inbound', status: 'active', isMuted: false, isHeld: false,
            durationSeconds: 0, startTime: new Date(),
          });
          this.startTimer();
        }
        this.lastNotification.set({ message: 'Call connected', type: 'success' });
        console.log('[Voice][Call] Call state changed → active (via SSE)');
        break;
      }

      case 'call_hold': {
        const cur = this.activeCall();
        if (cur) this.activeCall.set({ ...cur, status: 'held', isHeld: true, callLogId });
        this.lastNotification.set({ message: 'Call placed on hold', type: 'info' });
        break;
      }

      case 'call_resume': {
        const cur = this.activeCall();
        if (cur) this.activeCall.set({ ...cur, status: 'active', isHeld: false, callLogId });
        this.lastNotification.set({ message: 'Call resumed', type: 'info' });
        break;
      }

      case 'call_completed':
        console.log('[Voice][Call] Call state changed → ended (via SSE)');
        this.cleanupCallMedia();
        this.endCallSession();
        this.lastNotification.set({ message: 'Call completed', type: 'info' });
        break;

      case 'call_rejected':
        this.cleanupCallMedia();
        this.endCallSession();
        this.lastNotification.set({ message: 'Call rejected', type: 'warn' });
        break;

      case 'call_failed':
        this.cleanupCallMedia();
        this.endCallSession();
        this.errorMessage.set(message || 'Call failed or network error.');
        this.lastNotification.set({ message: message || 'Call failed', type: 'error' });
        break;

      case 'recording_ready':
        this.lastNotification.set({ message: `Recording available for call ${callLogId || ''}`, type: 'success' });
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
    this.activeCall.set(null);
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}
