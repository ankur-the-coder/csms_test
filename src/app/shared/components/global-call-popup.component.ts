import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WebRtcVoiceService } from '../../features/voice/voice.service';

@Component({
  selector: 'app-global-call-popup',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Global Floating Call Modal Overlay -->
    <div *ngIf="activeCall()" class="fixed bottom-6 right-6 z-50 animate-bounce-in max-w-md w-full sm:w-96 rounded-3xl border border-card-border bg-card-bg p-6 text-center shadow-lg shadow-black/10">

      <!-- Incoming Call Card -->
      <div *ngIf="activeCall()?.status === 'ringing' && activeCall()?.direction === 'inbound'" class="flex flex-col items-center gap-6">
        <div class="flex w-full items-center justify-between">
          <span class="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-success">
            <span class="relative flex h-2 w-2">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            Incoming call
          </span>
          <span class="text-[10px] font-mono uppercase tracking-wider text-text-muted">Live</span>
        </div>

        <div class="relative flex h-16 w-16 items-center justify-center">
          <div class="absolute inset-0 rounded-full bg-emerald-100 opacity-70 blur-lg"></div>
          <div class="relative flex h-14 w-14 items-center justify-center rounded-full bg-success-subtle text-success ring-1 ring-success-border">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
          </div>
        </div>

        <div>
          <h3 class="text-lg font-bold tracking-tight text-text-primary">{{ activeCall()?.customerNumber }}</h3>
          <p class="mt-0.5 text-xs text-text-secondary">{{ activeCall()?.customerName || 'Incoming customer line' }}</p>
        </div>

        <div class="h-px w-4/5 bg-card-border"></div>

        <!-- Action Buttons: Answer & Reject -->
        <div class="flex items-center gap-8">
          <button (click)="onReject()" class="group flex flex-col items-center gap-2">
            <span class="flex h-14 w-14 items-center justify-center rounded-full bg-danger text-white shadow-md shadow-danger/30 transition-all group-hover:bg-danger-hover group-active:scale-95">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </span>
            <span class="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Decline</span>
          </button>

          <button (click)="onAnswer()" class="group flex flex-col items-center gap-2">
            <span class="flex h-14 w-14 items-center justify-center rounded-full bg-success text-white shadow-md shadow-success/30 transition-all group-hover:bg-success-hover group-active:scale-95">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
            </span>
            <span class="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Answer</span>
          </button>
        </div>
      </div>

      <!-- Active Connected Call Card (also covers outbound dialing/ringing, which has no answer/reject step) -->
      <div *ngIf="activeCall()?.status === 'active' || activeCall()?.status === 'held' || activeCall()?.status === 'dialing' || (activeCall()?.status === 'ringing' && activeCall()?.direction === 'outbound')" class="flex flex-col items-center gap-6">
        <div class="flex w-full items-center justify-between">
          <span class="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest"
            [ngClass]="activeCall()?.isHeld ? 'text-warning' : 'text-success'">
            <span class="h-2 w-2 rounded-full" [ngClass]="activeCall()?.isHeld ? 'bg-warning' : 'bg-success'"></span>
            {{ activeCall()?.isHeld ? 'Held' : (activeCall()?.status === 'dialing' ? 'Dialing' : activeCall()?.status === 'ringing' ? 'Ringing' : 'Connected') }}
          </span>
          <span *ngIf="activeCall()?.status === 'active' || activeCall()?.status === 'held'" class="font-mono text-xs tabular-nums text-text-muted">
            {{ voiceService.formatDuration(activeCall()?.durationSeconds || 0) }}
          </span>
        </div>

        <div>
          <h3 class="text-lg font-bold tracking-tight text-text-primary">{{ activeCall()?.customerNumber }}</h3>
          <p class="mt-0.5 text-xs text-text-secondary">{{ activeCall()?.direction === 'inbound' ? 'Inbound customer call' : 'Outbound dial' }}</p>
        </div>

        <!-- Decorative live waveform, only while actually connected -->
        <div *ngIf="activeCall()?.status === 'active'" class="flex h-5 items-end gap-0.5" aria-hidden="true">
          <span class="waveform-bar w-0.5 rounded-full" [ngClass]="activeCall()?.isMuted ? 'bg-surface-200' : 'bg-emerald-300'" style="animation-delay: 0ms"></span>
          <span class="waveform-bar w-0.5 rounded-full" [ngClass]="activeCall()?.isMuted ? 'bg-surface-200' : 'bg-emerald-400'" style="animation-delay: 120ms"></span>
          <span class="waveform-bar w-0.5 rounded-full" [ngClass]="activeCall()?.isMuted ? 'bg-surface-200' : 'bg-emerald-300'" style="animation-delay: 240ms"></span>
          <span class="waveform-bar w-0.5 rounded-full" [ngClass]="activeCall()?.isMuted ? 'bg-surface-200' : 'bg-emerald-400'" style="animation-delay: 360ms"></span>
          <span class="waveform-bar w-0.5 rounded-full" [ngClass]="activeCall()?.isMuted ? 'bg-surface-200' : 'bg-emerald-300'" style="animation-delay: 480ms"></span>
        </div>

        <div class="h-px w-4/5 bg-card-border"></div>

        <!-- Controls: Mute, Hangup -->
        <div class="flex items-center gap-8">
          <button (click)="onMuteToggle()" class="group flex flex-col items-center gap-2">
            <span class="flex h-14 w-14 items-center justify-center rounded-full border bg-card-bg shadow-sm transition-all group-hover:shadow-md group-active:scale-95"
              [ngClass]="activeCall()?.isMuted ? 'border-warning-border bg-warning-subtle text-warning' : 'border-card-border text-success group-hover:border-success-border'">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z"/></svg>
            </span>
            <span class="text-[10px] font-semibold uppercase tracking-widest text-text-muted">{{ activeCall()?.isMuted ? 'Unmute' : 'Mute' }}</span>
          </button>

          <button (click)="onHangup()" class="group flex flex-col items-center gap-2">
            <span class="flex h-14 w-14 items-center justify-center rounded-full bg-danger text-white shadow-md shadow-danger/30 transition-all group-hover:bg-danger-hover group-active:scale-95">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 00-5.516-5.516l2.257-1.13a1 1 0 00.502-1.21L9.228 3.684A1 1 0 008.279 3H5z"/></svg>
            </span>
            <span class="text-[10px] font-semibold uppercase tracking-widest text-text-muted">End</span>
          </button>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .waveform-bar {
      height: 100%;
      animation: waveform 0.9s ease-in-out infinite;
    }
    @keyframes waveform {
      0%, 100% { height: 30%; }
      50% { height: 100%; }
    }
  `]
})
export class GlobalCallPopupComponent implements OnInit {
  public voiceService = inject(WebRtcVoiceService);
  public activeCall = this.voiceService.activeCall;

  ngOnInit(): void {
    // Ensure softphone SSE connection auto-starts globally if not connected
    if (this.voiceService.connectionState() === 'Disconnected') {
      this.voiceService.registerSoftphone();
    }
  }

  onAnswer(): void {
    this.voiceService.answerCall();
  }

  onReject(): void {
    this.voiceService.rejectCall();
  }

  onHangup(): void {
    this.voiceService.hangupCall();
  }

  onMuteToggle(): void {
    this.voiceService.toggleMute();
  }

  onHoldToggle(): void {
    this.voiceService.toggleHold();
  }
}
