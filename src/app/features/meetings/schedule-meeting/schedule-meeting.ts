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

    description: ''
  };

  organizations: Organization[] = [];
  hosts: OwnerOption[] = [];

  /** Populated with the Teams join link once the meeting is successfully created. */
  createdMeetingLink: string | null = null;

  private leadOwners: OwnerOption[] = [];
  private supportOwners: OwnerOption[] = [];

  meetingTypesList = ['Kickoff', 'Review', 'Training', 'QBR', 'Go Live', 'Renewal'];
  priorities: Array<'Low' | 'Medium' | 'High'> = ['Low', 'Medium', 'High'];

  loadingInitialData = true;

  /** True once the user has attempted to submit — turns on field-level error messages. */
  submitted = false;

  saving = false;

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

  goBack(): void {
    this.router.navigate(['/meetings']);
  }

  saveAsDraft(): void {
    console.log('Saved as draft', this.newMeeting);
    this.goBack();
  }

  onScheduleClick(): void {
    if (!this.isFormValid()) {
      this.submitted = true;
      return;
    }
    this.submitted = false;
    this.saveMeeting();
  }

  saveMeeting(): void {

    this.saving = true;

    let start: string;
    let end: string;

    try {
      start = this.buildStartDateTime();
      end = this.buildEndDateTime(start);
    } catch (err) {
      console.error('Failed to build meeting start/end time', err);
      this.saving = false;
      alert('Something is wrong with the selected date/time. Please re-pick the date and time and try again.');
      return;
    }

    const payload = {

        hostEmail: this.newMeeting.hostEmail,

        clientEmails: [

            this.newMeeting.orgEmail

        ],

        title: this.newMeeting.title,

        purpose: this.newMeeting.description,

        start,

        end

    };

    console.log("Teams Payload", payload);

    this.scheduleMeetingService
        .createTeamsMeeting(payload)
        .subscribe({

            next: (res) => {

                console.log("Teams Response", res);

                this.createdMeetingLink = res.meetingLink;
                this.saving = false;

                alert("Teams Meeting Created Successfully");

                this.goBack();

            },
            error: (err) => {
                console.error(err);
                this.saving = false;
                alert("Failed to create Teams meeting");
            }
        });
}

private buildStartDateTime(): string {

    // The date-picker may emit a real Date, an ISO string, or a
    // dd/mm/yyyy-style string depending on its implementation — normalize
    // whatever we get into an actual Date before reading from it.
    const raw = this.newMeeting.date as unknown;
    const d = raw instanceof Date ? raw : new Date(raw as string);

    if (!raw || isNaN(d.getTime())) {
        throw new Error(`Invalid meeting date value: ${JSON.stringify(raw)}`);
    }

    if (!this.newMeeting.time || !/^\d{2}:\d{2}$/.test(this.newMeeting.time)) {
        throw new Error(`Invalid meeting time value: ${JSON.stringify(this.newMeeting.time)}`);
    }

    const yyyy = d.getFullYear();

    const mm = String(d.getMonth() + 1).padStart(2, '0');

    const dd = String(d.getDate()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}T${this.newMeeting.time}:00`;

}

private buildEndDateTime(start: string): string {

    // `start` is a plain local-time string (yyyy-mm-ddThh:mm:00, no timezone).
    // `new Date(start)` parses that as local time, which is correct — but we
    // must format the result back out as local-time components too. Using
    // .toISOString() here would convert to UTC and silently shift the time
    // by the browser's timezone offset, producing an `end` that no longer
    // lines up with `start` (e.g. IST users would see `end` land ~5.5 hours
    // "before" `start`, tripping the backend's end-after-start validation).
    const end = new Date(start);

    switch (this.newMeeting.duration) {

        case '15 minutes':
            end.setMinutes(end.getMinutes() + 15);
            break;

        case '30 minutes':
            end.setMinutes(end.getMinutes() + 30);
            break;

        case '45 minutes':
            end.setMinutes(end.getMinutes() + 45);
            break;

        case '1 hour':
            end.setHours(end.getHours() + 1);
            break;

        case '1.5 hours':
            end.setMinutes(end.getMinutes() + 90);
            break;

        case '2 hours':
            end.setHours(end.getHours() + 2);
            break;

        default:
            end.setHours(end.getHours() + 1);

    }

    const yyyy = end.getFullYear();
    const mm = String(end.getMonth() + 1).padStart(2, '0');
    const dd = String(end.getDate()).padStart(2, '0');
    const hh = String(end.getHours()).padStart(2, '0');
    const mi = String(end.getMinutes()).padStart(2, '0');
    const ss = String(end.getSeconds()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;

}

  private isValidEmail(value: string): boolean {
    const email = value.trim();
    // Standard RFC-5322-ish check. Deliberately provider-agnostic —
    // gmail.com, outlook.com, hotmail.com, any company domain, all pass.
    return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/.test(email);
  }

  isFormValid(): boolean {
    const m = this.newMeeting;

    const orgOk = m.orgMode === 'select'
      ? !!m.orgId
      : m.orgName.trim().length > 0 && this.isValidEmail(m.orgEmail);

    const hostOk = m.hostMode === 'select'
      ? !!m.hostType && !!m.hostId
      : m.hostName.trim().length > 0 && this.isValidEmail(m.hostEmail);

    return !!(m.title.trim() && m.type && m.date && m.time && orgOk && hostOk);
  }

  // ---------- Inline field errors (shown only after a submit attempt) ----------

  get showTitleError(): boolean {
    return this.submitted && !this.newMeeting.title.trim();
  }

  get showTypeError(): boolean {
    return this.submitted && !this.newMeeting.type;
  }

  get showDateError(): boolean {
    return this.submitted && !this.newMeeting.date;
  }

  get showTimeError(): boolean {
    return this.submitted && !this.newMeeting.time;
  }

  get showOrgSelectError(): boolean {
    return this.submitted && this.newMeeting.orgMode === 'select' && !this.newMeeting.orgId;
  }

  get showOrgNameError(): boolean {
    return this.submitted && this.newMeeting.orgMode === 'manual' && !this.newMeeting.orgName.trim();
  }

  get showOrgEmailError(): boolean {
    return this.submitted && this.newMeeting.orgMode === 'manual' && !this.isValidEmail(this.newMeeting.orgEmail);
  }

  get showHostCategoryError(): boolean {
    return this.submitted && this.newMeeting.hostMode === 'select' && !this.newMeeting.hostType;
  }

  get showHostSelectError(): boolean {
    return this.submitted && this.newMeeting.hostMode === 'select'
      && !!this.newMeeting.hostType && !this.newMeeting.hostId;
  }

  get showHostNameError(): boolean {
    return this.submitted && this.newMeeting.hostMode === 'manual' && !this.newMeeting.hostName.trim();
  }

  get showHostEmailError(): boolean {
    return this.submitted && this.newMeeting.hostMode === 'manual' && !this.isValidEmail(this.newMeeting.hostEmail);
  }
}