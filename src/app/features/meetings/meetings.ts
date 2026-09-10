import { Component, signal, computed, ViewChild, ElementRef, OnInit, OnDestroy, HostListener,ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { MeetingService, MeetingRow, Organization, DashboardStats, AttendanceCheckResponse, RescheduleMeetingResponse, RecentActivity } from './meetings.service';
import { DataTable } from '../../shared/components/Data-table/data-table';
import { CustomColumnDirective } from '../../shared/components/Data-table/custom-column.directive';
import { SmartTableConfig, RequestContext, BadgeMapEntry } from '../../shared/components/Data-table/data-table.types';

interface Meeting {
  id: number;
  title: string;
  subtitle: string;
  customer: string;
  customerInitial: string;
  customerColor: string;
  type: string;
  date: string;
  time: string;
  owner: string;
  ownerInitial: string;
  priority: 'Low' | 'Medium' | 'High';
  status: 'Scheduled' | 'InProgress' | 'Pending' | 'Completed';
}

interface Activity {
  id: number;
  title: string;
  time: string;
  user: string;
  icon: string;
  iconBg: string;
  iconText: string;
}

interface AgendaItem {
  id: number;
  text: string;
  completed: boolean;
}

import { SingleInput, SelectOption } from '../../shared/components/inputs/single-input/single-input';
import { DatePicker } from '../../shared/components/inputs/date-picker/date-picker';
import { DatePicker as DatePickerService } from '../../shared/service/date-picker/date-picker';
import { TimePickerComponent } from '../../shared/components/inputs/time-picker/time-picker';

import { Calendar, DayEvent } from '../../shared/components/inputs/calendar/calendar';
import { ChartComponent } from '../../shared/components/inputs/charts/charts';

@Component({
  selector: 'app-meetings',
  standalone: true,
  imports: [CommonModule, FormsModule, SingleInput, DatePicker, TimePickerComponent, DataTable, CustomColumnDirective, Calendar, ChartComponent],
  templateUrl: './meetings.html',
  styles: [`
    .modal-overlay {
      backdrop-filter: blur(4px);
      animation: fadeIn 0.2s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slide-up {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .animate-slide-up {
      animation: slide-up 0.3s ease-out;
    }
    .chart-bar {
      transition: height 0.8s cubic-bezier(0.22, 1, 0.36, 1);
    }
  `]
})
export class MeetingsComponent implements OnInit, OnDestroy {

  // Reference to the table so we can ask it to reload after cancelling a
  // meeting. NOTE: '.refresh()' below is a guess at the method name — check
  // your actual DataTable component's public API and rename if different
  // (common alternatives: reload(), fetchData(), loadData()).
  @ViewChild(DataTable) meetingsTable?: DataTable<any>;

  // ============ UI State ============
  activeView = 'table';
  timeRange = 'Week';
  searchTerm = '';
  showScheduleModal = false;
  showDetailDrawer = false;
  showFilters = false;
  showToast = false;
  toastMessage = '';
  refreshing = false;

  // Filter state
  filterType = '';
  filterPriority = '';
  filterStatus = '';
  activeFilters = 0;

  // Pagination
  currentPage = 1;
  pageSize = 6;

  // Sort state
  sortField = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Selection state
  selectedMeetings: Meeting[] = [];

  // Selected meeting for detail drawer
  selectedMeeting: Meeting | null = null;

  // ============ Organizations & API Meetings ============
  organizations: Organization[] = [];
  loadingOrganizations = false;
  apiMeetings = signal<MeetingRow[]>([]);
  filterDateFrom: string = '';
  filterDateTo: string = '';

  showCancelModal = signal(false);
cancelMeetingRow = signal<MeetingRow | null>(null);
cancelSubmitting = signal(false);


// ============ Invite Attendees Modal ============
showInviteModal = signal(false);
inviteMeetingRow = signal<MeetingRow | null>(null);
inviteEmails = signal<string[]>([]);
inviteEmailInput = signal('');
inviteSubmitting = signal(false);
inviteError = signal<string | null>(null);

  // ============ Dashboard KPI Cards (from /meetings/dashboard-stats) ============
  // A signal, not a plain property — under zoneless change detection, a signal
  // write notifies the renderer directly regardless of where it happens (an
  // RxJS subscribe callback, a setTimeout, etc). A plain property assignment
  // has no such notification, so the view only ever updated when *something
  // else* happened to trigger a check.
  dashboardStats = signal<DashboardStats>({
    todayMeetings: 0,
    upcoming7Days: 0,
    completedThisMonth: 0,
    followUpsPending: 0,
    thisWeekMeetings: 0,
    overdueCount: 0,
    completionRate: 0,
    totalMeetings: 0
  });
  loadingDashboardStats = false;

  // ============ Recent Activity (from /meetings/recent-activity) ============
  recentActivities = signal<RecentActivity[]>([]);
  loadingRecentActivity = false;

  // ============ Meeting Detail (Attendance) Modal ============
  showAttendanceModal = false;
  attendanceLoading = false;
  attendanceError: string | null = null;
  attendanceResult: AttendanceCheckResponse | null = null;
  /** Title of the meeting currently shown in the modal (row data isn't kept around otherwise). */
  attendanceMeetingTitle = '';


  // ============ Reschedule Meeting Modal ============

showRescheduleModal = false;
rescheduleLoading = false;
rescheduleError: string | null = null;

selectedRescheduleMeeting: MeetingRow | null = null;

rescheduleDate = '';
minDateToday: Date = new Date();
rescheduleTime = '';
rescheduleDuration = 60; // minutes

rescheduleDurationOptions = [
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '45 minutes', value: 45 },
  { label: '1 hour', value: 60 },
  { label: '1 hour 30 minutes', value: 90 },
  { label: '2 hours', value: 120 },
];

rescheduleDurationSelectOptions: SelectOption[] = [
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '45 minutes', value: 45 },
  { label: '1 hour', value: 60 },
  { label: '1 hour 30 minutes', value: 90 },
  { label: '2 hours', value: 120 },
];

  // ============ Meetings DataTable Config ============
  private readonly meetingsEndpoint = 'http://127.0.0.1:5000/meetings/fetchMeetings';

  tableConfig = computed<SmartTableConfig<MeetingRow>>(() => ({
    columns: [
      {
        key: 'title',
        label: 'Meeting',
        sortable: true,
      },
      {
        key: 'orgName',
        label: 'Organisation',
        sortable: true,
      },
      {
        key: 'purpose',
        label: 'Purpose',
        sortable: false,
        type: 'text',
      },
      {
        key: 'startTime',
        label: 'Date & Time',
        sortable: true,
      },
      {
        key: 'duration',
        label: 'Duration',
        sortable: false,
      },
      {
        key: 'priority',
        label: 'Priority',
        sortable: true,
        type: 'badge' as const,
        align: 'center' as const,
        badgeMap: {
          '0': { label: 'Low' },
          '1': { label: 'Medium' },
          '2': { label: 'High' },
        } as Record<string, BadgeMapEntry>,
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        type: 'badge' as const,
        align: 'center' as const,
        badgeMap: {
          '0': { label: 'Scheduled' },
          '1': { label: 'Completed' },
          '2': { label: 'Rescheduled' },
          '3': { label: 'Pending' },
          '4': { label: 'Cancelled' },
          '5': { label: 'Client No-Show' },
          '6': { label: 'Host No-Show' },
        } as Record<string, BadgeMapEntry>,
      },
      {
        key: 'attendance',
        label: 'Meeting Detail',
        sortable: false,
        align: 'center' as const,
        excludeFromExport: true,
        excludeFromPdf: true,
      },
      {
        key: 'clientMail',
        label: 'Client Email',
        sortable: false,
        hidden:true
      },
      {
        key: 'rowActions',
        label: 'actions',
        sortable: false,
        hideable: false,
        sticky: true,
        excludeFromExport: true,
        excludeFromPdf: true,
      },
    ],

    apiConfig: {
      endpoint: this.meetingsEndpoint,
      dataPath: 'data',
      totalPath: 'meta.total',

      

      buildRequest: (ctx: RequestContext) => {
  const filters: Record<string, any> = {};

  // Status — multiSelect sends an array of string values (e.g. ['0','1','2']).
  // A single selection still comes through as a 1-element array.
  // Calling Number() on an array gives NaN which serialises to null — so we
  // must map each element individually.
  const rawStatus = ctx.filters?.['meetingStatus'];
  if (rawStatus !== undefined && rawStatus !== null &&
      !(Array.isArray(rawStatus) && rawStatus.length === 0)) {
    if (Array.isArray(rawStatus)) {
      const nums = rawStatus.map((v: any) => Number(v));
      // Send a plain number when only one value is selected so the backend
      // can handle both the scalar and array forms.
      filters['status'] = nums.length === 1 ? nums[0] : nums;
    } else {
      filters['status'] = Number(rawStatus);
    }
  }

  // Priority — same multi-select handling as Status above.
  const rawPriority = ctx.filters?.['meetingPriority'];
  if (rawPriority !== undefined && rawPriority !== null &&
      !(Array.isArray(rawPriority) && rawPriority.length === 0)) {
    if (Array.isArray(rawPriority)) {
      const nums = rawPriority.map((v: any) => Number(v));
      filters['priority'] = nums.length === 1 ? nums[0] : nums;
    } else {
      filters['priority'] = Number(rawPriority);
    }
  }

  // Organization
  if (ctx.filters?.['organization'] !== undefined) {
    filters['orgId'] = Number(ctx.filters['organization']);
  }

  // Scope every fetch to the logged-in employee only — the person should
  // never see other employees' meetings in this grid. Read fresh on every
  // request (rather than cached in a field) so a re-login/switch-user in
  // the same tab is picked up immediately.
  const rawEmpId = localStorage.getItem('empId');
  if (rawEmpId) {
    filters['empId'] = Number(rawEmpId);
  }

  const body = {
    start: ctx.page * ctx.pageSize,
    length: ctx.pageSize,
    search: ctx.search ?? '',
    sorting: `${ctx.sortKey ?? 'startTime'},${ctx.sortDir}`,
    filter: JSON.stringify(filters),
    fromDate: ctx.dateFrom ?? '',
    toDate: ctx.dateTo ?? '',
  };

  return {
    method: 'POST' as const,
    body
  };
},
      transformRow: (raw: any): MeetingRow => raw as MeetingRow,
    },

    rowIdKey: 'id',
    showSearch: true,
    showPagination: true,
    defaultPageSize: 10,
    pageSizeOptions: [10, 25, 50, 100],
    exportFileName: 'Meetings',
    emptyMessage: 'No meetings found.',
    clickable: false,
    toolbarButtons: [
      { id: 'datePicker', type: 'datePicker' },
      { id: 'filter',  type: 'filter',       label: 'Filter' },
      { id: 'export',  type: 'export',       label: 'Export' },
      { id: 'refresh', type: 'refresh' },
      { id: 'columns', type: 'columnPicker', label: 'Columns' },
    ],
  }));

  // ============ Row Actions Menu (three-dot, rendered via appCustomColumn="rowActions") ============
  //
  // Deliberately kept out of the shared DataTable component — it's rendered
  // through the same ng-template/appCustomColumn mechanism as the other
  // custom columns (title, orgName, attendance...), so DataTable itself
  // never needs to know about Join/Cancel.

  /** id of the row whose menu is currently open, or null if none is open. */
  actionMenuOpenRowId = signal<number | null>(null);
  /** The full row for the currently open menu (kept alongside the id so the template can read it without re-searching apiMeetings/rows). */
  actionMenuRow = signal<MeetingRow | null>(null);
  /** Fixed-position coordinates for the floating menu, computed from the trigger button's own bounding rect so it isn't clipped by the table's scroll container. */
  actionMenuPosition = signal<{ top: number; left: number } | null>(null);

  toggleActionMenu(row: MeetingRow, event: MouseEvent): void {
    event.stopPropagation();
    const isOpeningSameRow = this.actionMenuOpenRowId() === row.id;

    if (isOpeningSameRow) {
      this.closeActionMenu();
      return;
    }

    const trigger = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const menuWidth = 176; // matches w-44 below

    this.actionMenuOpenRowId.set(row.id);
    this.actionMenuRow.set(row);
    this.actionMenuPosition.set({
      top: trigger.bottom + 6,
      // Right-align the menu to the trigger so it doesn't run off-screen
      // for the right-most "Meeting Detail"/"Client Email" columns.
      left: Math.max(8, trigger.right - menuWidth),
    });
  }

  closeActionMenu(): void {
    this.actionMenuOpenRowId.set(null);
    this.actionMenuRow.set(null);
    this.actionMenuPosition.set(null);
  }

  @HostListener('document:click')
  onDocumentClickCloseActionMenu(): void {
    if (this.actionMenuOpenRowId() !== null) {
      this.closeActionMenu();
    }
  }

  // The menu's top/left are captured as fixed pixel coordinates from the
  // trigger button's rect at the moment it opens. If the window is resized
  // (or the page/table scrolls) afterward, that button moves but the menu
  // wouldn't — so just close it rather than let it drift away from its row.
  @HostListener('window:resize')
  onWindowResizeCloseActionMenu(): void {
    if (this.actionMenuOpenRowId() !== null) {
      this.closeActionMenu();
    }
  }

  /**
   * `scroll` events don't bubble, so a plain (window:scroll) HostListener
   * won't fire when the table's own internal `overflow-x/y` container
   * scrolls — only a capture-phase listener on `document` catches that.
   * Added/removed manually since @HostListener has no capture option.
   */
  private closeActionMenuOnScroll = () => {
    if (this.actionMenuOpenRowId() !== null) {
      this.closeActionMenu();
    }
  };

  ngOnDestroy(): void {
    document.removeEventListener('scroll', this.closeActionMenuOnScroll, true);
  }

  onMenuJoin(row: MeetingRow): void {
    this.closeActionMenu();
    this.joinMeeting(row);
  }

  onMenuCancel(row: MeetingRow): void {
    this.closeActionMenu();
    this.cancelMeetingFromMenu(row);
  }

  openMeetingLink(row: MeetingRow): void {
    if (row.meetingLink) {
      window.open(row.meetingLink, '_blank');
    } else {
      this.showToastMessage('No meeting link available for this entry.');
    }
  }

  // ============ Row Actions: Join / Cancel eligibility ============
  //
  // Rendered as the DataTable's own customRowActions buttons (see
  // tableConfig above) — it already handles the disabled state and click
  // guarding natively, so this is just the eligibility logic those
  // actions read from.

  /**
   * Whether Join / Cancel should be enabled for a row, based on its
   * Status and — for a still-Scheduled meeting — whether its start time
   * has arrived yet.
   *
   *   Completed / Cancelled / Host No-Show / Client No-Show -> both disabled (nothing left to do)
   *   Pending                                                -> both enabled
   *   Scheduled / Rescheduled                                -> Cancel always enabled;
   *                                                              Join enables once StartTime <= now
   */
  private getRowActionState(row: MeetingRow): { canJoin: boolean; canCancel: boolean } {
    const COMPLETED = 1, CANCELLED = 4, CLIENT_NO_SHOW = 5, HOST_NO_SHOW = 6, PENDING = 3;

    if ([COMPLETED, CANCELLED, CLIENT_NO_SHOW, HOST_NO_SHOW].includes(row.status)) {
      return { canJoin: false, canCancel: false };
    }

    if (row.status === PENDING) {
      return { canJoin: false, canCancel: true };
    }

    // Scheduled (0) / Rescheduled (2)
    const hasStarted = !!row.startTime && new Date(row.startTime).getTime() <= Date.now();
    return { canJoin: hasStarted, canCancel: true };
  }

  canJoinMeeting(row: MeetingRow): boolean {
    return this.getRowActionState(row).canJoin;
  }

  canCancelMeeting(row: MeetingRow): boolean {
    return this.getRowActionState(row).canCancel;
  }

  canRescheduleMeeting(row: MeetingRow): boolean {
  const RESCHEDULE_ALLOWED_STATUSES = [
    0, // Scheduled
    2, // Rescheduled
    3, // Pending
    5, // Client No-Show
    6, // Host No-Show
  ];

  return RESCHEDULE_ALLOWED_STATUSES.includes(row.status);
}


