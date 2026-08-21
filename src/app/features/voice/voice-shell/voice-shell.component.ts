import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SingleInput, SelectOption } from '../../../shared/components/inputs/single-input/single-input';
import { WebRtcVoiceService } from '../voice.service';

interface VoiceTab {
  path: string;
  label: string;
}

@Component({
  selector: 'app-voice-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, SingleInput],
  templateUrl: './voice-shell.component.html',
})
export class VoiceShell {
  private readonly router = inject(Router);
  /** Public: template reads voiceService.missedCallsCount() for the Call History tab badge. */
  readonly voiceService = inject(WebRtcVoiceService);

  readonly tabs: VoiceTab[] = [
    { path: 'dashboard', label: 'Dashboard' },
    { path: 'softphone', label: 'Dialer' },
    { path: 'history', label: 'Call History' },
    // { path: 'recordings', label: 'Recordings' },
    { path: 'clients', label: 'Clients' },
  ];

  readonly selectOptions: SelectOption[] = [
    { label: 'Dashboard', value: 'dashboard' },
    { label: 'Dialer', value: 'softphone' },
    { label: 'Call History', value: 'history' },
    // { label: 'Recordings', value: 'recordings' },
    { label: 'Clients', value: 'clients' },
  ];

  onSelectTab(value: any): void {
    const val = typeof value === 'object' && value !== null ? value.value : value;
    if (val) {
      this.router.navigate(['/voice', String(val)]);
    }
  }

  get activeTabPath(): string {
    const current = this.tabs.find(t => this.router.url.includes(`/voice/${t.path}`));
    return current ? current.path : 'dashboard';
  }
}


