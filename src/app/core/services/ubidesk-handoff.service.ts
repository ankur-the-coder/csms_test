import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';

export type HandoffDestination =
  | { type: 'home' }
  | { type: 'ticket'; ticketUid: string }
  | { type: 'org'; orgId: number };

@Injectable({
  providedIn: 'root',
})
export class UbiDeskHandoffService {
  private readonly http = inject(HttpClient);
  private readonly toastr = inject(ToastrService);
  private readonly baseUrl = environment.apiUrl;

  /**
   * Securely handoff an authenticated agent to ubiDesk.
   * Opens window synchronously to avoid popup blockers, then redirects upon token generation.
   */
  public async openUbiDesk(destination: HandoffDestination): Promise<void> {
    if (typeof window === 'undefined') return;

    // Open blank window immediately on user gesture to avoid popup blocker
    const targetTab = window.open('about:blank', '_blank');
    if (targetTab) {
      targetTab.opener = null;
    }

    try {
      const res = await firstValueFrom(
        this.http.post<{ status: boolean; data?: { url: string }; msg?: string }>(
          `${this.baseUrl}/sso/ubidesk/handoff`,
          { destination }
        )
      );

      if (res?.status && res?.data?.url) {
        if (targetTab) {
          targetTab.location.href = res.data.url;
        } else {
          window.location.href = res.data.url;
        }
      } else {
        if (targetTab) targetTab.close();
        this.toastr.error(res?.msg || 'Authentication error', 'Handoff Failed');
      }
    } catch (err: any) {
      if (targetTab) targetTab.close();
      const msg = err?.error?.msg || 'Failed to connect to ubiDesk. Please try again.';
      this.toastr.error(msg, 'Authentication Error');
    }
  }

  public openTicket(ticketUid: string): Promise<void> {
    return this.openUbiDesk({ type: 'ticket', ticketUid });
  }

  public openOrg(orgId: number): Promise<void> {
    return this.openUbiDesk({ type: 'org', orgId });
  }

  public openHome(): Promise<void> {
    return this.openUbiDesk({ type: 'home' });
  }
}