openRescheduleModal(row: MeetingRow): void {
  if (!this.canRescheduleMeeting(row)) {
    return;
  }

  this.closeActionMenu();

  this.selectedRescheduleMeeting = row;
  this.rescheduleError = null;
  this.minDateToday = new Date();

  // Existing meeting date
  if (row.startTime) {

  const raw = row.startTime
    .replace(' ', 'T')
    .split('.')[0];

  const start = new Date(raw);

  this.rescheduleDate = this.formatDateForInput(start);
  this.rescheduleTime = this.formatTimeForInput(start);

} else {
    this.rescheduleDate = '';
    this.rescheduleTime = '';
  }

  // Existing duration
  this.rescheduleDuration = this.parseDurationToMinutes(row.duration);

  this.showRescheduleModal = true;
}

  get rescheduleTimeMinutes(): number {
    if (!this.rescheduleTime) return 0;
    if (typeof this.rescheduleTime === 'number') return this.rescheduleTime;
    const parts = String(this.rescheduleTime).split(':');
    if (parts.length >= 2) {
      return (parseInt(parts[0], 10) * 60) + parseInt(parts[1], 10);
    }
    return 0;
  }

  set rescheduleTimeMinutes(val: number) {
    if (val === null || val === undefined) {
      this.rescheduleTime = '';
      return;
    }
    const hours = String(Math.floor(val / 60)).padStart(2, '0');
    const mins = String(val % 60).padStart(2, '0');
    this.rescheduleTime = `${hours}:${mins}`;
  }

private formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
private formatTimeForInput(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}

private parseDurationToMinutes(duration: string | null): number {
  if (!duration) {
    return 60;
  }

  const parts = duration.split(':');

  if (parts.length < 2) {
    return 60;
  }

  const hours = Number(parts[0]) || 0;
  const minutes = Number(parts[1]) || 0;

  const total = (hours * 60) + minutes;

  return total > 0 ? total : 60;
}

