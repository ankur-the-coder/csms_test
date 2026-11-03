import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { PortalSidebar } from '../portal-sidebar/portal-sidebar';
import { AuthService } from '../../../core/services/auth-service';
import { PortalState } from '../../../core/services/portal-state';
import { PortalIcon } from '../../portal-icon';
import { PortalTicketsModal } from '../portal-tickets-modal/portal-tickets-modal';
import { PortalTicketDetailModal } from '../portal-ticket-detail-modal/portal-ticket-detail-modal';
import { PortalRaiseTicketModal } from '../portal-raise-ticket-modal/portal-raise-ticket-modal';
import { PortalQuickActions } from '../portal-quick-actions/portal-quick-actions';
import { PortalFeedbackModal } from '../portal-feedback-modal/portal-feedback-modal';

@Component({
  selector: 'portal-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, PortalSidebar, PortalIcon, PortalTicketsModal, PortalTicketDetailModal, PortalRaiseTicketModal, PortalFeedbackModal, PortalQuickActions],
  templateUrl: './portal-shell.html',
  styleUrl: './portal-shell.css',
})
export class PortalShell {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toastr = inject(ToastrService);
  state = inject(PortalState);

  drawer = signal(false);
  profileOpen = signal(false);

  userName = this.auth.getUserName();
  designation = this.auth.getDesignation();
  profileImage = this.auth.getProfileImage();
  imgFailed = signal(false);
  initial = (this.userName || 'U').trim().charAt(0).toUpperCase();

  @HostListener('document:keydown.escape') esc() { this.profileOpen.set(false); this.drawer.set(false); }
  @HostListener('document:click') outside() { this.profileOpen.set(false); }

  toggleProfile(e: Event) { e.stopPropagation(); this.profileOpen.update(v => !v); }
  raiseTicket() {
    this.state.openRaiseTicket();
  }
  logout() { this.auth.logout(); this.router.navigate(['/login']); }
}