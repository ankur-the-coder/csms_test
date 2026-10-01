import { Component, signal, computed, ViewChild, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { MeetingService, MeetingRow, Organization, DashboardStats, AttendanceCheckResponse, RecentActivity } from './meetings.service';
import { DataTable } from '../../shared/components/Data-table/data-table';
import { CustomColumnDirective } from '../../shared/components/Data-table/custom-column.directive';
import { SmartTableConfig, RequestContext, BadgeMapEntry } from '../../shared/components/Data-table/data-table.types';
import { Utils } from '../../shared/utils/utils';

import { SingleInput, SelectOption } from '../../shared/components/inputs/single-input/single-input';
import { DatePicker } from '../../shared/components/inputs/date-picker/date-picker';
import { DatePicker as DatePickerService } from '../../shared/service/date-picker/date-picker';
import { TimePickerComponent } from '../../shared/components/inputs/time-picker/time-picker';

import { Calendar, DayEvent } from '../../shared/components/inputs/calendar/calendar';
import { ChartComponent } from '../../shared/components/inputs/charts/charts';
import { CountUpDirective } from '../dashboard/component/dashboard/count-up.directive';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-meetings',
  standalone: true,
  imports: [CommonModule, FormsModule, SingleInput, DatePicker, TimePickerComponent, DataTable, CustomColumnDirective, Calendar, ChartComponent, CountUpDirective],
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
  searchTerm = '';

  // ============ Organizations & API Meetings ============
  organizations: Organization[] = [];
  loadingOrganizations = false;
  apiMeetings = signal<MeetingRow[]>([]);
  filterDateFrom: string = '';
  filterDateTo: string = '';
  initialDateFrom = signal<string>('');
  initialDateTo = signal<string>('');
  initialFilters = signal<Record<string, any>>({});

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
  private imp = environment.apiUrl;

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

  rescheduleDurationSelectOptions: SelectOption[] = [
    { label: '15 minutes', value: 15 },
    { label: '30 minutes', value: 30 },
    { label: '45 minutes', value: 45 },
    { label: '1 hour', value: 60 },
    { label: '1 hour 30 minutes', value: 90 },
    { label: '2 hours', value: 120 },
  ];

  // ============ Meetings DataTable Config ============
  private readonly meetingsEndpoint = `${this.imp}/meetings/fetchMeetings`;

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
        const empId = this.getScopedEmpId();

        const body = {
          start: ctx.page * ctx.pageSize,
          length: ctx.pageSize,
          search: ctx.search ?? '',
          sorting: `${ctx.sortKey ?? 'startTime'},${ctx.sortDir}`,
          filter: JSON.stringify(filters),
          fromDate: ctx.dateFrom ?? '',
          toDate: ctx.dateTo ?? '',
          userId: empId,
        };

        return {
          method: 'POST' as const,
          body
        };
      },
      transformRow: (raw: any): MeetingRow => {
        return {
          ...raw,
          clientMail: this.decodeEmail(raw?.clientMail)
        };
      },
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
      { id: 'filter', type: 'filter', label: 'Filter' },
      { id: 'export', type: 'export', label: 'Export' },
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
    const menuHeight = 160;

    // If there is not enough room below the trigger, open above it
    const fitsBelow = trigger.bottom + menuHeight + 8 <= window.innerHeight;
    const top = fitsBelow
      ? trigger.bottom + 6
      : Math.max(8, trigger.top - menuHeight - 6);

    const left = Math.max(8, Math.min(trigger.right - menuWidth, window.innerWidth - menuWidth - 8));

    this.actionMenuOpenRowId.set(row.id);
    this.actionMenuRow.set(row);
    this.actionMenuPosition.set({ top, left });
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

  decodeEmail(email?: string): string {
    if (!email) return '';
    try {
      return Utils.decode5t(email) || email;
    } catch {
      return email;
    }
  }

  /** '1' = admin/global view (see everyone's data). Anything else = scope to the logged-in employee. */
  private isAdminView(): boolean {
    return false;
  }

  /** Returns the empId to filter by, or undefined if the user should see all data (admin). */
  private getScopedEmpId(): string | undefined {
    if (this.isAdminView()) {
      return undefined;
    }
    const raw = localStorage.getItem('empId');
    return raw || undefined;
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
        localStorage.getItem('email') || '',
        dateTime.start,
        dateTime.end
      )
      .subscribe({

        next: () => {

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

    this.meetingService.cancelMeeting(row.id,localStorage.getItem('email') || '').subscribe({
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

    this.meetingService.checkAttendance(row.id,localStorage.getItem('email') || '').subscribe({
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
      'bg-amber-500', 'bg-rose-500', 'bg-blue-500', 'bg-teal-500'
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
    private route: ActivatedRoute,
    private meetingService: MeetingService,
    private cdr: ChangeDetectorRef,
    private toastr: ToastrService
  ) { }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const from = params.get('from');
      const to = params.get('to');
      const status = params.get('status');

      if (from && to) {
        this.initialDateFrom.set(from);
        this.initialDateTo.set(to);
        this.filterDateFrom = from;
        this.filterDateTo = to;
      }

      if (status) {
        const s = status.toLowerCase();
        let statusVal: string | null = null;
        if (s === 'pending' || s === '3') statusVal = '3';
        else if (s === 'scheduled' || s === '0') statusVal = '0';
        else if (s === 'completed' || s === '1') statusVal = '1';
        else if (s === 'rescheduled' || s === '2') statusVal = '2';
        else if (s === 'cancelled' || s === '4') statusVal = '4';
        else if (s === 'client_no_show' || s === '5') statusVal = '5';
        else if (s === 'host_no_show' || s === '6') statusVal = '6';

        if (statusVal !== null) {
          this.initialFilters.set({ meetingStatus: [statusVal] });
        }
      }

      if (status || (from && to)) {
        this.activeView = 'table';
        setTimeout(() => {
          this.scrollToDataTable();
        }, 150);
        setTimeout(() => {
          this.scrollToDataTable();
        }, 400);
      }
    });

    this.fetchApiMeetings();
    this.fetchDashboardStats();
    this.fetchRecentActivity();
    document.addEventListener('scroll', this.closeActionMenuOnScroll, true);
  }

  scrollToDataTable(): void {
    const el = document.getElementById('tableSection');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  fetchApiMeetings(): void {
    // Scope meetings fetch to the logged-in employee only
    const filters: Record<string, any> = {};
    const empId = this.getScopedEmpId();

    this.meetingService.fetchMeetings({
      start: 0,
      length: 500,
      search: this.searchTerm || '',
      sorting: 'startTime,desc',
      filter: JSON.stringify(filters),
      fromDate: this.filterDateFrom || '',
      toDate: this.filterDateTo || '',
      userId: empId
    }).subscribe({
      next: (res) => {
        if (res && res.data) {
          const decodedMeetings = (res.data || []).map(m => ({
            ...m,
            clientMail: this.decodeEmail(m.clientMail)
          }));
          this.apiMeetings.set(decodedMeetings);
          if (decodedMeetings.length > 0 && decodedMeetings[0].startTime) {
            const firstDate = new Date(decodedMeetings[0].startTime);
            if (!isNaN(firstDate.getTime())) {
              this.calendarMonth.set(firstDate.getMonth());
              this.calendarYear.set(firstDate.getFullYear());
            }
          }
          this.updateMeetingTypesChartFromApi(decodedMeetings, res.meta?.total || decodedMeetings.length);
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
  }

  /** Pulls the dashboard KPI card numbers from GET /meetings/dashboard-stats. */
  fetchDashboardStats(): void {
    this.loadingDashboardStats = true;
    const empId = this.getScopedEmpId();
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
    const empId = this.getScopedEmpId();

    this.meetingService.getRecentActivity(empId).subscribe({
      next: (activity) => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        let recent = (activity || []).filter(item => {
          const activityDate = new Date(item.time);
          return !isNaN(activityDate.getTime()) && activityDate >= sevenDaysAgo;
        });

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

  // ============ Chart data (Meeting Types donut) ============

  meetingTypeChartData: number[] = [];
  meetingTypeChartLabels: string[] = [];
  meetingTypeChartColors: string[] = [];
  meetingTypeDonutCenter = {
    line1: '0',
    line2: 'total',
    line3: ''
  };

  // ============ KPI Helper Methods ============
  // These read from the /meetings/dashboard-stats API (this.dashboardStats).

  getTodayMeetings(): number {
    return this.dashboardStats().todayMeetings;
  }

  getUpcomingMeetings(): number {
    return this.dashboardStats().upcoming7Days;
  }

  getCompletedCount(): number {
    return this.dashboardStats().completedThisMonth;
  }

  getPendingFollowUps(): number {
    return this.dashboardStats().followUpsPending;
  }

  // ============ KPI Card Click Handlers ============

  private formatLocalDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  filterByToday(): void {
    const today = this.formatLocalDate(new Date());
    this.initialDateFrom.set(today);
    this.initialDateTo.set(today);
    this.filterDateFrom = today;
    this.filterDateTo = today;
    this.initialFilters.set({ meetingStatus: [] });

    if (this.meetingsTable) {
      this.meetingsTable.dateFrom.set(today);
      this.meetingsTable.dateTo.set(today);
      this.meetingsTable.activeFilters.set({ search: '', meetingStatus: [] });
      this.meetingsTable.tempFilters.set({ meetingStatus: [] });
      this.meetingsTable.page.set(0);
    }

    this.activeView = 'table';
    setTimeout(() => this.scrollToDataTable(), 100);
    setTimeout(() => this.scrollToDataTable(), 350);
  }

  filterByUpcoming(): void {
    const now = new Date();
    const next7 = new Date();
    next7.setDate(now.getDate() + 7);
    const from = this.formatLocalDate(now);
    const to = this.formatLocalDate(next7);

    this.initialDateFrom.set(from);
    this.initialDateTo.set(to);
    this.filterDateFrom = from;
    this.filterDateTo = to;
    this.initialFilters.set({ meetingStatus: [] });

    if (this.meetingsTable) {
      this.meetingsTable.dateFrom.set(from);
      this.meetingsTable.dateTo.set(to);
      this.meetingsTable.activeFilters.set({ search: '', meetingStatus: [] });
      this.meetingsTable.tempFilters.set({ meetingStatus: [] });
      this.meetingsTable.page.set(0);
    }

    this.activeView = 'table';
    setTimeout(() => this.scrollToDataTable(), 100);
    setTimeout(() => this.scrollToDataTable(), 350);
  }

  filterByCompleted(): void {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const from = this.formatLocalDate(firstDay);
    const to = this.formatLocalDate(lastDay);

    this.initialDateFrom.set(from);
    this.initialDateTo.set(to);
    this.filterDateFrom = from;
    this.filterDateTo = to;
    this.initialFilters.set({ meetingStatus: ['1'] });

    if (this.meetingsTable) {
      this.meetingsTable.dateFrom.set(from);
      this.meetingsTable.dateTo.set(to);
      this.meetingsTable.activeFilters.set({ search: '', meetingStatus: ['1'] });
      this.meetingsTable.tempFilters.set({ meetingStatus: ['1'] });
      this.meetingsTable.page.set(0);
    }

    this.activeView = 'table';
    setTimeout(() => this.scrollToDataTable(), 100);
    setTimeout(() => this.scrollToDataTable(), 350);
  }

  filterByPendingFollowUps(): void {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const from = this.formatLocalDate(firstDay);
    const to = this.formatLocalDate(lastDay);

    this.initialDateFrom.set(from);
    this.initialDateTo.set(to);
    this.filterDateFrom = from;
    this.filterDateTo = to;
    this.initialFilters.set({ meetingStatus: ['3'] });

    if (this.meetingsTable) {
      this.meetingsTable.dateFrom.set(from);
      this.meetingsTable.dateTo.set(to);
      this.meetingsTable.activeFilters.set({ search: '', meetingStatus: ['3'] });
      this.meetingsTable.tempFilters.set({ meetingStatus: ['3'] });
      this.meetingsTable.page.set(0);
    }

    this.activeView = 'table';
    setTimeout(() => this.scrollToDataTable(), 100);
    setTimeout(() => this.scrollToDataTable(), 350);
  }

  // ============ View Toggles ============

  setActiveView(view: string): void {
    this.activeView = view;
  }

  // ============ Calendar & Timeline API Helper Methods ============

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
        accentClass: 'border-indigo-500',
        purpose: m.purpose,
        meetingType: m.meetingType,
        duration: this.formatDuration(m.duration),
        status: m.status,
        statusLabel: this.getStatusLabel(m.status),
        statusClass: this.getStatusClass(m.status),
        orgId: m.orgId ?? undefined,
        raw: m
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
    let result = [...this.apiMeetings()];
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

  // ============ Modal Operations ============

  openScheduleModal(): void {
    this.router.navigate(['/meetings/schedule']);
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
    const hostmail = localStorage.getItem('email') || '';

    if (!row || this.inviteSubmitting()) return;

    if (emails.length === 0) {
      this.inviteError.set('Add at least one email address.');
      return;
    }

    this.inviteSubmitting.set(true);
    this.inviteError.set(null);

    this.meetingService.inviteAttendees(row.id, emails,hostmail).subscribe({
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