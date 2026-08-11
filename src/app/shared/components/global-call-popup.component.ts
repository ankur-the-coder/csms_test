import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WebRtcVoiceService } from '../../features/voice/voice.service';

@Component({
  selector: 'app-global-call-popup',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Global Floating Call Modal Overlay -->
    <div *ngIf="activeCall()" class="fixed bottom-6 right-6 z-50 animate-bounce-in max-w-md w-full sm:w-96 shadow-2xl rounded-2xl border border-slate-700/50 bg-slate-900/95 backdrop-blur-md text-white p-5">
      
      <!-- Incoming Call Card -->
      <div *ngIf="activeCall()?.status === 'ringing'" class="space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="relative flex h-4 w-4">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
            </div>
            <span class="text-xs font-semibold uppercase tracking-wider text-emerald-400">Incoming PSTN Call</span>
          </div>
          <span class="text-xs text-slate-400 font-mono">Live SSE</span>
        </div>

        <div class="text-center py-2">
          <div class="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center mx-auto mb-3 text-2xl shadow-inner">
            📞
          </div>
          <h3 class="text-xl font-bold text-slate-100 tracking-tight">
            {{ activeCall()?.customerNumber }}
          </h3>
          <p class="text-sm text-slate-400 mt-1">
            {{ activeCall()?.customerName || 'Incoming Customer Line' }}
          </p>
        </div>

        <!-- Action Buttons: Answer & Reject -->
        <div class="grid grid-cols-2 gap-3 pt-2">
          <button
            (click)="onReject()"
            class="w-full py-2.5 px-4 rounded-xl font-medium text-sm bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-all flex items-center justify-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
            Reject
          </button>
          
          <button
            (click)="onAnswer()"
            class="w-full py-2.5 px-4 rounded-xl font-medium text-sm bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
            </svg>
            Answer
          </button>
        </div>
      </div>

      <!-- Active Connected Call Card -->
      <div *ngIf="activeCall()?.status === 'active' || activeCall()?.status === 'held'" class="space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="inline-block w-2.5 h-2.5 rounded-full" [ngClass]="activeCall()?.isHeld ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'"></span>
            <span class="text-xs font-semibold uppercase tracking-wider" [ngClass]="activeCall()?.isHeld ? 'text-amber-400' : 'text-emerald-400'">
              {{ activeCall()?.isHeld ? 'Call On Hold' : 'Call Connected' }}
            </span>
          </div>
          <span class="text-sm font-mono font-bold text-slate-200 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
            {{ voiceService.formatDuration(activeCall()?.durationSeconds || 0) }}
          </span>
        </div>

        <div class="text-center py-1">
          <h3 class="text-lg font-bold text-slate-100">
            {{ activeCall()?.customerNumber }}
          </h3>
          <p class="text-xs text-slate-400">
            {{ activeCall()?.direction === 'inbound' ? 'Inbound Customer Call' : 'Outbound Dial' }}
          </p>
        </div>

        <!-- Controls: Mute, Hold, Hangup -->
        <div class="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
          <button
            (click)="onMuteToggle()"
            [class.bg-slate-700]="activeCall()?.isMuted"
            class="py-2 px-3 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex flex-col items-center gap-1"
          >
            <span>{{ activeCall()?.isMuted ? '🔇 Unmute' : '🎙️ Mute' }}</span>
          </button>

          <!-- <button
            (click)="onHoldToggle()"
            [class.bg-amber-900\/50]="activeCall()?.isHeld"
            class="py-2 px-3 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex flex-col items-center gap-1"
          >
            <span>{{ activeCall()?.isHeld ? '▶️ Resume' : '⏸️ Hold' }}</span>
          </button> -->

          <button
            (click)="onHangup()"
            class="py-2 px-3 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition flex flex-col items-center gap-1 shadow-md shadow-rose-600/30"
          >
            <span>🛑 Hang Up</span>
          </button>
        </div>
      </div>

    </div>
  `
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
