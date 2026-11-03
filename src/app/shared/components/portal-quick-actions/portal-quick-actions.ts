import { Component, HostListener, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PortalState } from '../../../core/services/portal-state';
import { PortalIcon } from '../../portal-icon';

type QaAction = 'raise' | 'track';
interface QaItem { label: string; action?: QaAction; route?: string; }
interface QaSection { id: string; title: string; tone: string; items: QaItem[]; }

@Component({
  selector: 'app-portal-quick-actions',
  standalone: true,
  imports: [CommonModule, PortalIcon],
  templateUrl: './portal-quick-actions.html',
  styleUrls: ['../portal-ui.css', './portal-quick-actions.css'],
})
export class PortalQuickActions implements OnDestroy {
  readonly state = inject(PortalState);
  private router = inject(Router);

  hint = signal('');
  private hintTimer: any;

  /** Items without an `action` are pages that are not built yet. */
  readonly sections: QaSection[] = [
    { id: 'plan', title: 'Plan & Subscription', tone: 'green', items: [
      { label: 'Premium Plan Details', route: '/client-portal/my-plan' }, { label: 'Employee Limit', route: '/client-portal/my-plan' }, { label: 'Renewal Date', route: '/client-portal/my-plan' },
      { label: 'Payment History', route: '/client-portal/invoices' }, { label: 'Upgrade Plan' } ] },
    { id: 'addons', title: 'Add-ons & Integrations', tone: 'purple', items: [
      { label: 'Purchased Add-ons', route: '/client-portal/addons' }, { label: 'Integrations Status' }, { label: 'Add-ons Overview', route: '/client-portal/addons' } ] },
    { id: 'impl', title: 'Implementation Status', tone: 'teal', items: [
      { label: 'Milestone Progress', route: '/client-portal/implementation' }, { label: 'Pending Tasks', route: '/client-portal/implementation' }, { label: 'Documents Required' } ] },
    { id: 'training', title: 'Training Center', tone: 'blue', items: [
      { label: 'Book Training' }, { label: 'View Recordings' }, { label: 'Download Materials' }, { label: 'Training History' } ] },
    { id: 'support', title: 'Support Center', tone: 'blue', items: [
      { label: 'Raise Ticket', action: 'raise' }, { label: 'Track Status', action: 'track' }, { label: 'Support Overview', route: '/client-portal/support' },
      { label: 'Live Chat / Meeting' }, { label: 'Knowledge Base' } ] },
    { id: 'analytics', title: 'Analytics & Usage', tone: 'amber', items: [
      { label: 'Employee Active', route: '/client-portal/usage' }, { label: 'Attendance Overview', route: '/client-portal/usage' }, { label: 'Reports Generated' }, { label: 'App Usage' } ] },
  ];

  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.state.quickActionsOpen()) this.close(); }

  ngOnDestroy(): void { clearTimeout(this.hintTimer); }

  close(): void { this.hint.set(''); this.state.closeQuickActions(); }

  run(item: QaItem): void {
    if (item.route) { this.close(); this.router.navigateByUrl(item.route); return; }
    if (item.action === 'raise') { this.close(); this.state.openRaiseTicket(); return; }
    if (item.action === 'track') { this.close(); this.state.openTicketsList(); return; }
    this.hint.set(`${item.label} is coming soon.`);
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => this.hint.set(''), 2200);
  }
}