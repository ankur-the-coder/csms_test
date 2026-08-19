import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ScheduleMeetingService, Organization, EmployeeDetails } from './schedule-meetings.service';
import { SingleInput, SelectOption } from '../../../shared/components/inputs/single-input/single-input';
import { DatePicker } from '../../../shared/components/inputs/date-picker/date-picker';
import { DatePicker as DatePickerService } from '../../../shared/service/date-picker/date-picker';
import { TimePickerComponent } from '../../../shared/components/inputs/time-picker/time-picker';

type EntryMode = 'select' | 'manual';

@Component({
  selector: 'app-schedule-meeting',
  standalone: true,
  imports: [CommonModule, FormsModule, SingleInput, DatePicker, TimePickerComponent],
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

    // hostMode 'select' = auto-filled from the logged-in user (the normal path).
    // hostMode 'manual' = fallback used only if we couldn't fetch the current user's details.
    hostMode: 'select' as EntryMode,
    hostId: '',
    hostName: '',
    hostEmail: '',

    description: ''
  };

  minDateToday: Date = new Date();

  get meetingTimeMinutes(): number {
    if (!this.newMeeting.time) return 0;
    const parts = String(this.newMeeting.time).split(':');
    if (parts.length >= 2) {
      return (parseInt(parts[0], 10) * 60) + parseInt(parts[1], 10);
    }
    return 0;
  }

  set meetingTimeMinutes(val: number) {
    if (val === null || val === undefined) {
      this.newMeeting.time = '';
      return;
    }
    const hours = String(Math.floor(val / 60)).padStart(2, '0');
    const mins = String(val % 60).padStart(2, '0');
    this.newMeeting.time = `${hours}:${mins}`;
  }

  organizations: Organization[] = [];

  /** Populated with the Teams join link once the meeting is successfully created. */
  createdMeetingLink: string | null = null;

  /** True while we're fetching the logged-in user's details to use as the host. */
  hostDetailsLoading = true;

  /** True if fetching the host's details failed — UI falls back to manual host entry. */
  hostDetailsError = false;

  meetingTypesList = ['Kickoff', 'Review', 'Training', 'QBR', 'Go Live', 'Renewal'];
  priorities: Array<'Low' | 'Medium' | 'High'> = ['Low', 'Medium', 'High'];

  // Backend validates priority via an enum rule expecting a number: 0 = Low, 1 = Medium, 2 = High.
  private readonly priorityMap: Record<'Low' | 'Medium' | 'High', number> = {
    Low: 0,
    Medium: 1,
    High: 2
  };

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
    this.loadHostDetails();
  }

  private loadAllData(): void {
    this.loadingInitialData = true;

    this.scheduleMeetingService.getOrganizations().subscribe({
      next: (organizations) => {
        this.ngZone.run(() => {
          this.organizations = organizations;
          this.loadingInitialData = false;
        });
      },
      error: (err) => {
        console.error('Failed to load schedule-meeting form data', err);
        this.ngZone.run(() => { this.loadingInitialData = false; });
      }
    });
  }

  /**
   * Fetches the logged-in user's email/name and uses it as the meeting host,
   * so the meeting is created on behalf of whoever is currently logged in.
   *
   * The logged-in user's id is read from localStorage('empId') below.
   */
  loadHostDetails(): void {
    const employeeId = this.getCurrentEmployeeId();

    if (!employeeId) {
      console.error('No employeeId available for the current session — cannot auto-fill host.');
      this.hostDetailsLoading = false;
      this.hostDetailsError = true;
      this.newMeeting.hostMode = 'manual';
      return;
    }

    this.hostDetailsLoading = true;
    this.hostDetailsError = false;

    this.scheduleMeetingService.getEmployeeDetails(employeeId).subscribe({
      next: (details: EmployeeDetails) => {
        this.ngZone.run(() => {
          this.newMeeting.hostEmail = details.currentMail;
          this.newMeeting.hostName = details.name;
          this.newMeeting.hostId = String(details.companyId ?? employeeId);
          this.newMeeting.hostMode = 'select';
          this.hostDetailsLoading = false;
          this.hostDetailsError = false;
        });
      },
      error: (err) => {
        console.error('Failed to fetch current user (host) details:', err.status, err.error ?? err.message);
        this.ngZone.run(() => {
          this.hostDetailsLoading = false;
          this.hostDetailsError = true;
          this.newMeeting.hostMode = 'manual';
        });
      }
    });
  }

  /**
   * Reads the current employee id from localStorage (set at login as 'empId').
   * localStorage always returns a string — the backend expects a numeric
   * employeeId (as sent from Postman), so this coerces it to a number.
   */
  private getCurrentEmployeeId(): number | null {
    const raw = localStorage.getItem('empId');
    if (!raw) return null;
    const parsed = Number(raw);
    return isNaN(parsed) ? null : parsed;
  }

  retryHostFetch(): void {
    this.loadHostDetails();
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

  // ---------- Misc ----------

  trackByOrgId(_index: number, org: Organization): number {
    return org.orgId;
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

    // Full form state, useful for debugging
    console.log('Full meeting form data', this.newMeeting);

    const payload = {

        hostEmail: this.newMeeting.hostEmail,

        clientEmails: [

            this.newMeeting.orgEmail

        ],

        title: this.newMeeting.title,

        purpose: this.newMeeting.description,

        start,

        end,

        // --- additional fields ---
        meetingType: this.newMeeting.type,
        duration: this.newMeeting.duration,

        // Backend validator requires a number: 0 = Low, 1 = Medium, 2 = High.
        priority: this.priorityMap[this.newMeeting.priority],

        // NOTE: keys must be orgId/orgName — MeetingsService.createMeeting()
        // reads data.orgId / data.orgName directly. Sending
        // organizationId/organizationName here means the backend never
        // receives them, and OrgId/OrgName silently fail validation or
        // insert as null/empty.
        orgId: this.newMeeting.orgId,
        orgName: this.newMeeting.orgName,

        hostId: this.newMeeting.hostId,
        hostName: this.newMeeting.hostName,
        empId: localStorage.getItem('empId') || ''

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

    const raw = this.newMeeting.date as unknown;
    let d: Date;

    if (raw instanceof Date) {
      d = raw;
    } else if (typeof raw === 'string' && raw.includes(',')) {
      const rev = DatePickerService.reverseFormatDate(raw);
      d = new Date(rev);
    } else {
      d = new Date(raw as string);
    }

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

    // 'select' mode means the host was auto-filled from the logged-in user;
    // 'manual' mode is the fallback used when that fetch failed.
    const hostOk = m.hostMode === 'select'
      ? this.isValidEmail(m.hostEmail)
      : m.hostName.trim().length > 0 && this.isValidEmail(m.hostEmail);

    return !!(m.title.trim() && m.type && m.date && m.time && orgOk && hostOk && !this.hostDetailsLoading);
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

  get showHostNameError(): boolean {
    return this.submitted && this.newMeeting.hostMode === 'manual' && !this.newMeeting.hostName.trim();
  }

  get showHostEmailError(): boolean {
    return this.submitted && this.newMeeting.hostMode === 'manual' && !this.isValidEmail(this.newMeeting.hostEmail);
  }
}