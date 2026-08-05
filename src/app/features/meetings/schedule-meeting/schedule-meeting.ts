import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ScheduleMeetingService, Organization, OwnerOption } from './schedule-meetings.service';
import { SingleInput, SelectOption } from '../../../shared/components/inputs/single-input/single-input';
import { DatePicker } from '../../../shared/components/inputs/date-picker/date-picker';

type EntryMode = 'select' | 'manual';

@Component({
  selector: 'app-schedule-meeting',
  standalone: true,
  imports: [CommonModule, FormsModule, SingleInput, DatePicker],
  templateUrl: './schedule-meeting.html',
  styleUrls: ['./schedule-meeting.css']
})
export class ScheduleMeeting implements OnInit {
  newMeeting = {
    title: '',
    type: '',
    duration: '1 hour',
    date: null as Date | null,
    time: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High',

    orgMode: 'select' as EntryMode,
    orgId: null as number | null,
    orgName: '',
    orgEmail: '',

    hostMode: 'select' as EntryMode,
    hostType: '' as 'lead' | 'support' | '',
    hostId: '',
    hostName: '',
    hostEmail: '',

    link: '',
    description: ''
  };

  organizations: Organization[] = [];
  hosts: OwnerOption[] = [];

  private leadOwners: OwnerOption[] = [];
  private supportOwners: OwnerOption[] = [];

  meetingTypesList = ['Kickoff', 'Review', 'Training', 'QBR', 'Go Live', 'Renewal'];
  priorities: Array<'Low' | 'Medium' | 'High'> = ['Low', 'Medium', 'High'];

  loadingInitialData = true;

  constructor(
    private router: Router,
    private scheduleMeetingService: ScheduleMeetingService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.loadAllData();
  }

  private loadAllData(): void {
    this.loadingInitialData = true;

    forkJoin({
      organizations: this.scheduleMeetingService.getOrganizations(),
      leadOwners: this.scheduleMeetingService.getLeadOwners(),
      supportOwners: this.scheduleMeetingService.getSupportOwners()
    }).subscribe({
      next: ({ organizations, leadOwners, supportOwners }) => {
        this.ngZone.run(() => {
          this.organizations = organizations;
          this.leadOwners = leadOwners;
          this.supportOwners = supportOwners;
          this.loadingInitialData = false;
        });
      },
      error: (err) => {
        console.error('Failed to load schedule-meeting form data', err);
        this.ngZone.run(() => { this.loadingInitialData = false; });
      }
    });
  }

  // ---------- SelectOption helpers ----------

  get meetingTypeOptions(): SelectOption[] {
    return this.meetingTypesList.map(t => ({ label: t, value: t }));
  }

  get durationOptions(): SelectOption[] {
    return [
      { label: '15 minutes', value: '15 minutes' },
      { label: '30 minutes', value: '30 minutes' },
      { label: '45 minutes', value: '45 minutes' },
      { label: '1 hour', value: '1 hour' },
      { label: '1.5 hours', value: '1.5 hours' },
      { label: '2 hours', value: '2 hours' }
    ];
  }

  get priorityOptions(): SelectOption[] {
    return this.priorities.map(p => ({ label: p, value: p }));
  }

  get organizationOptions(): SelectOption[] {
    return this.organizations.map(o => ({ label: o.name, value: o.orgId }));
  }

  get hostTypeOptions(): SelectOption[] {
    return [
      { label: 'Lead Owner', value: 'lead' },
      { label: 'Support Owner', value: 'support' }
    ];
  }

  get hostOptions(): SelectOption[] {
    return this.hosts.map(h => ({ label: h.name, value: h.id }));
  }

  // ---------- Organization ----------

  setOrgMode(mode: EntryMode): void {
    if (this.newMeeting.orgMode === mode) return;
    this.newMeeting.orgMode = mode;
    this.newMeeting.orgId = null;
    this.newMeeting.orgName = '';
    this.newMeeting.orgEmail = '';
  }

  onOrganizationSelect(orgIdValue: any): void {
    const orgId = Number(orgIdValue);
    const org = this.organizations.find(o => o.orgId === orgId);
    this.newMeeting.orgId = org ? org.orgId : null;
    this.newMeeting.orgName = org ? org.name : '';
    this.newMeeting.orgEmail = org ? org.email : '';
  }

  // ---------- Host ----------

  setHostMode(mode: EntryMode): void {
    if (this.newMeeting.hostMode === mode) return;
    this.newMeeting.hostMode = mode;
    this.newMeeting.hostType = '';
    this.newMeeting.hostId = '';
    this.newMeeting.hostName = '';
    this.newMeeting.hostEmail = '';
    this.hosts = [];
  }

  onHostTypeChange(type: any): void {
    if (this.newMeeting.hostType === type) return;
    this.newMeeting.hostType = type;
    this.newMeeting.hostId = '';
    this.newMeeting.hostName = '';
    this.newMeeting.hostEmail = '';
    this.hosts = type === 'lead' ? this.leadOwners : this.supportOwners;
  }

  onHostSelect(hostId: any): void {
    const owner = this.hosts.find(h => h.id === hostId);
    this.newMeeting.hostId = hostId;
    this.newMeeting.hostName = owner ? owner.name : '';
    this.newMeeting.hostEmail = owner ? owner.email : '';
  }

  // ---------- Misc ----------

  trackByOrgId(_index: number, org: Organization): number {
    return org.orgId;
  }

  trackByHostId(_index: number, host: OwnerOption): string {
    return host.id;
  }

  getDefaultAttendees(): string[] {
    return ['Client Contact', 'Project Manager'];
  }

  goBack(): void {
    this.router.navigate(['/meetings']);
  }

  saveAsDraft(): void {
    console.log('Saved as draft', this.newMeeting);
    this.goBack();
  }

  saveMeeting(): void {
    console.log('Scheduled meeting', this.newMeeting);
    this.goBack();
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  isFormValid(): boolean {
    const m = this.newMeeting;

    const orgOk = m.orgMode === 'select'
      ? !!m.orgId
      : m.orgName.trim().length > 0 && this.isValidEmail(m.orgEmail);

    const hostOk = m.hostMode === 'select'
      ? !!m.hostId
      : m.hostName.trim().length > 0 && this.isValidEmail(m.hostEmail);

    return !!(m.title && m.type && m.date && m.time && orgOk && hostOk);
  }
}