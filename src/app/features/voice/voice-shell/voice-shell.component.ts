import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface VoiceTab {
  path: string;
  label: string;
}

@Component({
  selector: 'app-voice-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './voice-shell.component.html',
})
export class VoiceShell {
  readonly tabs: VoiceTab[] = [
    { path: 'softphone', label: 'Dialer' },
    { path: 'history', label: 'Call History' },
    { path: 'recordings', label: 'Recordings' },
    { path: 'clients', label: 'Clients' },
  ];
}