private parseRescheduleStart(): Date | null {
  if (!this.rescheduleDate || !this.rescheduleTime) {
    return null;
  }

  let formattedDate = this.rescheduleDate;

  // Handle formatted date from DatePicker ("05 February, 2026")
  if (formattedDate.includes(',')) {
    formattedDate = DatePickerService.reverseFormatDate(formattedDate);
  }

  if (!formattedDate) {
    return null;
  }

  const timeStr = String(this.rescheduleTime).includes(':') ? this.rescheduleTime : '00:00';
  const start = new Date(`${formattedDate}T${timeStr}:00`);

  if (Number.isNaN(start.getTime())) {
    return null;
  }

  return start;
}

getRescheduleEndTime(): Date | null {
  const start = this.parseRescheduleStart();

  if (!start) {
    return null;
  }

  return new Date(
    start.getTime() + (Number(this.rescheduleDuration) || 60) * 60 * 1000
  );
}

formatRescheduleEndTime(): string {
  const end = this.getRescheduleEndTime();

  if (!end) {
    return '—';
  }

  return end.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
}

private buildRescheduleDateTime(): {
  start: string;
  end: string;
} | null {

  const start = this.parseRescheduleStart();

  if (!start) {
    return null;
  }

  const durationMins = Number(this.rescheduleDuration) || 60;
  const end = new Date(
    start.getTime() + durationMins * 60 * 1000
  );

  const pad = (value: number) =>
    String(value).padStart(2, '0');

  const formatLocalDateTime = (date: Date): string => {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
           `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  return {
    start: formatLocalDateTime(start),
    end: formatLocalDateTime(end)
  };
}

isRescheduleFormValid(): boolean {

  if (!this.selectedRescheduleMeeting) {
    return false;
  }

  if (!this.rescheduleDate || this.rescheduleTime === null || this.rescheduleTime === undefined || this.rescheduleTime === '') {
    return false;
  }

  if (!this.rescheduleDuration || Number(this.rescheduleDuration) <= 0) {
    return false;
  }

  const start = this.parseRescheduleStart();

  if (!start) {
    return false;
  }

  // Don't allow a new meeting time in the past.
  if (start.getTime() <= Date.now()) {
    return false;
  }

  return true;
}

submitReschedule(): void {

  if (!this.selectedRescheduleMeeting) {
    return;
  }

  if (!this.isRescheduleFormValid()) {
    this.rescheduleError =
      'Please select a future date, time and duration.';
    return;
  }

  const dateTime = this.buildRescheduleDateTime();

  if (!dateTime) {
    this.rescheduleError =
      'Invalid date or time.';
    return;
  }

  this.rescheduleLoading = true;
  this.rescheduleError = null;

  const meeting = this.selectedRescheduleMeeting;

  this.meetingService
    .rescheduleMeeting(
      meeting.id,
      dateTime.start,
      dateTime.end
    )
    .subscribe({

      next: (response) => {

        this.rescheduleLoading = false;

        this.showRescheduleModal = false;

        this.toastr.success(
          `"${meeting.title}" rescheduled successfully.`,
          'Rescheduled'
        );

        this.selectedRescheduleMeeting = null;

        // Refresh DataTable
        this.meetingsTable?.refresh?.();

        // Refresh other meeting views
        this.fetchApiMeetings();

        // Refresh dashboard numbers
        this.fetchDashboardStats();

        // Refresh recent activity feed
        this.fetchRecentActivity();
      },

      error: (err) => {

        this.rescheduleLoading = false;

        const errMsg = err?.error?.message || 'Failed to reschedule meeting.';
        this.rescheduleError = errMsg;
        this.toastr.error(errMsg, 'Reschedule Failed');
      }
    });
}

closeRescheduleModal(): void {
  if (this.rescheduleLoading) {
    return;
  }

  this.showRescheduleModal = false;
  this.selectedRescheduleMeeting = null;
  this.rescheduleError = null;
}

getTodayDate(): string {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

  joinMeeting(row: MeetingRow): void {
    if (!this.canJoinMeeting(row)) return;
    this.openMeetingLink(row);
  }

  cancelMeetingFromMenu(row: MeetingRow): void {
  if (!this.canCancelMeeting(row)) {
    return;
  }

  this.openCancelModal(row);
}

openCancelModal(row: MeetingRow): void {
  this.cancelMeetingRow.set(row);
  this.cancelSubmitting.set(false);
  this.showCancelModal.set(true);
}


closeCancelModal(): void {
  if (this.cancelSubmitting()) {
    return;
  }

  this.showCancelModal.set(false);
  this.cancelMeetingRow.set(null);
}


confirmCancelMeeting(): void {
  const row = this.cancelMeetingRow();

  if (!row || this.cancelSubmitting()) {
    return;
  }

  this.cancelSubmitting.set(true);

  this.meetingService.cancelMeeting(row.id).subscribe({
    next: () => {
      this.cancelSubmitting.set(false);
      this.showCancelModal.set(false);
      this.cancelMeetingRow.set(null);

      this.toastr.success(`"${row.title}" was cancelled successfully.`, 'Meeting Cancelled');

      // Refresh table
      this.meetingsTable?.refresh?.();

      // Refresh other views
      this.fetchApiMeetings();
      this.fetchDashboardStats();
      this.fetchRecentActivity();
    },

    error: (err) => {
      console.error('Cancel meeting failed:', err);
      this.cancelSubmitting.set(false);

      const errMsg = err?.error?.message || 'Failed to cancel meeting.';
      this.toastr.error(errMsg, 'Cancellation Failed');
    }
  });
}
  /**
   * Confirms with the user, then cancels the meeting via Microsoft Graph
   * (POST /meetings/cancel) and refreshes the table so the new "Cancelled"
   * status shows immediately. The backend already rejects cancelling a
   * meeting that's already Cancelled or Completed — that error message is
   * shown as-is via the toast.
   */
 

  /**
   * Opens the "Meeting Detail" modal for a row and checks attendance live
   * against Microsoft Graph. If the meeting was never created as an online
   * Teams meeting, or hasn't happened yet, the backend returns an error
   * message which is shown in the modal instead of attendance data.
   */
  openAttendanceModal(row: MeetingRow): void {
  this.attendanceMeetingTitle = row.title || 'Meeting';

  // Open modal immediately
  this.showAttendanceModal = true;

  // Show loader while API is running
  this.attendanceLoading = true;

  // Clear previous state
  this.attendanceError = null;
  this.attendanceResult = null;

  // Make Angular render the modal + loader immediately
  this.cdr.detectChanges();

  this.meetingService.checkAttendance(row.id).subscribe({
    next: (res) => {
      // API response has arrived
      this.attendanceResult = res;
      this.attendanceLoading = false;

      // Immediately update modal with API response
      this.cdr.detectChanges();
    },

    error: (err) => {
      this.attendanceError =
        err?.error?.message ||
        'Failed to check meeting attendance.';

      this.attendanceLoading = false;

      // Immediately update modal with error
      this.cdr.detectChanges();
    }
  });
}

  closeAttendanceModal(): void {
    this.showAttendanceModal = false;
    this.attendanceResult = null;
    this.attendanceError = null;
  }

  /** "2026-08-12T05:11:40.241Z" -> "05:11 AM" for the modal's time labels. */
  formatAttendanceTime(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /** 125 -> "2m 5s", 45 -> "45s" — for per-attendee duration in the modal. */
  formatAttendanceDuration(totalSeconds: number): string {
    if (!totalSeconds) return '0s';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  }

  /**
   * Turns the raw attendance result into one of 4 real-world outcomes —
   * `wasHeld` alone can't distinguish who actually showed up:
   *   - Not Held        -> nobody joined at all
   *   - Client No-Show   -> host joined, nobody else did
   *   - Host No-Show     -> someone else joined, but the host never did
   *   - Held             -> host + at least one other attendee joined
   */
  getAttendanceOutcome(result: AttendanceCheckResponse): { label: string; badgeClass: string; icon: string } {
    if (!result.wasHeld || result.attendeeCount === 0) {
      return { label: 'Not Held', badgeClass: 'text-slate-500 bg-slate-50 border-slate-200', icon: 'fa-circle-xmark' };
    }

    const hostJoined = result.attendees.some(a => a.role.toLowerCase() === 'organizer');
    const someoneElseJoined = result.attendees.some(a => a.role.toLowerCase() !== 'organizer');

    if (hostJoined && someoneElseJoined) {
      return { label: 'Held', badgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: 'fa-circle-check' };
    }

    if (hostJoined && !someoneElseJoined) {
      return { label: 'Client No-Show', badgeClass: 'text-amber-700 bg-amber-50 border-amber-200', icon: 'fa-user-slash' };
    }

    // !hostJoined && someoneElseJoined
    return { label: 'Host No-Show', badgeClass: 'text-rose-700 bg-rose-50 border-rose-200', icon: 'fa-user-clock' };
  }

  /** Converts duration like '01:00:00.000000', '00:30:00', '01:30:00' → '1 hour', '30 mins', '1 hour 30 mins' */
  formatDuration(raw: string | null | undefined): string {
    if (!raw) return '—';
    const str = String(raw).trim();
    if (!str || str === '0' || str === '00:00:00' || str === '00:00:00.000000') return '0 mins';

    // If it already has human readable duration (e.g. "1 hour", "45 minutes", "15 minutes")
    if (/hour|min|sec/i.test(str)) {
      return str;
    }

    // Handle HH:MM:SS or HH:MM:SS.ffffff
    if (str.includes(':')) {
      const parts = str.split('.')[0].split(':');
      const hours = parseInt(parts[0], 10) || 0;
      const minutes = parseInt(parts[1], 10) || 0;
      const seconds = parseInt(parts[2], 10) || 0;

      const result: string[] = [];
      if (hours > 0) {
        result.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
      }
      if (minutes > 0) {
        result.push(`${minutes} ${minutes === 1 ? 'min' : 'mins'}`);
      }
      if (hours === 0 && minutes === 0 && seconds > 0) {
        result.push(`${seconds} ${seconds === 1 ? 'sec' : 'secs'}`);
      }
      return result.join(' ') || '0 mins';
    }

    // Handle integer/number (e.g. total minutes)
    const num = Number(str);
    if (!isNaN(num) && num > 0) {
      const hours = Math.floor(num / 60);
      const minutes = num % 60;
      const result: string[] = [];
      if (hours > 0) {
        result.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
      }
      if (minutes > 0) {
        result.push(`${minutes} ${minutes === 1 ? 'min' : 'mins'}`);
      }
      return result.join(' ') || `${num} mins`;
    }

    return str;
  }

  /** Returns coloured initials avatar background for an org name */
  getOrgAvatarClass(name: string): string {
    const colors = [
      'bg-indigo-500', 'bg-purple-500', 'bg-emerald-500',
      'bg-amber-500',  'bg-rose-500',   'bg-blue-500', 'bg-teal-500'
    ];
    if (!name) return colors[0];
    return colors[name.charCodeAt(0) % colors.length];
  }

  getOrgInitials(name: string): string {
    if (!name) return '?';
    return name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  getPriorityLabel(p: number): string {
    return ['Low', 'Medium', 'High'][p] ?? 'Low';
  }

  getPriorityClass(p: number): string {
    const map: Record<number, string> = {
      0: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      1: 'bg-amber-50  text-amber-700  border border-amber-200',
      2: 'bg-rose-50   text-rose-700   border border-rose-200',
    };
    return map[p] ?? map[0];
  }

  getStatusLabel(s: number): string {
    return ['Scheduled', 'Completed', 'Rescheduled', 'Pending', 'Cancelled', 'Client No-Show', 'Host No-Show'][s] ?? 'Scheduled';
  }

  getStatusClass(s: number): string {
    const map: Record<number, string> = {
      0: 'bg-blue-50    text-blue-700    border border-blue-200',
      1: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      2: 'bg-purple-50  text-purple-700  border border-purple-200',
      3: 'bg-amber-50   text-amber-700   border border-amber-200',
      4: 'bg-rose-50    text-rose-700    border border-rose-200',
      5: 'bg-amber-50   text-amber-700   border border-amber-200',
      6: 'bg-rose-50    text-rose-700    border border-rose-200',
    };
    return map[s] ?? map[0];
  }

  constructor(
    private router: Router,
    private meetingService: MeetingService,
    private cdr: ChangeDetectorRef,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.fetchOrganizations();
    this.fetchApiMeetings();
    this.fetchDashboardStats();
    this.fetchRecentActivity();
    document.addEventListener('scroll', this.closeActionMenuOnScroll, true);
  }

  fetchApiMeetings(): void {
    // Scope meetings fetch to the logged-in employee only
    const filters: Record<string, any> = {};
    const rawEmpId = localStorage.getItem('empId');
    if (rawEmpId) {
      filters['empId'] = Number(rawEmpId);
    }

    this.meetingService.fetchMeetings({
      start: 0,
      length: 500,
      search: this.searchTerm || '',
      sorting: 'startTime,desc',
      filter: JSON.stringify(filters),
      fromDate: this.filterDateFrom || '',
      toDate: this.filterDateTo || ''
    }).subscribe({
      next: (res) => {
        if (res && res.data) {
          const empId = rawEmpId ? Number(rawEmpId) : null;
          // Ensure client-side filtering for user-specific meetings
          const userMeetings = empId
            ? res.data.filter(m => !m.empId || Number(m.empId) === empId || (m.createdById && Number(m.createdById) === empId))
            : res.data;
          this.apiMeetings.set(userMeetings);
          if (userMeetings.length > 0 && userMeetings[0].startTime) {
            const firstDate = new Date(userMeetings[0].startTime);
            if (!isNaN(firstDate.getTime())) {
              this.calendarMonth.set(firstDate.getMonth());
              this.calendarYear.set(firstDate.getFullYear());
            }
          }
          this.updateMeetingTypesChartFromApi(userMeetings, res.meta?.total || userMeetings.length);
        }
      },
      error: (err) => console.error('Failed to fetch API meetings for non-table views:', err)
    });
  }

  updateMeetingTypesChartFromApi(rows: MeetingRow[], totalCount: number): void {
    if (!rows || rows.length === 0) {
      this.meetingTypeChartData = [];
      this.meetingTypeChartLabels = [];
      this.meetingTypeChartColors = [];
      this.meetingTypeDonutCenter = {
        line1: totalCount.toString(),
        line2: 'total',
        line3: ''
      };
      this.meetingTypes = [];
      return;
    }

    const counts: Record<string, number> = {};
    for (const r of rows) {
      const type = (r.meetingType && r.meetingType.trim()) ? r.meetingType.trim() : 'Kickoff';
      counts[type] = (counts[type] || 0) + 1;
    }

    const labels = Object.keys(counts);
    const data = labels.map(l => counts[l]);

    const colorPalette = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#3b82f6', '#06b6d4', '#ec4899', '#84cc16'];
    const colorMap: Record<string, string> = {
      'Kickoff': '#6366f1',
      'Review': '#8b5cf6',
      'Training': '#10b981',
      'QBR': '#f59e0b',
      'Renewal': '#f43f5e',
      'Go Live': '#3b82f6'
    };
    const colors = labels.map((l, i) => colorMap[l] || colorPalette[i % colorPalette.length]);

    this.meetingTypeChartLabels = labels;
    this.meetingTypeChartData = data;
    this.meetingTypeChartColors = colors;
    this.meetingTypeDonutCenter = {
      line1: totalCount.toString(),
      line2: 'total',
      line3: ''
    };

    this.meetingTypes = labels.map(l => {
      const pct = totalCount > 0 ? Math.round((counts[l] / totalCount) * 100) : 0;
      return {
        name: l,
        percentage: pct,
        color: this.getMeetingTypeColor(l)
      };
    });
  }

  /** Pulls the dashboard KPI card numbers from GET /meetings/dashboard-stats. */
    /** Pulls the dashboard KPI card numbers from GET /meetings/dashboard-stats. */
  fetchDashboardStats(): void {
    this.loadingDashboardStats = true;
    const rawEmpId = localStorage.getItem('empId');
    const empId = rawEmpId ? Number(rawEmpId) : undefined;
    this.meetingService.getDashboardStats(empId).subscribe({
      next: (stats) => {
        this.dashboardStats.set(stats);
        this.loadingDashboardStats = false;
      },
      error: (err) => {
        console.error('Failed to fetch dashboard stats:', err);
        this.loadingDashboardStats = false;
      }
    });
  }

  /** Pulls the "Recent Activity" feed from GET /meetings/recent-activity. */
  fetchRecentActivity(): void {
    this.loadingRecentActivity = true;
    const rawEmpId = localStorage.getItem('empId');
    const empId = rawEmpId ? Number(rawEmpId) : undefined;
    const currentUserName = (localStorage.getItem('userName') || '').trim().toLowerCase();

    this.meetingService.getRecentActivity(empId).subscribe({
      next: (activity) => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        let recent = (activity || []).filter(item => {
          const activityDate = new Date(item.time);
          return !isNaN(activityDate.getTime()) && activityDate >= sevenDaysAgo;
        });

        // Filter user-wise: if empId or user name is present in activity item
        if (empId || currentUserName) {
          recent = recent.filter(item => {
            const itemEmpId = (item as any).empId ?? (item as any).userId ?? (item as any).createdById;
            if (empId && itemEmpId !== undefined && itemEmpId !== null) {
              return Number(itemEmpId) === empId;
            }
            if (currentUserName && item.user) {
              const u = item.user.trim().toLowerCase();
              return u.includes(currentUserName) || currentUserName.includes(u);
            }
            return true;
          });
        }

        this.recentActivities.set(recent);
        this.loadingRecentActivity = false;
      },
      error: (err) => {
        console.error('Failed to fetch recent activity:', err);
        this.loadingRecentActivity = false;
      }
    });
  }

  /**
   * Maps an activity's `action` string to icon/colour classes for display —
   * the API doesn't send these directly (unlike the old mock `activities` list).
   */
  /**
   * Maps an activity's `action` or `title` string to icon/colour classes for display —
   * provides clean, visually distinct FontAwesome icons inside circular badges.
   */
  getActivityIconMeta(action: string, title?: string): { icon: string; iconBg: string; iconText: string } {
    const a = (action || title || '').toLowerCase();
    if (a.includes('cancel')) {
      return { icon: 'fa-ban', iconBg: 'bg-rose-50 border border-rose-200', iconText: 'text-rose-600' };
    }
    if (a.includes('reschedul')) {
      return { icon: 'fa-history', iconBg: 'bg-amber-50 border border-amber-200', iconText: 'text-amber-600' };
    }
    if (a.includes('complet')) {
      return { icon: 'fa-check-circle', iconBg: 'bg-emerald-50 border border-emerald-200', iconText: 'text-emerald-600' };
    }
    if (a.includes('no-show') || a.includes('no_show')) {
      return { icon: 'fa-user-slash', iconBg: 'bg-purple-50 border border-purple-200', iconText: 'text-purple-600' };
    }
    if (a.includes('creat') || a.includes('schedul')) {
      return { icon: 'fa-calendar-check', iconBg: 'bg-indigo-50 border border-indigo-200', iconText: 'text-indigo-600' };
    }
    return { icon: 'fa-calendar-day', iconBg: 'bg-indigo-50 border border-indigo-200', iconText: 'text-indigo-600' };
  }

  getTimelineIconMeta(meeting: MeetingRow): { icon: string; bgClass: string; textClass: string } {
    const s = meeting?.status;
    if (s === 1) { // Completed
      return { icon: 'fa-check-circle', bgClass: 'bg-emerald-50 border-emerald-200', textClass: 'text-emerald-600' };
    }
    if (s === 2) { // Rescheduled
      return { icon: 'fa-history', bgClass: 'bg-amber-50 border-amber-200', textClass: 'text-amber-600' };
    }
    if (s === 4) { // Cancelled
      return { icon: 'fa-ban', bgClass: 'bg-rose-50 border-rose-200', textClass: 'text-rose-600' };
    }
    if (s === 3 || s === 5 || s === 6) { // Pending or No-Show
      return { icon: 'fa-clock', bgClass: 'bg-purple-50 border-purple-200', textClass: 'text-purple-600' };
    }
    // Default Scheduled (0)
    return { icon: 'fa-calendar-check', bgClass: 'bg-indigo-50 border-indigo-200', textClass: 'text-indigo-600' };
  }

  onDateApplied(event: { from: string; to: string }): void {
    this.filterDateFrom = event.from;
    this.filterDateTo = event.to;
    this.fetchApiMeetings();
  }

  fetchOrganizations(): void {
    this.loadingOrganizations = true;
    this.meetingService.getOrganizations().subscribe({
      next: (orgs) => {
        this.organizations = orgs;
        this.loadingOrganizations = false;
      },
      error: (err) => {
        console.error('Failed to fetch organizations', err);
        this.loadingOrganizations = false;
      }
    });
  }

  // Called from the Schedule Meeting modal when the user picks an organization
  onOrganizationSelect(orgIdValue: string): void {
    const orgId = Number(orgIdValue);
    const org = this.organizations.find(o => o.orgId === orgId);

    this.newMeeting.orgId = org ? org.orgId : null;
    this.newMeeting.customer = org ? org.name : '';

    // For the time being: just console log the selected orgId
    console.log('Selected Organization orgId:', this.newMeeting.orgId);
  }

  // ============ Mock Data ============
  meetings: Meeting[] = [
    { id: 1, title: 'Kickoff Meeting', subtitle: 'Project Introduction', customer: 'TechNova Solutions', customerInitial: 'T', customerColor: 'bg-indigo-500', type: 'Kickoff', date: '2025-05-20', time: '10:00 AM', owner: 'Rohit S.', ownerInitial: 'RS', priority: 'High', status: 'Scheduled' },
    { id: 2, title: 'Implementation Review', subtitle: 'Phase 1 Progress', customer: 'BrightWave LLC', customerInitial: 'B', customerColor: 'bg-amber-500', type: 'Review', date: '2025-05-20', time: '02:00 PM', owner: 'Anita P.', ownerInitial: 'AP', priority: 'Medium', status: 'InProgress' },
    { id: 3, title: 'Training Planning', subtitle: 'User Training Session', customer: 'GreenLeaf Corp', customerInitial: 'G', customerColor: 'bg-emerald-500', type: 'Training', date: '2025-05-21', time: '11:00 AM', owner: 'Neha K.', ownerInitial: 'NK', priority: 'Medium', status: 'Scheduled' },
    { id: 4, title: 'QBR Meeting', subtitle: 'Quarterly Business Review', customer: 'InnoSoft Systems', customerInitial: 'I', customerColor: 'bg-purple-500', type: 'QBR', date: '2025-05-22', time: '10:30 AM', owner: 'Rohit S.', ownerInitial: 'RS', priority: 'High', status: 'InProgress' },
    { id: 5, title: 'Go Live Readiness', subtitle: 'Final Deployment Check', customer: 'Alpha Digital', customerInitial: 'A', customerColor: 'bg-blue-500', type: 'Go Live', date: '2025-05-23', time: '03:00 PM', owner: 'Anita P.', ownerInitial: 'AP', priority: 'High', status: 'Scheduled' },
    { id: 6, title: 'Renewal Discussion', subtitle: 'Contract Renewal', customer: 'DataCore Inc.', customerInitial: 'D', customerColor: 'bg-rose-500', type: 'Renewal', date: '2025-05-26', time: '11:30 AM', owner: 'Rohit S.', ownerInitial: 'RS', priority: 'Medium', status: 'Pending' },
    { id: 7, title: 'Product Demo', subtitle: 'New Feature Showcase', customer: 'TechNova Solutions', customerInitial: 'T', customerColor: 'bg-indigo-500', type: 'Training', date: '2025-05-27', time: '01:00 PM', owner: 'Vikram S.', ownerInitial: 'VS', priority: 'Low', status: 'Scheduled' },
    { id: 8, title: 'Performance Review', subtitle: 'Project Performance', customer: 'BrightWave LLC', customerInitial: 'B', customerColor: 'bg-amber-500', type: 'Review', date: '2025-05-28', time: '09:00 AM', owner: 'Anita P.', ownerInitial: 'AP', priority: 'Medium', status: 'Scheduled' },
    { id: 9, title: 'Strategy Meeting', subtitle: 'Q3 Planning', customer: 'InnoSoft Systems', customerInitial: 'I', customerColor: 'bg-purple-500', type: 'Kickoff', date: '2025-05-29', time: '02:30 PM', owner: 'Rohit S.', ownerInitial: 'RS', priority: 'High', status: 'Pending' },
    { id: 10, title: 'Customer Workshop', subtitle: 'Hands-on Training', customer: 'GreenLeaf Corp', customerInitial: 'G', customerColor: 'bg-emerald-500', type: 'Training', date: '2025-05-30', time: '10:00 AM', owner: 'Neha K.', ownerInitial: 'NK', priority: 'Medium', status: 'Scheduled' },
    { id: 11, title: 'QBR Follow-up', subtitle: 'Action Items Review', customer: 'Alpha Digital', customerInitial: 'A', customerColor: 'bg-blue-500', type: 'Review', date: '2025-06-01', time: '11:00 AM', owner: 'Anita P.', ownerInitial: 'AP', priority: 'Low', status: 'Scheduled' },
    { id: 12, title: 'Renewal Negotiation', subtitle: 'Contract Terms', customer: 'DataCore Inc.', customerInitial: 'D', customerColor: 'bg-rose-500', type: 'Renewal', date: '2025-06-02', time: '03:30 PM', owner: 'Vikram S.', ownerInitial: 'VS', priority: 'High', status: 'Scheduled' },
    { id: 13, title: 'Implementation Kickoff', subtitle: 'Phase 2 Start', customer: 'TechNova Solutions', customerInitial: 'T', customerColor: 'bg-indigo-500', type: 'Kickoff', date: '2025-06-03', time: '09:30 AM', owner: 'Rohit S.', ownerInitial: 'RS', priority: 'High', status: 'Scheduled' },
    { id: 14, title: 'Progress Review', subtitle: 'Sprint Review', customer: 'BrightWave LLC', customerInitial: 'B', customerColor: 'bg-amber-500', type: 'Review', date: '2025-06-04', time: '01:00 PM', owner: 'Anita P.', ownerInitial: 'AP', priority: 'Medium', status: 'Completed' },
    { id: 15, title: 'Team Training', subtitle: 'New Tools Training', customer: 'GreenLeaf Corp', customerInitial: 'G', customerColor: 'bg-emerald-500', type: 'Training', date: '2025-06-05', time: '10:30 AM', owner: 'Neha K.', ownerInitial: 'NK', priority: 'Low', status: 'Scheduled' },
    { id: 16, title: 'Quarterly Review', subtitle: 'Q2 Performance', customer: 'InnoSoft Systems', customerInitial: 'I', customerColor: 'bg-purple-500', type: 'QBR', date: '2025-06-06', time: '02:00 PM', owner: 'Rohit S.', ownerInitial: 'RS', priority: 'High', status: 'Scheduled' },
    { id: 17, title: 'Go Live Support', subtitle: 'Post-deployment', customer: 'Alpha Digital', customerInitial: 'A', customerColor: 'bg-blue-500', type: 'Go Live', date: '2025-06-07', time: '09:00 AM', owner: 'Vikram S.', ownerInitial: 'VS', priority: 'Medium', status: 'Scheduled' },
    { id: 18, title: 'Renewal Planning', subtitle: 'Strategy Session', customer: 'DataCore Inc.', customerInitial: 'D', customerColor: 'bg-rose-500', type: 'Renewal', date: '2025-06-08', time: '11:30 AM', owner: 'Anita P.', ownerInitial: 'AP', priority: 'Medium', status: 'Pending' }
  ];

  activities: Activity[] = [
    { id: 1, title: 'Marketing Automation Discussion with TechNova Solutions completed', time: 'May 19, 2025 · 02:30 PM', user: 'Rohit Sharma', icon: 'fa-check', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600' },
    { id: 2, title: 'Implementation Review with BrightWave LLC rescheduled to May 22', time: 'May 19, 2025 · 11:15 AM', user: 'Anita Patil', icon: 'fa-undo-alt', iconBg: 'bg-amber-100', iconText: 'text-amber-600' },
    { id: 3, title: 'Training Planning with GreenLeaf Corp completed successfully', time: 'May 18, 2025 · 04:00 PM', user: 'Neha Kapoor', icon: 'fa-check', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600' },
    { id: 4, title: 'QBR Meeting agenda updated with 5 new discussion items', time: 'May 18, 2025 · 10:20 AM', user: 'Rohit Sharma', icon: 'fa-edit', iconBg: 'bg-blue-100', iconText: 'text-blue-600' },
    { id: 5, title: 'Vikram Singh added to Kickoff Meeting attendee list', time: 'May 17, 2025 · 03:45 PM', user: 'Rohit Sharma', icon: 'fa-user-plus', iconBg: 'bg-purple-100', iconText: 'text-purple-600' },
    { id: 6, title: 'New meeting scheduled: Product Demo with TechNova', time: 'May 17, 2025 · 01:30 PM', user: 'Vikram Singh', icon: 'fa-calendar-plus', iconBg: 'bg-indigo-100', iconText: 'text-indigo-600' },
    { id: 7, title: 'Renewal Discussion notes uploaded for DataCore Inc.', time: 'May 16, 2025 · 04:20 PM', user: 'Anita Patil', icon: 'fa-file-upload', iconBg: 'bg-amber-100', iconText: 'text-amber-600' }
  ];

  meetingTypes: { name: string; percentage: number; color: string }[] = [];

  meetingTypeChartData: number[] = [];
  meetingTypeChartLabels: string[] = [];
  meetingTypeChartColors: string[] = [];
  meetingTypeDonutCenter = {
    line1: '0',
    line2: 'total',
    line3: ''
  };

  // Chart data
  chartData = [
    { height: 130 },
    { height: 100 },
    { height: 150 },
    { height: 70 },
    { height: 110 },
    { height: 40 },
    { height: 90 },
    { height: 130 }
  ];

  weekLabels = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];

  // Agenda items for detail drawer
  agendaItems: AgendaItem[] = [
    { id: 1, text: 'Welcome and introductions', completed: true },
    { id: 2, text: 'Project overview and goals', completed: true },
    { id: 3, text: 'Timeline and milestones', completed: true },
    { id: 4, text: 'Roles and responsibilities', completed: false },
    { id: 5, text: 'Next steps and Q&A session', completed: false }
  ];

  // Form Model
  newMeeting = {
    title: '',
    customer: '',
    orgId: null as number | null,
    type: '',
    date: '',
    time: '',
    duration: '1 hour',
    priority: 'Medium' as 'Low' | 'Medium' | 'High',
    host: '',
    link: '',
    description: ''
  };

  // Dropdown options
  // NOTE: `customers` used to be a static list; organizations now come from
  // ImplementationService.fetchOrganizations() -> this.organizations
  meetingTypesList = ['Kickoff', 'Review', 'Training', 'QBR', 'Renewal', 'Go Live'];
  hosts = ['Rohit S.', 'Anita P.', 'Neha K.', 'Vikram S.', 'Priya M.', 'Amit R.'];

  get filterTypeOptions(): SelectOption[] {
    return [
      { label: 'All Types', value: '' },
      ...this.meetingTypesList.map(t => ({ label: t, value: t }))
    ];
  }

  get filterPriorityOptions(): SelectOption[] {
    return [
      { label: 'All Priorities', value: '' },
      { label: 'High', value: 'High' },
      { label: 'Medium', value: 'Medium' },
      { label: 'Low', value: 'Low' }
    ];
  }

  get filterStatusOptions(): SelectOption[] {
    return [
      { label: 'All Status', value: '' },
      { label: 'Scheduled', value: 'Scheduled' },
      { label: 'InProgress', value: 'InProgress' },
      { label: 'Pending', value: 'Pending' },
      { label: 'Completed', value: 'Completed' }
    ];
  }

  // ============ Computed Properties ============

  getFilteredMeetings(): Meeting[] {
    let filtered = [...this.meetings];

    // Apply search
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(m =>
        m.title.toLowerCase().includes(term) ||
        m.customer.toLowerCase().includes(term) ||
        m.subtitle.toLowerCase().includes(term)
      );
    }

    // Apply filters
    if (this.filterType) {
      filtered = filtered.filter(m => m.type === this.filterType);
    }
    if (this.filterPriority) {
      filtered = filtered.filter(m => m.priority === this.filterPriority);
    }
    if (this.filterStatus) {
      filtered = filtered.filter(m => m.status === this.filterStatus);
    }

    // Apply sort
    if (this.sortField) {
      filtered.sort((a, b) => {
        let valA = a[this.sortField as keyof Meeting];
        let valB = b[this.sortField as keyof Meeting];

        if (typeof valA === 'string' && typeof valB === 'string') {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }

        if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Apply pagination
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return filtered.slice(start, end);
  }

  getTotalPages(): number {
    const total = this.meetings.length;
    return Math.ceil(total / this.pageSize);
  }

  getPageNumbers(): number[] {
    const total = this.getTotalPages();
    return Array.from({ length: Math.min(total, 5) }, (_, i) => i + 1);
  }

  // ============ Chart Helper Methods ============

  getLinePoints(): string {
    return this.chartData.map((data, i) =>
      `${65 + (i * 75)},${180 - data.height}`
    ).join(' ');
  }

  getChartPoints(): { x: number, y: number }[] {
    return this.chartData.map((data, i) => ({
      x: 65 + (i * 75),
      y: 180 - data.height
    }));
  }

  // ============ KPI Helper Methods ============
  // These now read from the /meetings/dashboard-stats API (this.dashboardStats)
  // instead of computing off the local mock `meetings` array.

  getTodayMeetings(): number {
    return this.dashboardStats().todayMeetings;
  }

  // NOTE: the dashboard-stats API doesn't return a "yesterday" count, so this
  // still falls back to the local mock `meetings` array. Real backend
  // support would need a new field on GET /meetings/dashboard-stats.
  getYesterdayMeetings(): number {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    return this.meetings.filter(m => m.date === dateStr).length;
  }

  getTodayTrend(): number {
    const today = this.getTodayMeetings();
    const yesterday = this.getYesterdayMeetings();
    return yesterday === 0 ? 0 : Math.round(((today - yesterday) / yesterday) * 100);
  }

  getUpcomingMeetings(): number {
    return this.dashboardStats().upcoming7Days;
  }

  getUpcomingTrend(): number {
    return 8;
  }

  getThisWeekMeetings(): number {
    return this.dashboardStats().thisWeekMeetings;
  }

  getCompletedCount(): number {
    return this.dashboardStats().completedThisMonth;
  }

  getCompletionRate(): number {
    return this.dashboardStats().completionRate;
  }

  getCompletionTrend(): number {
    return 24;
  }

  getPendingFollowUps(): number {
    return this.dashboardStats().followUpsPending;
  }

  getFollowUpTrend(): number {
    return -3;
  }

  getOverdueCount(): number {
    return this.dashboardStats().overdueCount;
  }

  getTotalMeetings(): number {
    return this.dashboardStats().totalMeetings;
  }

  getWeeklyGrowth(): number {
    return 12;
  }

  // ============ Table Helper Methods ============

  getStatusDisplay(status: string): string {
    const map: { [key: string]: string } = {
      'InProgress': 'In Progress',
      'Scheduled': 'Scheduled',
      'Pending': 'Pending',
      'Completed': 'Completed'
    };
    return map[status] || status;
  }

  getTypeBadgeClass(type: string): string {
    const map: { [key: string]: string } = {
      'Kickoff': 'bg-indigo-50 text-indigo-700',
      'Review': 'bg-purple-50 text-purple-700',
      'Training': 'bg-emerald-50 text-emerald-700',
      'QBR': 'bg-amber-50 text-amber-700',
      'Go Live': 'bg-blue-50 text-blue-700',
      'Renewal': 'bg-rose-50 text-rose-700'
    };
    return map[type] || 'bg-slate-50 text-slate-700';
  }

  getPriorityBadgeClass(priority: string): string {
    const map: { [key: string]: string } = {
      'High': 'bg-red-50 text-red-700',
      'Medium': 'bg-amber-50 text-amber-700',
      'Low': 'bg-emerald-50 text-emerald-700'
    };
    return map[priority] || 'bg-slate-50 text-slate-700';
  }

  getStatusBadgeClass(status: string): string {
    const map: { [key: string]: string } = {
      'Scheduled': 'bg-blue-100 text-blue-700',
      'InProgress': 'bg-purple-100 text-purple-700',
      'Pending': 'bg-amber-100 text-amber-700',
      'Completed': 'bg-emerald-100 text-emerald-700'
    };
    return map[status] || 'bg-slate-100 text-slate-700';
  }

  getMeetingsByStatus(status: string): Meeting[] {
    return this.meetings.filter(m => m.status === status);
  }

  // ============ Calendar & Timeline API Helper Methods ============

  getApiMeetingsForDay(dateStr: string): MeetingRow[] {
    return this.apiMeetings().filter(m => {
      if (!m.startTime) return false;
      return m.startTime.split('T')[0] === dateStr;
    });
  }

  calendarMonth = signal<number>(new Date().getMonth());
  calendarYear = signal<number>(new Date().getFullYear());

  onCalendarDateSelect(date: Date): void {
    if (date) {
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        this.calendarMonth.set(d.getMonth());
        this.calendarYear.set(d.getFullYear());
      }
    }
  }

  get calendarEventsByDay(): Record<string | number, DayEvent[]> {
    const map: Record<string | number, DayEvent[]> = {};
    const targetMonth = this.calendarMonth();
    const targetYear = this.calendarYear();

    for (const m of this.apiMeetings()) {
      if (!m.startTime) continue;
      const d = new Date(m.startTime);
      if (isNaN(d.getTime())) continue;

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      const startHrs = d.getHours();
      const startMins = d.getMinutes();
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const eventItem: DayEvent = {
        title: m.title || 'Meeting',
        client: m.orgName || 'N/A',
        timeLabel: `${timeStr} (${this.formatDuration(m.duration)})`,
        startTime: timeStr,
        startMinutes: startHrs * 60 + startMins,
        endMinutes: startHrs * 60 + startMins + 60,
        chipClass: 'bg-indigo-50 border-indigo-200 text-indigo-700',
        accentClass: 'border-indigo-500'
      };

      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(eventItem);

      if (d.getMonth() === targetMonth && d.getFullYear() === targetYear) {
        const dayNum = d.getDate();
        if (!map[dayNum]) map[dayNum] = [];
        map[dayNum].push(eventItem);
      }
    }
    return map;
  }

  getFilteredApiMeetings(): MeetingRow[] {
    const rawEmpId = localStorage.getItem('empId');
    const empId = rawEmpId ? Number(rawEmpId) : null;

    let result = [...this.apiMeetings()];
    if (empId) {
      result = result.filter(m => !m.empId || Number(m.empId) === empId || (m.createdById && Number(m.createdById) === empId));
    }
    if (this.searchTerm) {
      const q = this.searchTerm.toLowerCase();
      result = result.filter(m =>
        (m.title && m.title.toLowerCase().includes(q)) ||
        (m.orgName && m.orgName.toLowerCase().includes(q)) ||
        (m.purpose && m.purpose.toLowerCase().includes(q))
      );
    }
    return result;
  }

  // ============ Calendar Helper Methods ============

  getCalendarDays(): { date: string, isToday: boolean }[] {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const days: { date: string, isToday: boolean }[] = [];

    // Add padding days from previous month
    const startPadding = firstDay.getDay();
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth, -i);
      days.push({ date: date.toISOString().split('T')[0], isToday: false });
    }

    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(currentYear, currentMonth, i);
      const dateStr = date.toISOString().split('T')[0];
      const isToday = dateStr === today.toISOString().split('T')[0];
      days.push({ date: dateStr, isToday });
    }

    // Add padding days from next month
    const endPadding = 42 - days.length; // 6 rows of 7
    for (let i = 1; i <= endPadding; i++) {
      const date = new Date(currentYear, currentMonth + 1, i);
      days.push({ date: date.toISOString().split('T')[0], isToday: false });
    }

    return days;
  }

  getMeetingsForDay(dateStr: string): Meeting[] {
    return this.meetings.filter(m => m.date === dateStr);
  }

  getEndTime(startTime: string): string {
    // Simple: add 1 hour
    const [hour, period] = startTime.split(' ');
    let [h, m] = hour.split(':').map(Number);
    h = (h % 12) + 1;
    return `${h}:${String(m).padStart(2, '0')} ${period}`;
  }

  getAttendees(): string[] {
    if (!this.selectedMeeting) return [];
    const base = [this.selectedMeeting.owner, this.selectedMeeting.customer];
    const others = ['Priya M.', 'Amit R.', 'Sneha K.'];
    return [...base, ...others.slice(0, 2)];
  }

  getDefaultAttendees(): string[] {
    return ['Rohit S.', 'Anita P.', 'Neha K.'];
  }

  // ============ Meeting Operations ============

  viewMeeting(meeting: Meeting): void {
    this.selectedMeeting = meeting;
    this.showDetailDrawer = true;
  }

  editMeeting(meeting: Meeting): void {
    this.showToastMessage(`Editing "${meeting.title}"...`);
    // Here you would open an edit modal
  }

  deleteMeeting(meeting: Meeting): void {
    if (confirm(`Are you sure you want to delete "${meeting.title}"?`)) {
      const index = this.meetings.indexOf(meeting);
      if (index > -1) {
        this.meetings.splice(index, 1);
        this.showToastMessage(`"${meeting.title}" deleted successfully`);
        if (this.showDetailDrawer) {
          this.closeDetailDrawer();
        }
      }
    }
  }

  // ============ Search and Filter ============

  applyFilters(): void {
    this.currentPage = 1;
    this.activeFilters = 0;
    if (this.filterType) this.activeFilters++;
    if (this.filterPriority) this.activeFilters++;
    if (this.filterStatus) this.activeFilters++;
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilters();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  clearFilters(): void {
    this.filterType = '';
    this.filterPriority = '';
    this.filterStatus = '';
    this.activeFilters = 0;
    this.applyFilters();
  }

  // ============ Sort ============

  sortBy(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    // Reset to first page when sorting
    this.currentPage = 1;
  }

  toggleSort(): void {
    if (!this.sortField) {
      this.sortField = 'date';
    } else {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    }
    this.currentPage = 1;
  }

  // ============ Pagination ============

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.getTotalPages()) {
      this.currentPage++;
    }
  }

  goToPage(page: number): void {
    this.currentPage = page;
  }

  // ============ View Toggles ============

  setActiveView(view: string): void {
    this.activeView = view;
    this.showToastMessage(`Switched to ${view} view`);
  }

  setTimeRange(range: string): void {
    this.timeRange = range;
    this.showToastMessage(`Viewing ${range} data`);
    // Update chart data based on range
    this.updateChartData(range);
  }

  updateChartData(range: string): void {
    // Simulate different data for different ranges
    if (range === 'Week') {
      this.chartData = [
        { height: 130 }, { height: 100 }, { height: 150 },
        { height: 70 }, { height: 110 }, { height: 40 },
        { height: 90 }, { height: 130 }
      ];
    } else if (range === 'Month') {
      this.chartData = [
        { height: 160 }, { height: 120 }, { height: 140 },
        { height: 90 }, { height: 130 }, { height: 60 },
        { height: 110 }, { height: 150 }
      ];
    } else {
      this.chartData = [
        { height: 180 }, { height: 140 }, { height: 160 },
        { height: 100 }, { height: 150 }, { height: 80 },
        { height: 130 }, { height: 170 }
      ];
    }
  }

  // ============ Selection ============

  isSelected(meeting: Meeting): boolean {
    return this.selectedMeetings.some(m => m.id === meeting.id);
  }

  toggleMeetingSelection(meeting: Meeting, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.checked) {
      this.selectedMeetings.push(meeting);
    } else {
      const index = this.selectedMeetings.indexOf(meeting);
      if (index > -1) {
        this.selectedMeetings.splice(index, 1);
      }
    }
  }

  toggleAllMeetings(event: Event): void {
    const input = event.target as HTMLInputElement;
    const currentPageMeetings = this.getFilteredMeetings();
    if (input.checked) {
      this.selectedMeetings = [...currentPageMeetings];
    } else {
      this.selectedMeetings = [];
    }
  }

  // ============ Modal Operations ============

  openScheduleModal(): void {
    this.router.navigate(['/meetings/schedule']);
  }

  closeScheduleModal(): void {
    this.showScheduleModal = false;
    this.resetForm();
  }

  resetForm(): void {
    this.newMeeting = {
      title: '',
      customer: '',
      orgId: null,
      type: '',
      date: '',
      time: '',
      duration: '1 hour',
      priority: 'Medium',
      host: '',
      link: '',
      description: ''
    };
  }

  isFormValid(): boolean {
    return !!(this.newMeeting.title &&
      this.newMeeting.customer &&
      this.newMeeting.type &&
      this.newMeeting.date &&
      this.newMeeting.time &&
      this.newMeeting.host);
  }

  saveMeeting(): void {
    if (!this.isFormValid()) {
      this.showToastMessage('Please fill in all required fields');
      return;
    }

    const newId = Math.max(...this.meetings.map(m => m.id)) + 1;
    const customerInitial = this.newMeeting.customer[0].toUpperCase();
    const colorMap: { [key: string]: string } = {
      'TechNova Solutions': 'bg-indigo-500',
      'BrightWave LLC': 'bg-amber-500',
      'GreenLeaf Corp': 'bg-emerald-500',
      'InnoSoft Systems': 'bg-purple-500',
      'Alpha Digital': 'bg-blue-500',
      'DataCore Inc.': 'bg-rose-500'
    };
    const customerColor = colorMap[this.newMeeting.customer] || 'bg-slate-500';

    const newMeeting: Meeting = {
      id: newId,
      title: this.newMeeting.title,
      subtitle: this.newMeeting.description || 'New meeting',
      customer: this.newMeeting.customer,
      customerInitial: customerInitial,
      customerColor: customerColor,
      type: this.newMeeting.type,
      date: this.newMeeting.date,
      time: this.newMeeting.time,
      owner: this.newMeeting.host,
      ownerInitial: this.newMeeting.host.split(' ').map(n => n[0]).join(''),
      priority: this.newMeeting.priority,
      status: 'Scheduled'
    };

    // Add to meetings list
    this.meetings.push(newMeeting);

    // Add to activity log
    this.activities.unshift({
      id: Date.now(),
      title: `New meeting scheduled: "${this.newMeeting.title}" with ${this.newMeeting.customer}`,
      time: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      user: this.newMeeting.host,
      icon: 'fa-calendar-plus',
      iconBg: 'bg-indigo-100',
      iconText: 'text-indigo-600'
    });

    // Log to console
    console.log('📅 New Meeting Scheduled:');
    console.table({
      Title: this.newMeeting.title,
      Customer: this.newMeeting.customer,
      Type: this.newMeeting.type,
      Date: this.newMeeting.date,
      Time: this.newMeeting.time,
      Duration: this.newMeeting.duration,
      Priority: this.newMeeting.priority,
      Host: this.newMeeting.host,
      Link: this.newMeeting.link || 'Not provided',
      Description: this.newMeeting.description || 'None'
    });
    console.log('📋 Full meeting object:', newMeeting);

    this.showToastMessage(`✅ Meeting "${this.newMeeting.title}" scheduled successfully!`);
    this.closeScheduleModal();

    // Update meeting types distribution
    this.updateMeetingTypes();

    // Refresh KPI cards so the new meeting is reflected in the counts.
    this.fetchDashboardStats();
  }

  saveAsDraft(): void {
    this.showToastMessage('Meeting saved as draft');
    this.closeScheduleModal();
  }

  updateMeetingTypes(): void {
    const total = this.meetings.length;
    const typeCount: { [key: string]: number } = {};
    this.meetings.forEach(m => {
      typeCount[m.type] = (typeCount[m.type] || 0) + 1;
    });
    this.meetingTypes = Object.keys(typeCount).map(key => ({
      name: key,
      percentage: Math.round((typeCount[key] / total) * 100),
      color: this.getMeetingTypeColor(key)
    }));
  }

  getMeetingTypeColor(type: string): string {
    const map: { [key: string]: string } = {
      'Kickoff': 'bg-indigo-500',
      'Review': 'bg-purple-500',
      'Training': 'bg-emerald-500',
      'QBR': 'bg-amber-500',
      'Renewal': 'bg-rose-500',
      'Go Live': 'bg-blue-500'
    };
    return map[type] || 'bg-slate-500';
  }

  // ============ Drawer Operations ============

  closeDetailDrawer(): void {
    this.showDetailDrawer = false;
    this.selectedMeeting = null;
  }

  toggleAgendaItem(item: AgendaItem): void {
    item.completed = !item.completed;
    const status = item.completed ? 'completed' : 'uncompleted';
    this.showToastMessage(`Agenda item "${item.text}" ${status}`);
  }

  // ============ Quick Actions ============

  inviteAttendees(): void {
    this.showToastMessage('Opening invite attendees dialog...');
  }

  createAgenda(): void {
    this.showToastMessage('Creating new agenda template...');
  }

  uploadNotes(): void {
    this.showToastMessage('Opening notes upload dialog...');
  }

  createFollowUp(): void {
    this.showToastMessage('Creating follow-up task...');
  }

  sendReminder(): void {
    this.showToastMessage('Sending reminders to participants...');
  }

  viewTodaySchedule(): void {
    this.showToastMessage('Loading today\'s schedule...');
  }

  viewUpcoming(): void {
    this.showToastMessage('Loading upcoming meetings...');
  }

  viewReport(): void {
    this.showToastMessage('Generating report...');
  }

  viewFollowUps(): void {
    this.showToastMessage('Loading follow-up items...');
  }

  viewAllActivities(): void {
    this.showToastMessage('Loading all activities...');
  }

  refreshData(): void {
    this.refreshing = true;
    this.showToastMessage('Refreshing data...');
    this.fetchDashboardStats();
    this.fetchApiMeetings();
    this.fetchRecentActivity();
    setTimeout(() => {
      this.refreshing = false;
      this.showToastMessage('Data refreshed successfully');
    }, 1000);
  }

  exportData(): void {
    this.showToastMessage('Exporting data...');
    // Simulate export
    const data = JSON.stringify(this.meetings, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meetings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
    this.showToastMessage('Data exported successfully');
  }

  shareDashboard(): void {
    this.showToastMessage('Sharing dashboard...');
  }

  // ============ Toast Notifications ============

  showToastMessage(message: string, title = 'Notice', type: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
    if (type === 'success') {
      this.toastr.success(message, title || 'Success');
    } else if (type === 'error') {
      this.toastr.error(message, title || 'Error');
    } else if (type === 'warning') {
      this.toastr.warning(message, title || 'Warning');
    } else {
      this.toastr.info(message, title || 'Info');
    }
  }

  hideToast(): void {
    this.showToast = false;
  }

  private toastTimeout: any;


  private readonly emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

onMenuInvite(row: MeetingRow): void {
  this.closeActionMenu();
  this.openInviteModal(row);
}

openInviteModal(row: MeetingRow): void {
  this.inviteMeetingRow.set(row);
  this.inviteEmails.set([]);
  this.inviteEmailInput.set('');
  this.inviteError.set(null);
  this.inviteSubmitting.set(false);
  this.showInviteModal.set(true);
}

closeInviteModal(): void {
  if (this.inviteSubmitting()) return;
  this.showInviteModal.set(false);
  this.inviteMeetingRow.set(null);
}

/** Called on (keydown.enter) / (blur) of the email input — supports
 *  comma or space separated paste, e.g. pasting "a@x.com, b@x.com". */
addInviteEmailFromInput(): void {
  const raw = this.inviteEmailInput().trim();
  if (!raw) return;

  const candidates = raw.split(/[,\s]+/).filter(Boolean);
  const current = this.inviteEmails();
  const toAdd: string[] = [];

  for (const email of candidates) {
    if (!this.emailRegex.test(email)) {
      this.inviteError.set(`"${email}" is not a valid email address.`);
      continue;
    }
    if (current.includes(email) || toAdd.includes(email)) continue;
    toAdd.push(email);
  }

  if (toAdd.length > 0) {
    this.inviteEmails.set([...current, ...toAdd]);
    this.inviteError.set(null);
  }

  this.inviteEmailInput.set('');
}

removeInviteEmail(email: string): void {
  this.inviteEmails.set(this.inviteEmails().filter(e => e !== email));
}

confirmInviteAttendees(): void {
  // catch anything still sitting in the input box that wasn't
  // committed with Enter/blur
  if (this.inviteEmailInput().trim()) {
    this.addInviteEmailFromInput();
  }

  const row = this.inviteMeetingRow();
  const emails = this.inviteEmails();

  if (!row || this.inviteSubmitting()) return;

  if (emails.length === 0) {
    this.inviteError.set('Add at least one email address.');
    return;
  }

  this.inviteSubmitting.set(true);
  this.inviteError.set(null);

  this.meetingService.inviteAttendees(row.id, emails).subscribe({
    next: (res) => {
      this.inviteSubmitting.set(false);
      this.showInviteModal.set(false);
      this.inviteMeetingRow.set(null);
      this.toastr.success(res.message, 'Invitation Sent');
      this.fetchRecentActivity();
    },
    error: (err) => {
      this.inviteSubmitting.set(false);
      this.inviteError.set(err?.error?.message ?? 'Failed to send invites.');
    }
  });
}

copyInviteMeetingLink(): void {
  const row = this.inviteMeetingRow();
  const link = row?.meetingLink || row?.webLink;

  if (!link) {
    this.toastr.warning('No meeting link available for this entry.', 'No Link');
    return;
  }

  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(link).then(
      () => this.toastr.success('Meeting link copied to clipboard!', 'Copied'),
      () => this.fallbackCopyInviteLink(link)
    );
  } else {
    this.fallbackCopyInviteLink(link);
  }
}

private fallbackCopyInviteLink(text: string): void {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (successful) {
      this.toastr.success('Meeting link copied to clipboard!', 'Copied');
    } else {
      this.toastr.error('Failed to copy meeting link.', 'Error');
    }
  } catch {
    this.toastr.error('Failed to copy meeting link.', 'Error');
  }
}
}