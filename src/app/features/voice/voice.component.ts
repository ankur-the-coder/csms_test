import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WebRtcVoiceService } from './voice.service';

@Component({
  selector: 'app-voice-softphone',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './voice.component.html',
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
export class VoiceComponent implements OnInit, OnDestroy {
  public voiceService = inject(WebRtcVoiceService);

  dialNumber = '+13055550100';
  customerNameInput = 'John Doe (Acme Corp)';

  // Keypad buttons
  keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

  ngOnInit(): void {
    // Automatically attempt browser softphone registration on load
    this.voiceService.registerSoftphone();
  }

  ngOnDestroy(): void {
    // Clean up softphone session and SSE stream when leaving component to prevent leaks
    this.voiceService.closeSSE(true);
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
