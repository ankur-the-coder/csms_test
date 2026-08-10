import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { WebRtcVoiceService } from '../../voice.service';

@Component({
  selector: 'app-voice-softphone',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  private route = inject(ActivatedRoute);

  /** Hidden audio element that receives the remote WebRTC stream */
  @ViewChild('remoteAudio') remoteAudioRef!: ElementRef<HTMLAudioElement>;

  dialNumber = '';
  customerNameInput = '';
  selectedClientOrgId: number | null = null;
  clientSearch = '';
  private clientSearchDebounce: any = null;

  keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

  onClientSearchChange(term: string): void {
    this.clientSearch = term;
    if (this.clientSearchDebounce) clearTimeout(this.clientSearchDebounce);
    this.clientSearchDebounce = setTimeout(() => {
      this.voiceService.fetchAdminClients(term);
    }, 300);
  }

  onSelectClient(orgId: number | string): void {
    const id = Number(orgId);
    const client = this.voiceService.adminClients().find(c => c.orgId === id);
    if (!client) {
      this.selectedClientOrgId = null;
      return;
    }
    this.selectedClientOrgId = client.orgId;
    this.dialNumber = client.phoneNumber || '';
    this.customerNameInput = client.name || '';
  }

  ngOnInit(): void {
    // Registration is deferred to ngAfterViewInit so the audio element exists first

    // Pre-fill from ?orgId=&number=&name= when navigated here from the
    // Clients tab's "Call" button (see clients.ts -> callClient()).
    const qp = this.route.snapshot.queryParamMap;
    const orgId = qp.get('orgId');
    const number = qp.get('number');
    const name = qp.get('name');
    if (orgId) this.selectedClientOrgId = Number(orgId);
    if (number) this.dialNumber = number;
    if (name) this.customerNameInput = name;
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

  refreshAdminClients(): void {
    this.voiceService.fetchAdminClients(this.clientSearch);
  }

  simulateIncomingCall(): void {
    const mockId = Math.floor(Math.random() * 1000) + 100;
    this.voiceService.receiveIncomingCall(mockId, '+18005550199', 'Sarah Jenkins (TechGlobal)');
  }
}
