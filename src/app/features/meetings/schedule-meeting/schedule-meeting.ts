import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ScheduleMeetingService, Organization, EmployeeDetails, BookedMeeting } from './schedule-meetings.service';
import { SingleInput, SelectOption } from '../../../shared/components/inputs/single-input/single-input';
import { DatePicker } from '../../../shared/components/inputs/date-picker/date-picker';
import { DatePicker as DatePickerService } from '../../../shared/service/date-picker/date-picker';
import { TimePickerComponent } from '../../../shared/components/inputs/time-picker/time-picker';
import { Subscription } from 'rxjs';
import { Location } from '@angular/common';
import { Utils } from '../../../shared/utils/utils';

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

    orgMode: 'manual' as EntryMode,
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

  /** Meetings already booked on the selected date (fetched from API). */
  bookedMeetings: BookedMeeting[] = [];

  /** True while the booked-times API call is in-flight. */
  loadingBookedTimes = false;

  /** Non-empty when the selected time+duration overlaps an existing meeting. */
  conflictMessage = '';

  /** Subscription for the booked-times API so we can cancel on rapid date changes. */
  private bookedTimesSub?: Subscription;

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
    this.checkTimeConflict();
  }

  organizations: Organization[] = [];

  /** Populated with the Teams join link once the meeting is successfully created. */
  createdMeetingLink: string | null = null;

  /** True while we're fetching the logged-in user's details to use as the host. */
  hostDetailsLoading = true;

  /** True if fetching the host's details failed — UI falls back to manual host entry. */
  hostDetailsError = false;

  meetingTypesList: string[] = [];
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
    private route: ActivatedRoute,
    private scheduleMeetingService: ScheduleMeetingService,
    private ngZone: NgZone,
    private toastr: ToastrService,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.readQueryParams();
    this.loadAllData();
    this.loadHostDetails();
  }

  private readQueryParams(): void {
    this.route.queryParamMap.subscribe(params => {
      const orgName = params.get('orgName') || params.get('name') || params.get('companyName');
      const email = params.get('email') || params.get('orgEmail');
      const orgId = params.get('orgId');

      if (orgName) {
        this.newMeeting.orgName = orgName;
      }
      if (email) {
        this.newMeeting.orgEmail = email;
      }
      if (orgId) {
        const parsedId = Number(Utils.decode5t(orgId));
        if (!isNaN(parsedId)) {
          this.newMeeting.orgId = parsedId;
        }
      }
      if (orgName || email) {
        this.newMeeting.orgMode = 'manual';
      }
    });
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

      this.scheduleMeetingService.getMeetingTypes().subscribe({
    next: (types) => {
      this.ngZone.run(() => {
        this.meetingTypesList = types.length > 0
          ? types.map(t => t.name)
          : [];
      });
    },
    error: (err) => {
      console.error('Failed to load meeting types', err);
      this.ngZone.run(() => {
        this.meetingTypesList = ['Failed to load Options'];
      });
    }
  });
  }

  /**
   * Reads the logged-in user's email and name from localStorage, decodes
   * them with Utils.decode5t, and uses them as the meeting host.
   * No API call needed — email, empId, userName are already in localStorage.
   */
  loadHostDetails(): void {
    const rawEmail = localStorage.getItem('email') || '';
    const rawName = localStorage.getItem('userName') || '';
    const rawEmpId = localStorage.getItem('empId') || '';

    const email = Utils.decode5t(rawEmail);
    const name = rawName;

    if (email) {
      this.newMeeting.hostEmail = email;
      this.newMeeting.hostName = name || 'Host';
      this.newMeeting.hostId = rawEmpId; // keep encoded
      this.newMeeting.hostMode = 'select';
      this.hostDetailsLoading = false;
      this.hostDetailsError = false;
    } else {
      this.hostDetailsLoading = false;
      this.hostDetailsError = true;
      this.newMeeting.hostMode = 'manual';
    }
  }

  /**
   * Reads the current employee id from localStorage (set at login as 'empId').
   * localStorage always returns a string — the backend expects a numeric
   * employeeId (as sent from Postman), so this coerces it to a number.
   */
  private getCurrentEmployeeId(): string | null {
    const raw = localStorage.getItem('empId');
    if (!raw) return null;
    return raw;
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
    this.isEditingOrgEmail = false;
  }

  onOrganizationSelect(orgIdValue: any): void {
    const orgId = Number(orgIdValue);
    const org = this.organizations.find(o => o.orgId === orgId);
    this.newMeeting.orgId = org ? org.orgId : null;
    this.newMeeting.orgName = org ? org.name : '';
    this.newMeeting.orgEmail = org ? org.email : '';
    this.isEditingOrgEmail = false;
  }

  // ---------- Organization email override ----------
