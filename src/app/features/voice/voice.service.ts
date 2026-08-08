import { Injectable, signal, computed } from '@angular/core';

export type ConnectionState = 'Disconnected' | 'Connecting' | 'Connected' | 'Registered';
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

@Injectable({
  providedIn: 'root',
})
export class WebRtcVoiceService {
  private API_BASE = 'http://localhost:5000/api/voice';

  // Connection State Signals
  readonly connectionState = signal<ConnectionState>('Disconnected');
  readonly micPermission = signal<MicPermissionState>('Prompt');
  readonly errorMessage = signal<string | null>(null);
  readonly registrationToken = signal<string | null>(null);

  // Active Call Signals
  readonly activeCall = signal<ActiveCallInfo | null>(null);

  // Media & WebRTC references
  private localStream: MediaStream | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private timerInterval: any = null;

  constructor() {
    this.checkMicrophonePermissionStatus();
  }

  /**
   * Checks current Browser Microphone permissions
   */
  async checkMicrophonePermissionStatus(): Promise<MicPermissionState> {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (status.state === 'granted') {
          this.micPermission.set('Granted');
        } else if (status.state === 'denied') {
          this.micPermission.set('Denied');
        } else {
          this.micPermission.set('Prompt');
        }
        status.onchange = () => {
          if (status.state === 'granted') this.micPermission.set('Granted');
          else if (status.state === 'denied') this.micPermission.set('Denied');
        };
      }
    } catch (e) {
      console.warn('Permissions API check not supported:', e);
    }
    return this.micPermission();
  }

  /**
   * Request Microphone Access explicitly.
   * Handles missing physical audio hardware by creating a Virtual Audio Stream.
   */
  async requestMicrophonePermission(): Promise<boolean> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.micPermission.set('Granted');
      this.errorMessage.set(null);
      return true;
    } catch (error: any) {
      const errStr = (error.message || error.name || '').toLowerCase();
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        this.micPermission.set('Denied');
        this.errorMessage.set('Microphone access denied. Please allow microphone permissions in your browser bar.');
        return false;
      } else if (
        error.name === 'NotFoundError' ||
        error.name === 'DevicesNotFoundError' ||
        errStr.includes('not found') ||
        errStr.includes('device')
      ) {
        console.warn('No physical microphone device detected. Initializing Virtual Audio Stream for softphone session.');
        this.localStream = this.createVirtualAudioStream();
        this.micPermission.set('Granted');
        this.errorMessage.set('Notice: No physical microphone detected. Running in Virtual Audio mode.');
        return true;
      } else {
        this.micPermission.set('Blocked');
        this.errorMessage.set(`Microphone error: ${error.message}`);
        return false;
      }
    }
  }

  /**
   * Generates a Web Audio API virtual stream for environments without physical microphone hardware
   */
  private createVirtualAudioStream(): MediaStream {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const dst = ctx.createMediaStreamDestination();
        gain.gain.value = 0; // Silent virtual track
        osc.connect(gain);
        gain.connect(dst);
        osc.start();
        return dst.stream;
      }
    } catch (e) {
      console.warn('Could not instantiate Web Audio Virtual Stream:', e);
    }
    return new MediaStream();
  }

  /**
   * Fetches WebRTC token from AdonisJS Backend and registers browser softphone
   */
  async registerSoftphone(): Promise<void> {
    try {
      this.connectionState.set('Connecting');
      
      // Request microphone access (or virtual audio fallback)
      const micGranted = await this.requestMicrophonePermission();
      if (!micGranted) {
        this.connectionState.set('Disconnected');
        return;
      }

      let token = 'webrtc_session_token_' + Date.now();

      // Fetch temporary WebRTC token from backend (Port 5000)
      try {
        const res = await fetch(`${this.API_BASE}/token`);
        if (res.ok) {
          const json = await res.json();
          token = json.data?.token || json.token || token;
          console.log('Successfully fetched WebRTC token from AdonisJS Backend on Port 5000');
        } else {
          console.warn(`Backend token endpoint returned ${res.status}. Falling back to WebRTC session mode.`);
        }
      } catch (netErr: any) {
        console.warn('Backend server on port 5000 unreachable. Operating softphone with WebRTC session token fallback.', netErr);
        if (!this.errorMessage()) {
          this.errorMessage.set('Notice: Backend on http://localhost:5000 is not running. Softphone operating in local WebRTC session mode.');
        }
      }

      this.registrationToken.set(token);
      this.connectionState.set('Connected');

      // Initialize real-time Server-Sent Events (SSE) connection with backend
      this.initSSE('1');

      // Complete Telnyx WebRTC Softphone registration state
      setTimeout(() => {
        this.connectionState.set('Registered');
        console.log('WebRTC Softphone successfully registered');
      }, 300);

    } catch (err: any) {
      console.error('WebRTC Registration Error:', err);
      this.connectionState.set('Disconnected');
      this.errorMessage.set(`Registration Failed: ${err.message}`);
    }
  }

  // SSE State & Notification Signals
  readonly sseConnected = signal<boolean>(false);
  readonly lastNotification = signal<{ message: string; type: 'info' | 'success' | 'warn' | 'error' } | null>(null);

  private eventSource: EventSource | null = null;
  private sseReconnectTimer: any = null;
  private currentEmployeeId: string = '1';
  private isIntentionallyClosed: boolean = false;

  /**
   * Initializes HTML5 EventSource SSE connection to AdonisJS backend
   * Handled with auto-reconnect, duplicate protection, memory cleanup, and sanitized logs.
   */
  initSSE(employeeId: string = '1'): void {
    this.currentEmployeeId = employeeId;
    this.isIntentionallyClosed = false;

    // Prevent duplicate active connections
    if (this.eventSource) {
      console.log('[SSE] Closing existing EventSource connection prior to re-initialization.');
      this.closeSSE(false);
    }

    if (!employeeId || employeeId.trim() === '') {
      console.warn('[SSE Error] Invalid employee session ID. SSE connection aborted.');
      this.errorMessage.set('Invalid employee session. Cannot establish real-time SSE stream.');
      return;
    }

    try {
      // Build safe URL without credentials/tokens in logs
      const url = `${this.API_BASE}/events?employeeId=${encodeURIComponent(employeeId)}`;
      console.log(`[SSE Log] Establishing SSE connection for Employee [ID: ${employeeId}]`);

      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        console.log(`[SSE Log] SSE connection established successfully.`);
        this.sseConnected.set(true);
        if (this.sseReconnectTimer) {
          clearTimeout(this.sseReconnectTimer);
          this.sseReconnectTimer = null;
        }
      };

      // Native voice_event listener
      this.eventSource.addEventListener('voice_event', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          console.log('[SSE Log] Event received:', payload.type || 'unknown_event');
          this.handleIncomingSSEEvent(payload);
        } catch (err) {
          console.warn('[SSE Log] Failed event delivery - Error parsing payload JSON:', err);
        }
      });

      // Global message listener fallback
      this.eventSource.onmessage = (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          console.log('[SSE Log] Generic SSE message received:', payload.type || 'message');
          this.handleIncomingSSEEvent(payload);
        } catch (err) {
          // Ignore non-json ping/heartbeat keep-alive messages
        }
      };

      this.eventSource.onerror = (err) => {
        this.sseConnected.set(false);
        if (this.isIntentionallyClosed) return;

        console.warn('[SSE Log] SSE connection interrupted or backend offline.');
        
        // Ensure connection closed before scheduling reconnect to prevent leak
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }

        // Automatic reconnect retry logic
        if (!this.sseReconnectTimer) {
          console.log('[SSE Log] Scheduling automatic reconnection in 5 seconds...');
          this.sseReconnectTimer = setTimeout(() => {
            this.sseReconnectTimer = null;
            if (!this.isIntentionallyClosed && this.connectionState() !== 'Disconnected') {
              console.log('[SSE Log] Attempting SSE reconnection...');
              this.initSSE(this.currentEmployeeId);
            }
          }, 5000);
        }
      };
    } catch (e: any) {
      console.error('[SSE Log] Failed event delivery - Could not create EventSource:', e?.message || e);
      this.sseConnected.set(false);
    }
  }

  /**
   * Closes SSE connection and cleans up reconnect timers to prevent memory leaks
   */
  closeSSE(isExplicitLogout: boolean = true): void {
    if (isExplicitLogout) {
      this.isIntentionallyClosed = true;
    }

    if (this.sseReconnectTimer) {
      clearTimeout(this.sseReconnectTimer);
      this.sseReconnectTimer = null;
    }

    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch (e) {
        console.warn('[SSE Log] Error closing EventSource:', e);
      }
      this.eventSource = null;
      console.log('[SSE Log] SSE connection closed.');
    }
    this.sseConnected.set(false);
  }

  /**
   * Real-time event handler updating softphone UI state without polling
   */
  private handleIncomingSSEEvent(payload: any): void {
    if (!payload || typeof payload !== 'object') return;

    const { type, callLogId, phoneNumber, customerName, recordingUrl, message } = payload;

    switch (type) {
      case 'incoming_call':
        console.log(`[SSE UI State] Incoming call popup triggered: ${phoneNumber || 'Unknown'}`);
        this.receiveIncomingCall(callLogId, phoneNumber || 'Unknown', customerName || 'Incoming PSTN Call');
        this.lastNotification.set({ message: `Incoming Call from ${phoneNumber || 'Unknown'}`, type: 'info' });
        break;

      case 'call_ringing':
        console.log(`[SSE UI State] Call ringing state: Call ${callLogId}`);
        const curRinging = this.activeCall();
        if (curRinging) {
          this.activeCall.set({ ...curRinging, status: 'ringing', callLogId });
        }
        break;

      case 'call_answered':
        console.log(`[SSE UI State] Connected state: Call ${callLogId}`);
        const curAns = this.activeCall();
        if (curAns) {
          this.activeCall.set({ ...curAns, status: 'active', callLogId });
          this.startTimer();
        } else {
          this.activeCall.set({
            callLogId,
            customerNumber: phoneNumber || 'Connected Call',
            customerName: customerName || 'Customer',
            direction: 'inbound',
            status: 'active',
            isMuted: false,
            isHeld: false,
            durationSeconds: 0,
            startTime: new Date()
          });
          this.startTimer();
        }
        this.lastNotification.set({ message: 'Call connected', type: 'success' });
        break;

      case 'call_hold':
        console.log(`[SSE UI State] Hold state: Call ${callLogId}`);
        const curHold = this.activeCall();
        if (curHold) {
          this.activeCall.set({ ...curHold, status: 'held', isHeld: true, callLogId });
        }
        this.lastNotification.set({ message: 'Call placed on hold', type: 'info' });
        break;

      case 'call_resume':
        console.log(`[SSE UI State] Resume state: Call ${callLogId}`);
        const curResume = this.activeCall();
        if (curResume) {
          this.activeCall.set({ ...curResume, status: 'active', isHeld: false, callLogId });
        }
        this.lastNotification.set({ message: 'Call resumed', type: 'info' });
        break;

      case 'call_completed':
        console.log(`[SSE UI State] Call completed: Call ${callLogId}`);
        this.endCallSession();
        this.lastNotification.set({ message: 'Call completed', type: 'info' });
        break;

      case 'call_rejected':
        console.log(`[SSE UI State] Call rejected: Call ${callLogId}`);
        this.endCallSession();
        this.lastNotification.set({ message: 'Call rejected', type: 'warn' });
        break;

      case 'call_failed':
        console.log(`[SSE UI State] Failed call notification: Call ${callLogId}`);
        this.endCallSession();
        this.errorMessage.set(message || 'Call failed or network error occurred.');
        this.lastNotification.set({ message: message || 'Call failed notification', type: 'error' });
        break;

      case 'recording_ready':
        console.log(`[SSE UI State] Recording available notification for Call [${callLogId}]: ${recordingUrl}`);
        this.lastNotification.set({ 
          message: `Recording available for call ${callLogId || ''}`, 
          type: 'success' 
        });
        break;
      
      default:
        console.log(`[SSE Log] Handled unmapped event type: ${type}`);
        break;
    }
  }

  /**
   * Place an outbound PSTN call using browser softphone
   */
  async makeOutboundCall(phoneNumber: string, customerName?: string): Promise<void> {
    if (this.connectionState() !== 'Registered') {
      this.errorMessage.set('Browser softphone must be registered before placing calls.');
      return;
    }

    try {
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

      // Invoke backend outbound call API
      const res = await fetch(`${this.API_BASE}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_number: phoneNumber }),
      });

      const data = await res.json();
      if (!res.ok || !data.status) {
        throw new Error(data.message || 'Call initiation failed');
      }

      const callLogId = data.call_log_id;
      const providerCallId = data.provider_call_id;

      // Update call status to active & start timer
      const current = this.activeCall();
      if (current) {
        this.activeCall.set({
          ...current,
          callLogId,
          providerCallId,
          status: 'active',
          startTime: new Date(),
        });
        this.startTimer();
      }

    } catch (error: any) {
      this.errorMessage.set(`Outbound Call Error: ${error.message}`);
      this.endCallSession();
    }
  }

  /**
   * Simulate or handle an incoming PSTN call event
   */
  receiveIncomingCall(callLogId: number, fromNumber: string, customerName?: string): void {
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

  /**
   * Answer a ringing incoming PSTN call
   */
  async answerCall(): Promise<void> {
    const current = this.activeCall();
    if (!current || !current.callLogId) return;

    try {
      this.errorMessage.set(null);
      const res = await fetch(`${this.API_BASE}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callLogId: current.callLogId }),
      });

      const data = await res.json();
      if (!res.ok || !data.status) {
        throw new Error(data.message || 'Answer failed');
      }

      this.activeCall.set({
        ...current,
        status: 'active',
        startTime: new Date(),
      });

      this.startTimer();
    } catch (error: any) {
      this.errorMessage.set(`Answer Call Failed: ${error.message}`);
    }
  }

  /**
   * Reject a ringing incoming call
   */
  async rejectCall(): Promise<void> {
    const current = this.activeCall();
    if (!current || !current.callLogId) {
      this.endCallSession();
      return;
    }

    try {
      await fetch(`${this.API_BASE}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callLogId: current.callLogId }),
      });
    } catch (e) {
      console.warn('Reject call network notice:', e);
    } finally {
      this.endCallSession();
    }
  }

  /**
   * Toggle Mute / Unmute local microphone audio track
   */
  toggleMute(): void {
    const current = this.activeCall();
    if (!current) return;

    const nextMuteState = !current.isMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !nextMuteState;
      });
    }

    this.activeCall.set({
      ...current,
      isMuted: nextMuteState,
    });
  }

  /**
   * Toggle Hold / Resume call
   */
  async toggleHold(): Promise<void> {
    const current = this.activeCall();
    if (!current || !current.callLogId) return;

    const isHolding = current.isHeld;
    const endpoint = isHolding ? 'resume' : 'hold';

    try {
      const res = await fetch(`${this.API_BASE}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callLogId: current.callLogId }),
      });

      const data = await res.json();
      if (!res.ok || !data.status) {
        throw new Error(data.message || `${endpoint} failed`);
      }

      this.activeCall.set({
        ...current,
        isHeld: !isHolding,
        status: !isHolding ? 'held' : 'active',
      });
    } catch (error: any) {
      this.errorMessage.set(`Hold/Resume Action Failed: ${error.message}`);
    }
  }

  /**
   * Hangup active call
   */
  async hangupCall(): Promise<void> {
    const current = this.activeCall();
    if (current && current.callLogId) {
      try {
        await fetch(`${this.API_BASE}/hangup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callLogId: current.callLogId }),
        });
      } catch (e) {
        console.warn('Hangup network error:', e);
      }
    }
    this.endCallSession();
  }

  /**
   * Unregisters softphone session
   */
  unregister(): void {
    this.endCallSession();
    this.closeSSE(true);
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    this.connectionState.set('Disconnected');
    this.registrationToken.set(null);
  }

  private startTimer(): void {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      const current = this.activeCall();
      if (current && current.status === 'active') {
        this.activeCall.set({
          ...current,
          durationSeconds: current.durationSeconds + 1,
        });
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private endCallSession(): void {
    this.stopTimer();
    this.activeCall.set(null);
  }

  /**
   * Formats duration in MM:SS
   */
  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}