// Lets the user override the registered org email for this one meeting
// without touching the organization's actual record.

isEditingOrgEmail = false;
private orgEmailBeforeEdit = '';

enableOrgEmailEdit(): void {
  this.orgEmailBeforeEdit = this.newMeeting.orgEmail;
  this.isEditingOrgEmail = true;
}

saveOrgEmailEdit(): void {
  if (!this.isValidEmail(this.newMeeting.orgEmail)) return;
  this.isEditingOrgEmail = false;
}

cancelOrgEmailEdit(): void {
  this.newMeeting.orgEmail = this.orgEmailBeforeEdit;
  this.isEditingOrgEmail = false;
}

  // ---------- Misc ----------

  trackByOrgId(_index: number, org: Organization): number {
    return org.orgId;
  }

  goBack(): void {
    this.location.back();
  }

  saveAsDraft(): void {
    this.goBack();
  }

  onScheduleClick(): void {
    if (!this.isFormValid()) {
      this.submitted = true;
      this.toastr.warning('Please fill in all required fields before scheduling.', 'Validation Warning');
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
      this.toastr.error('Something is wrong with the selected date/time. Please re-pick the date and time.', 'Invalid Date/Time');
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
        orgId: localStorage.getItem('orgId') || this.newMeeting.orgId,
        orgName: this.newMeeting.orgName,

        hostId: this.newMeeting.hostId,
        hostName: this.newMeeting.hostName,
        empId: localStorage.getItem('empId') || '',
        email: localStorage.getItem('email') || ''

    };


    this.scheduleMeetingService
        .createTeamsMeeting(payload)
        .subscribe({

            next: (res) => {


                this.createdMeetingLink = res.meetingLink || null;
                this.saving = false;

                this.toastr.success('Teams Meeting Created Successfully!', 'Success');

                this.goBack();

            },
            error: (err) => {
                console.error(err);
                this.saving = false;
                const errDetail = err?.error?.message || err?.message || 'Failed to create Teams meeting';
                this.toastr.error(errDetail, 'Creation Failed');
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

  isValidEmail(value: string): boolean {
    const email = value.trim();
    // Standard RFC-5322-ish check. Deliberately provider-agnostic —
    // gmail.com, outlook.com, hotmail.com, any company domain, all pass.
    return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/.test(email);
  }

  isFormValid(): boolean {
    const m = this.newMeeting;

    const orgOk = m.orgMode === 'select'
      ? !!m.orgId && this.isValidEmail(m.orgEmail)
      : m.orgName.trim().length > 0 && this.isValidEmail(m.orgEmail);

    // 'select' mode means the host was auto-filled from the logged-in user;
    // 'manual' mode is the fallback used when that fetch failed.
    const hostOk = m.hostMode === 'select'
      ? this.isValidEmail(m.hostEmail)
      : m.hostName.trim().length > 0 && this.isValidEmail(m.hostEmail);

    return !!(m.title.trim() && m.type && m.date && m.time && orgOk && hostOk && !this.hostDetailsLoading && !this.hasConflict && !this.loadingBookedTimes);
  }

  /** True when the selected time slot conflicts with an existing booking. */
  get hasConflict(): boolean {
    return this.conflictMessage.length > 0;
  }

  // ---------- Booked-times / conflict detection ----------

  /**
   * Called when the meeting date changes. Fetches booked meetings for
   * the selected date from the backend and then re-checks for conflicts.
   */
  onDateChange(): void {
    // Cancel any in-flight request
    this.bookedTimesSub?.unsubscribe();
    this.bookedMeetings = [];
    this.conflictMessage = '';

    if (!this.newMeeting.date) return;

    const empId = this.getCurrentEmployeeId();
    if (!empId) return;

    // Build the date string (yyyy-MM-dd) from the selected date
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
    if (isNaN(d.getTime())) return;

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    this.loadingBookedTimes = true;

    // Immediately check for past time conflict on the newly selected date
    this.checkTimeConflict();

    this.bookedTimesSub = this.scheduleMeetingService.getBookedTimes(empId, dateStr).subscribe({
      next: (meetings) => {
        this.ngZone.run(() => {
          this.bookedMeetings = meetings || [];
          this.loadingBookedTimes = false;
          this.checkTimeConflict();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.bookedMeetings = [];
          this.loadingBookedTimes = false;
          this.checkTimeConflict();
        });
      }
    });
  }

  /**
   * Called when time or duration changes. Checks whether:
   * 1. The proposed meeting time is in the past if the selected date is today.
   * 2. The proposed meeting window overlaps any already-booked meeting on the selected date.
   */
  checkTimeConflict(): void {
    this.conflictMessage = '';

    if (!this.newMeeting.time || !this.newMeeting.date) {
      return;
    }

    // Parse selected date
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
    if (isNaN(d.getTime())) return;

    // Build proposed start/end as minutes-since-midnight
    const [h, m] = this.newMeeting.time.split(':').map(Number);
    const proposedStartMin = h * 60 + m;
    const proposedEndMin = proposedStartMin + this.getDurationMinutes();

    // 1. Prevent selecting past time if date is today
    const now = new Date();
    const isToday = d.getFullYear() === now.getFullYear() &&
                    d.getMonth() === now.getMonth() &&
                    d.getDate() === now.getDate();

    if (isToday) {
      const currentMin = now.getHours() * 60 + now.getMinutes();
      if (proposedStartMin < currentMin) {
        this.conflictMessage = 'The selected time has already passed for today. Please select a current or future time.';
        return;
      }
    }

    // 2. Check overlap with existing booked meetings
    if (this.bookedMeetings && this.bookedMeetings.length > 0) {
      for (const meeting of this.bookedMeetings) {
        const start = new Date(meeting.startTime);
        const end = new Date(meeting.endTime);

        const bookedStartMin = start.getHours() * 60 + start.getMinutes();
        const bookedEndMin = end.getHours() * 60 + end.getMinutes();

        // Two intervals overlap if one starts before the other ends and vice-versa
        if (proposedStartMin < bookedEndMin && proposedEndMin > bookedStartMin) {
          const startStr = this.formatTime(start);
          const endStr = this.formatTime(end);
          this.conflictMessage = `A meeting "${meeting.title}" is already scheduled from ${startStr} to ${endStr}. Please choose a different time.`;
          return;
        }
      }
    }
  }

  /** Returns the current duration selection as total minutes. */
  private getDurationMinutes(): number {
    switch (this.newMeeting.duration) {
      case '15 minutes': return 15;
      case '30 minutes': return 30;
      case '45 minutes': return 45;
      case '1 hour':     return 60;
      case '1.5 hours':  return 90;
      case '2 hours':    return 120;
      default:           return 60;
    }
  }

  /** Formats a Date to a human-readable 12-hour time string. */
  private formatTime(d: Date): string {
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const amPm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${String(minutes).padStart(2, '0')} ${amPm}`;
  }

  /** Re-check conflict whenever the duration dropdown changes. */
  onDurationChange(): void {
    this.checkTimeConflict();
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