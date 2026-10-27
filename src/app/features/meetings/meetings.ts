import { Component, signal, computed, ViewChild, ElementRef, OnInit, OnDestroy, AfterViewInit, HostListener, ChangeDetectorRef, NgZone, ViewEncapsulation } from '@angular/core';
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
import { utils } from 'xlsx';
import { MeetingFlowComponent } from './meeting-flow';
import * as QRCode from 'qrcode';

@Component({
  selector: 'app-meetings',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [CommonModule, FormsModule, SingleInput, DatePicker, TimePickerComponent, DataTable, CustomColumnDirective, Calendar, ChartComponent, CountUpDirective, MeetingFlowComponent],
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

/* Schedule Meeting button */
.schedule-shine-btn {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  border: none;
  transition:
    transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1),
    box-shadow 280ms ease;
}

/* Slight lift on hover */
.schedule-shine-btn:not(:disabled):hover {
  transform: translateY(-3px);
  box-shadow: 0 7px 14px rgba(0, 0, 0, 0.14);
}

/* Moving shine */
.schedule-shine-btn::before {
  content: "";
  position: absolute;
  top: -50%;
  left: -100%;
  width: 45%;
  height: 200%;
  transform: skewX(-25deg);

  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.15) 25%,
    rgba(255, 255, 255, 0.7) 50%,
    rgba(255, 255, 255, 0.15) 75%,
    transparent 100%
  );

  pointer-events: none;
  z-index: 1;
}

.schedule-shine-btn:not(:disabled):hover::before {
  animation: schedule-button-shine 800ms ease-in-out;
}

@keyframes schedule-button-shine {
  from {
    left: -100%;
  }

  to {
    left: 150%;
  }
}

/* Click feedback */
.schedule-shine-btn:not(:disabled):active {
  transform: translateY(-1px) scale(0.98);
}

/* Respect reduced-motion preferences */
@media (prefers-reduced-motion: reduce) {
  .schedule-shine-btn {
    transition: none;
  }

  .schedule-shine-btn:hover::before {
    animation: none;
  }
}
  `]
})
export class MeetingsComponent implements OnInit, OnDestroy, AfterViewInit {

  // Reference to the table so we can ask it to reload after cancelling a
  // meeting. NOTE: '.refresh()' below is a guess at the method name — check
  // your actual DataTable component's public API and rename if different
  // (common alternatives: reload(), fetchData(), loadData()).
  @ViewChild(DataTable) meetingsTable?: DataTable<any>;

  // ============ Flow Canvas Refs & State ============
  @ViewChild('flowViewport', { static: false }) flowViewportRef?: ElementRef<HTMLDivElement>;
  @ViewChild('flowWorld', { static: false }) flowWorldRef?: ElementRef<HTMLDivElement>;
  @ViewChild('flowWires', { static: false }) flowWiresRef?: ElementRef<SVGSVGElement>;
  @ViewChild('flowNodes', { static: false }) flowNodesRef?: ElementRef<HTMLDivElement>;

  flowView = { x: 0, y: 0, k: 1 };
  flowW = 800; flowH = 860;
  flowNodes: Record<string, any> = {};
  flowSegs: any[] = [];
  flowPacks: any[] = [];
  flowTouched = false;
  flowAnimId: number | null = null;
  flowDrag: any = null;
  flowPtrs: Record<number, { x: number; y: number }> = {};
  flowPinch: any = null;
  flowZoomLabel = '100%';
  flowSearchTerm = '';
  flowStatusFilter = 'All';
  flowSelectedDate: Date | null = null;
  flowIsFullScreen = false;
  flowStatusOptions: SelectOption[] = [
    { label: 'All Statuses', value: 'All' },
    { label: 'Scheduled', value: 'Scheduled' },
    { label: 'Completed', value: 'Completed' },
    { label: 'Cancelled', value: 'Cancelled' },
    { label: 'Pending', value: 'Pending' },
    { label: 'Rescheduled', value: 'Rescheduled' }
  ];
  flowMonth = new Date().getMonth();
  flowYear = new Date().getFullYear();
  flowIsPanning = false;
  private readonly FLOW_COLORS = ['#0ea371', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7', '#14b8a6'];
  private readonly FLOW_K = 0.1;
  private readonly FLOW_D = 0.87;
  private readonly FLOW_SP = 0.00028;
  private flowReducedMotion = false;
  flowLegend: { name: string; color: string }[] = [];

  // FIX: the Flow viewport element is destroyed/re-created by *ngIf every time the
  // user switches views. Track WHICH element the listeners are bound to (instead of
  // a one-time boolean) so they are re-attached to each new element.
  private flowBoundVp: HTMLDivElement | null = null;
  // window/document listeners only need to be registered once.
  private flowGlobalBound = false;

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
  showInviteQr = signal(false);
  inviteQrDataUrl = signal<string | null>(null);

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
  selectedAttendanceMeeting: MeetingRow | null = null;

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
        key: 'orgName',
        label: 'Organisation',
        sortable: true,hideable: false
      },
      {
        key: 'title',
        label: 'Meeting',
        sortable: true,
      },
      {
        key: 'organizerName',
        label: 'Organizer',
        excludeFromExport: false,
        excludeFromPdf: true,hideable: false
      },
      {
        key: 'meetingType',
        label: 'Meeting Type',
        hideable: false
      },
      {
        key: 'purpose',
        label: 'Purpose',
        sortable: false,
        type: 'text',hideable: false
      },
      {
        key: 'createdDate',
        label: 'Created Date',
        sortable: true,hideable: false
      },
      {
        key: 'startTime',
        label: 'Date & Time',
        sortable: true,hideable: false
      },
      {
        key: 'duration',
        label: 'Duration',
        sortable: false,hideable: false
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
          clientMail: this.decodeEmail(raw?.clientMail),
          startTime: Utils.ensureUtcIso(raw?.startTime) || null,
          endTime: Utils.ensureUtcIso(raw?.endTime) || null,
          createdDate: Utils.ensureUtcIso(raw?.createdDate)
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
    clickable: true,
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

  // FIX: window / document level flow listeners as stable class members so they
  // can be registered once and removed on destroy.
  private onFlowWindowResize = () => {
    if (this.activeView === 'flow' && !this.flowTouched) this.flowFit();
  };

  private onFlowFullscreenChange = () => {
    this.flowIsFullScreen = !!document.fullscreenElement;
    setTimeout(() => {
      this.flowFit();
      this.cdr.detectChanges();
    }, 100);
  };

  ngOnDestroy(): void {
    document.removeEventListener('scroll', this.closeActionMenuOnScroll, true);
    window.removeEventListener('resize', this.onFlowWindowResize);
    document.removeEventListener('fullscreenchange', this.onFlowFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', this.onFlowFullscreenChange);
    if (this.flowAnimId != null) {
      cancelAnimationFrame(this.flowAnimId);
      this.flowAnimId = null;
    }
  }

  ngAfterViewInit(): void {
    // Flow animation and listeners are set up lazily when user switches to Flow view
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

  verifyUser(row: MeetingRow): boolean {
    const loggedEmpId = Utils.decode5t(localStorage.getItem('empId'));
    if (!loggedEmpId || !row || row.createdById === undefined || row.createdById === null) {
      return false;
    }
    return String(row.createdById) === String(loggedEmpId);
  }

  isLoggedInUserOrganizer(row: MeetingRow): boolean {
    if (!row) return false;

    // 1. Compare organizerName with logged-in user's userName (case-insensitive)
    const currentUserName = (localStorage.getItem('userName') || '').trim().toLowerCase();
    const rowOrganizerName = (row.organizerName || '').trim().toLowerCase();
    if (currentUserName && rowOrganizerName && currentUserName === rowOrganizerName) {
      return true;
    }

    // 2. Compare empId / createdById with logged-in empId (both raw and decoded)
    const rawEmpId = localStorage.getItem('empId');
    if (rawEmpId) {
      const cleanRaw = String(rawEmpId).trim();
      let decodedEmpId = '';
      try {
        decodedEmpId = Utils.decode5t(rawEmpId).trim();
      } catch {
        decodedEmpId = '';
      }

      const matchIds = [cleanRaw, decodedEmpId].filter(Boolean);
      const rowEmpId = String(row.empId ?? '').trim();
      const rowCreatedById = String(row.createdById ?? '').trim();

      if (rowEmpId && matchIds.includes(rowEmpId)) {
        return true;
      }
      if (rowCreatedById && matchIds.includes(rowCreatedById)) {
        return true;
      }
    }

    return false;
  }

  getOrganizerInitials(name?: string): string {
    if (!name) return '?';
    return name.trim().split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  openRescheduleModal(row: MeetingRow): void {
    if (!this.canRescheduleMeeting(row)) {
      return;
    }

    this.closeActionMenu();

    this.selectedRescheduleMeeting = row;
    this.rescheduleError = null;
    this.minDateToday = new Date();

    // Use existing meeting date/time (in user's country timezone) if in the future, otherwise now
    const meetingDate = row.startTime ? new Date(row.startTime) : null;
    const now = new Date();
    const initialDate = (meetingDate && !isNaN(meetingDate.getTime()) && meetingDate.getTime() > now.getTime())
      ? meetingDate
      : now;

    this.rescheduleDate = this.formatDateForInput(initialDate);
    this.rescheduleTime = this.formatTimeForInput(initialDate);

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
    const [hours, minutes] = timeStr.split(':').map(Number);
    const dateParts = formattedDate.split('-').map(Number);

    if (dateParts.length !== 3) {
      const d = new Date(`${formattedDate}T${timeStr}:00`);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    // Construct local Date in the user's country timezone
    const start = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], hours, minutes, 0, 0);

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

    // Convert local country time into International Standard Time (UTC ISO string)
    return {
      start: start.toISOString(),
      end: end.toISOString()
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
          this.closeRescheduleModal();
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

  /** Close the reschedule modal only when the backdrop itself is clicked (not its children). */
  onRescheduleBackdropMouseDown(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeRescheduleModal();
    }
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
    this.selectedAttendanceMeeting = row;
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
    this.selectedAttendanceMeeting = null;
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
    private toastr: ToastrService,
    private ngZone: NgZone
  ) {
    this.flowReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

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
          const decodedMeetings: MeetingRow[] = (res.data || []).map(m => ({
            ...m,
            clientMail: this.decodeEmail(m.clientMail),
            startTime: Utils.ensureUtcIso(m.startTime) || null,
            endTime: Utils.ensureUtcIso(m.endTime) || null,
            createdDate: Utils.ensureUtcIso(m.createdDate)
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
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const currentMonthRows = (rows || []).filter(r => {
      const dateStr = r.startTime || r.createdDate;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    if (currentMonthRows.length === 0) {
      this.meetingTypeChartData = [];
      this.meetingTypeChartLabels = [];
      this.meetingTypeChartColors = [];
      this.meetingTypeDonutCenter = {
        line1: '0',
        line2: 'total',
        line3: ''
      };
      return;
    }

    const counts: Record<string, number> = {};
    for (const r of currentMonthRows) {
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
      line1: currentMonthRows.length.toString(),
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
    now.setDate(now.getDate());
    const next7 = new Date();
    next7.setDate(now.getDate() + 6);
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
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1 - 7);
    const lastDay = new Date(now.getFullYear(), now.getMonth(),1);
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

  // First and last day of the current month
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Format as YYYY-MM-DD using LOCAL time
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const from = fmt(firstDay);
  const to = fmt(lastDay);


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
    if (view === 'flow') {
      // FIX: make sure the *ngIf block (and #flowViewport) actually exists in the DOM
      // before we try to draw into it / bind listeners to it.
      this.cdr.detectChanges();
      setTimeout(() => this.renderFlowCanvas(), 0);
    }
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
    this.showInviteQr.set(false);
    this.inviteQrDataUrl.set(null);
    this.showInviteModal.set(true);
    this.generateInviteQr(row);
  }

  closeInviteModal(): void {
    if (this.inviteSubmitting()) return;
    this.showInviteModal.set(false);
    this.inviteMeetingRow.set(null);
    this.showInviteQr.set(false);
    this.inviteQrDataUrl.set(null);
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

  async generateInviteQr(row: MeetingRow): Promise<void> {
    const link = row?.meetingLink || row?.webLink;
    if (!link) {
      this.inviteQrDataUrl.set(null);
      return;
    }
    try {
      const dataUrl = await QRCode.toDataURL(link, {
        width: 240,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      });
      this.inviteQrDataUrl.set(dataUrl);
    } catch (err) {
      console.error('Failed to generate meeting QR code:', err);
      this.inviteQrDataUrl.set(null);
    }
  }

  toggleInviteQrCode(): void {
    const next = !this.showInviteQr();
    this.showInviteQr.set(next);
    if (next && !this.inviteQrDataUrl()) {
      const row = this.inviteMeetingRow();
      if (row) {
        this.generateInviteQr(row);
      }
    }
  }

  downloadQrCode(): void {
    const dataUrl = this.inviteQrDataUrl();
    if (!dataUrl) {
      this.toastr.warning('No QR code available to download.', 'Notice');
      return;
    }
    const row = this.inviteMeetingRow();
    const filename = `${(row?.title || 'meeting').replace(/[^a-zA-Z0-9_-]/g, '_')}_qr.png`;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    this.toastr.success('QR Code image downloaded successfully!', 'Downloaded');
  }

  async shareQrCode(): Promise<void> {
    const row = this.inviteMeetingRow();
    const link = row?.meetingLink || row?.webLink || '';
    const title = row?.title || 'Meeting';
    const dataUrl = this.inviteQrDataUrl();

    if (navigator?.share) {
      try {
        if (dataUrl && navigator.canShare) {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const file = new File([blob], `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}_qr.png`, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `Join ${title}`,
              text: `Scan the QR code or click the link to join: ${title}`,
              url: link,
              files: [file]
            });
            this.toastr.success('Shared successfully!', 'Shared');
            return;
          }
        }

        await navigator.share({
          title: `Join ${title}`,
          text: `Scan QR code or click the link to join: ${title}`,
          url: link
        });
        this.toastr.success('Shared successfully!', 'Shared');
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    // Fallback: Copy link and inform user
    if (link) {
      this.fallbackCopyInviteLink(link);
    }
  }

  // ============ Flow Canvas Engine ============

  private readonly MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  getFlowMonthLabel(): string {
    const last = new Date(this.flowYear, this.flowMonth + 1, 0).getDate();
    return `01 ${this.MONTHS_SHORT[this.flowMonth]} ${this.flowYear} - ${last} ${this.MONTHS_SHORT[this.flowMonth]} ${this.flowYear}`;
  }

  flowMonthNav(dir: number): void {
    this.flowMonth += dir;
    if (this.flowMonth < 0) { this.flowMonth = 11; this.flowYear--; }
    if (this.flowMonth > 11) { this.flowMonth = 0; this.flowYear++; }
    this.flowSelectedDate = null;
    this.renderFlowCanvas();
  }

  onFlowDateSelect(d: Date): void {
    this.flowSelectedDate = d;
    if (d) {
      const parsed = new Date(d);
      if (!isNaN(parsed.getTime())) {
        this.flowYear = parsed.getFullYear();
        this.flowMonth = parsed.getMonth();
      }
    }
    this.renderFlowCanvas();
  }

  onFlowClearDate(): void {
    this.flowSelectedDate = null;
    this.renderFlowCanvas();
  }

  toggleFlowFullScreen(): void {
    const vp = this.flowViewportRef?.nativeElement;
    if (!vp) return;

    if (!document.fullscreenElement) {
      const req = vp.requestFullscreen || (vp as any).webkitRequestFullscreen || (vp as any).msRequestFullscreen;
      if (req) {
        req.call(vp).catch(() => {});
      }
    } else {
      const exit = document.exitFullscreen || (document as any).webkitExitFullscreen || (document as any).msExitFullscreen;
      if (exit) {
        exit.call(document).catch(() => {});
      }
    }
  }

  flowResetFilters(): void {
    this.flowSearchTerm = '';
    this.flowStatusFilter = 'All';
    this.flowSelectedDate = null;
    this.flowMonth = new Date().getMonth();
    this.flowYear = new Date().getFullYear();
    this.renderFlowCanvas();
  }

  onFlowSearchChange(): void {
    this.renderFlowCanvas();
  }

  onFlowStatusChange(): void {
    this.renderFlowCanvas();
  }

  private getFlowFilteredMeetings(): MeetingRow[] {
    const q = this.flowSearchTerm.trim().toLowerCase();
    return this.apiMeetings().filter(m => {
      // Date filter
      const d = m.startTime ? new Date(m.startTime) : null;
      if (!d || isNaN(d.getTime())) return false;

      if (this.flowSelectedDate) {
        const sel = new Date(this.flowSelectedDate);
        if (
          d.getFullYear() !== sel.getFullYear() ||
          d.getMonth() !== sel.getMonth() ||
          d.getDate() !== sel.getDate()
        ) {
          return false;
        }
      } else {
        if (d.getFullYear() !== this.flowYear || d.getMonth() !== this.flowMonth) return false;
      }

      // Status filter
      if (this.flowStatusFilter && this.flowStatusFilter !== 'All') {
        const sl = this.getStatusLabel(m.status);
        if (sl.toLowerCase() !== this.flowStatusFilter.toLowerCase()) return false;
      }

      // Search filter
      if (q) {
        const hay = [m.title, m.orgName, m.organizerName, m.clientMail, m.meetingType].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  renderFlowCanvas(): void {
    const vp = this.flowViewportRef?.nativeElement;
    const world = this.flowWorldRef?.nativeElement;
    const wires = this.flowWiresRef?.nativeElement;
    const nodesEl = this.flowNodesRef?.nativeElement;
    if (!vp || !world || !wires || !nodesEl) return;

    // FIX: bind interaction listeners to the CURRENT viewport element. The element is
    // re-created by *ngIf each time the Flow tab is opened, so a one-time boolean
    // flag left the new element without any listeners (no zoom / pan / drag).
    if (this.flowBoundVp !== vp) {
      this.flowBoundVp = vp;
      this.flowDrag = null;
      this.flowPinch = null;
      this.flowPtrs = {};
      this.flowIsPanning = false;
      this.bindFlowListeners(vp);
    }

    // Clear
    nodesEl.innerHTML = '';
    wires.innerHTML = '';
    this.flowNodes = {};
    this.flowSegs = [];
    this.flowPacks = [];

    const rows = this.getFlowFilteredMeetings();
    if (!rows.length) {
      this.flowLegend = [];
      nodesEl.innerHTML = `<div style="position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);width:320px;text-align:center;color:#6b7280;padding:70px 20px">No meetings found for this period.</div>`;
      this.cdr.detectChanges();
      return;
    }

    // Determine unique organizers
    const ord: string[] = [];
    rows.forEach(m => { if (m.organizerName && !ord.includes(m.organizerName)) ord.push(m.organizerName); });

    // Sort rows by organizer then time
    const sortedRows = rows.slice().sort((a, b) =>
      ord.indexOf(a.organizerName || '') - ord.indexOf(b.organizerName || '') ||
      ((a.startTime || '') < (b.startTime || '') ? -1 : 1)
    );

    const n = sortedRows.length;
    const GAP = 214;
    const xs = sortedRows.map((_, i) => 60 + GAP * (i + 0.5));
    this.flowW = n * GAP + 120;

    // Compute organizer X positions (average of their meetings' x positions)
    const ox = ord.map(o => {
      let total = 0, count = 0;
      sortedRows.forEach((m, i) => { if (m.organizerName === o) { total += xs[i]; count++; } });
      return count ? total / count : this.flowW / 2;
    });
    // Ensure minimum spacing between organizers
    for (let j = 1; j < ox.length; j++) {
      ox[j] = Math.max(ox[j], ox[j - 1] + 230);
    }
    this.flowW = Math.max(this.flowW, (ox[ox.length - 1] || 0) + 150);

    // Create hub (Teams) node
    const hubEl = this.createFlowNode(nodesEl, 'hub', 'flow-node flow-hub', this.flowW / 2, 480,
      `<i class="flow-hub-ring"></i><i class="flow-hub-ring"></i>` +
     `<img src="/teamsLogo.png" alt="Microsoft Teams" class="flow-hub-logo" width="86" height="90" style="width:86px;height:90px;object-fit:contain;display:block;pointer-events:none" draggable="false" />` +
      `<span>Microsoft Teams</span><small>${n} meeting${n > 1 ? 's' : ''}</small>`
    );

    // Create organizer nodes (bottom row)
    const orgNodes = ord.map((o, j) => {
      const mm = sortedRows.filter(m => m.organizerName === o);
      const totalDur = mm.reduce((a, m) => a + (parseInt(m.duration, 10) || 0), 0);
      const c = this.FLOW_COLORS[j % this.FLOW_COLORS.length];
      const initial = (o || '?').charAt(0).toUpperCase();
      return this.createFlowNode(nodesEl, 'o' + j, 'flow-node flow-oc', ox[j], 770,
        `<div class="flow-av" style="--c:${c};--fc:${c}">${initial}</div>` +
        `<div><b title="${this.escHtml(o)}">${this.escHtml(o)}</b>` +
        `<small>Organizer · ${mm.length} meeting</small></div>`,
        { 'data-o': String(j), style: `--c:${c};--fc:${c}` }
      );
    });

    // Create meeting cards (top row)
    const mcNodes = sortedRows.map((m, i) => {
      const j = ord.indexOf(m.organizerName || '');
      (m as any)._flowOrgIdx = j;
      const c = this.FLOW_COLORS[j % this.FLOW_COLORS.length];
      const orgInitial = (m.orgName || '?').charAt(0).toUpperCase();
      const statusLabel = this.getStatusLabel(m.status);
      const priorityLabel = this.getPriorityLabel(m.priority);
      const startStr = m.startTime ? new Date(m.startTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
      const timeStart = m.startTime ? new Date(m.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
      const timeEnd = m.endTime ? new Date(m.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
      const statusIcon = statusLabel === 'Completed' ? 'fa-check' :
        statusLabel === 'Cancelled' ? 'fa-times' :
        statusLabel === 'Scheduled' ? 'fa-calendar-check' : 'fa-hourglass-half';
      return this.createFlowNode(nodesEl, 'm' + i, 'flow-node flow-mc', xs[i], 160,
        `<div class="flow-av" style="--c:${c};--fc:${c}">${orgInitial}</div>` +
        `<b title="${this.escHtml(m.orgName)}">${this.escHtml(m.orgName)}</b>` +
        `<small title="${this.escHtml(m.title)}">${this.escHtml(m.title)}</small>` +
        `<span class="flow-tag">${this.escHtml(m.meetingType || 'Meeting')}</span>` +
        `<div class="flow-chips">` +
          `<span><i class="far fa-calendar-alt text-slate-400"></i> ${startStr}</span>` +
          `<span><i class="far fa-clock text-slate-400"></i> ${timeStart}${timeEnd ? ' – ' + timeEnd : ''}</span>` +
          `<span><i class="fas fa-hourglass-half text-amber-500"></i> ${this.formatDuration(m.duration)} · ${priorityLabel}</span>` +
        `</div>` +
        `<em class="flow-stt s-${statusLabel}"><i class="fas ${statusIcon} text-[9px]"></i> ${statusLabel}</em>`,
        { 'data-m': String(i), style: `--c:${c};--fc:${c}` }
      );
    });

    // Build SVG wire groups
    let svgH = '';
    sortedRows.forEach((m, i) => {
      const j = (m as any)._flowOrgIdx;
      const statusLabel = this.getStatusLabel(m.status);
      const idle = statusLabel !== 'Pending' && statusLabel !== 'Scheduled';
      const c = this.FLOW_COLORS[j % this.FLOW_COLORS.length];
      svgH += `<g class="flow-wire-group${idle ? ' idle' : ''}" style="color:${c}" data-m="${i}" data-o="${j}">` +
        `<path class="flow-wire-line"/><path class="flow-wire-line"/>` +
        `<path class="flow-wire-hit"/><path class="flow-wire-hit"/>` +
        `<circle r="3.6"/><circle r="3.6"/>` +
        `</g>`;
    });
    wires.innerHTML = svgH;

    // Build segment & packet data for animation
    sortedRows.forEach((m, i) => {
      const g = wires.children[i] as SVGGElement;
      const lns = g.querySelectorAll('.flow-wire-line');
      const hts = g.querySelectorAll('.flow-wire-hit');
      const cs = g.querySelectorAll('circle');
      const j = (m as any)._flowOrgIdx;
      const sp = Math.max(-36, Math.min(36, (i - (n - 1) / 2) * 8));
      const statusLabel = this.getStatusLabel(m.status);
      const isLive = statusLabel === 'Pending' || statusLabel === 'Scheduled';

      const segA: any = { k: 'A', a: orgNodes[j], b: hubEl, sp, ln: lns[0], ht: hts[0] };
      const segB: any = { k: 'B', a: hubEl, b: mcNodes[i], sp, ln: lns[1], ht: hts[1] };
      (hts[0] as any).__seg = segA;
      (hts[1] as any).__seg = segB;
      this.flowSegs.push(segA, segB);

      if (isLive) {
        this.flowPacks.push(
          { A: segA, B: segB, base: i * 0.17, el: cs[0] },
          { A: segA, B: segB, base: i * 0.17 + 0.5, el: cs[1] }
        );
      }
    });

    // Legend
    this.flowLegend = ord.map((o, j) => ({
      name: o,
      color: this.FLOW_COLORS[j % this.FLOW_COLORS.length]
    }));

    // Measure and fit
    this.flowTouched = false;
    this.measureFlowNodes();
    this.flowFit();
    setTimeout(() => { this.measureFlowNodes(); if (!this.flowTouched) this.flowFit(); }, 60);

    // Start animation loop (outside Angular for performance)
    if (this.flowAnimId == null) {
      this.ngZone.runOutsideAngular(() => {
        const loop = (ts: number) => {
          this.flowAnimId = requestAnimationFrame(loop);
          if (this.activeView !== 'flow') return;
          this.flowAnimationStep(ts);
        };
        this.flowAnimId = requestAnimationFrame(loop);
      });
    }

    this.cdr.detectChanges();
  }

  private createFlowNode(parent: HTMLElement, id: string, cls: string, x: number, y: number, inner: string, attrs?: Record<string, string>): any {
    const el = document.createElement('div');
    el.className = cls;
    el.dataset['id'] = id;
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'style') el.setAttribute('style', v);
        else el.dataset[k.replace('data-', '')] = v;
      });
    }
    el.innerHTML = inner;
    parent.appendChild(el);
    const o = { el, x, y, hh: 40 };
    this.flowNodes[id] = o;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    return o;
  }

  private measureFlowNodes(): void {
    for (const id in this.flowNodes) {
      this.flowNodes[id].hh = this.flowNodes[id].el.offsetHeight / 2;
    }
  }

  private flowApplyTransform(): void {
    const world = this.flowWorldRef?.nativeElement;
    const vp = this.flowViewportRef?.nativeElement;
    if (!world || !vp) return;
    world.style.transform = `translate(${this.flowView.x}px,${this.flowView.y}px) scale(${this.flowView.k})`;
    vp.style.setProperty('--gx', this.flowView.x + 'px');
    vp.style.setProperty('--gy', this.flowView.y + 'px');
    vp.style.setProperty('--gs', 26 * this.flowView.k + 'px');
    this.flowZoomLabel = Math.round(this.flowView.k * 100) + '%';
  }

  flowZoomAt(mx: number, my: number, factor: number): void {
    const k = Math.max(0.2, Math.min(2.5, this.flowView.k * factor));
    const r = k / this.flowView.k;
    this.flowView.x = mx - (mx - this.flowView.x) * r;
    this.flowView.y = my - (my - this.flowView.y) * r;
    this.flowView.k = k;
    this.flowTouched = true;
    this.flowApplyTransform();
  }

  flowFit(): void {
    const vp = this.flowViewportRef?.nativeElement;
    if (!vp) return;
    const r = vp.getBoundingClientRect();
    if (!r.width) return;
    const k = Math.max(0.2, Math.min(1.1, Math.min(r.width / this.flowW, r.height / this.flowH) * 0.94));
    this.flowView.k = k;
    this.flowView.x = (r.width - this.flowW * k) / 2;
    this.flowView.y = (r.height - this.flowH * k) / 2;
    this.flowApplyTransform();
  }

  flowZoomIn(): void {
    const vp = this.flowViewportRef?.nativeElement;
    if (!vp) return;
    const r = vp.getBoundingClientRect();
    this.flowZoomAt(r.width / 2, r.height / 2, 1.25);
  }

  flowZoomOut(): void {
    const vp = this.flowViewportRef?.nativeElement;
    if (!vp) return;
    const r = vp.getBoundingClientRect();
    this.flowZoomAt(r.width / 2, r.height / 2, 0.8);
  }

  flowZoomFit(): void {
    this.flowTouched = false;
    this.flowFit();
  }

  private flowAnimationStep(ts: number): void {
    // Update wire segments
    this.flowSegs.forEach(s => {
      this.stepFlowSeg(s);
      const e = s.st;
      const c = s.c;
      const d = `M${e.sx} ${e.sy} C${c[0].x} ${c[0].y} ${c[1].x} ${c[1].y} ${e.ex} ${e.ey}`;
      s.ln.setAttribute('d', d);
      s.ht.setAttribute('d', d);
    });

    // Update traveling dots
    this.flowPacks.forEach(p => {
      if (this.flowReducedMotion) { p.el.setAttribute('opacity', '0'); return; }
      const ph = (ts * this.FLOW_SP + p.base) % 1;
      const seg = ph < 0.5 ? p.A : p.B;
      const q = this.flowBezierPt(seg, (ph < 0.5 ? ph : ph - 0.5) * 2);
      p.el.setAttribute('cx', String(q.x));
      p.el.setAttribute('cy', String(q.y));
      p.el.setAttribute('opacity', String(Math.sin(Math.PI * ph)));
    });
  }

  private stepFlowSeg(s: any): void {
    const st = this.flowSegEnds(s);
    const dy = (st.ey - st.sy) * 0.55;
    const t = [{ x: st.sx, y: st.sy + dy }, { x: st.ex, y: st.ey - dy }];

    if (s.pull) {
      const mx = (st.sx + 3 * t[0].x + 3 * t[1].x + st.ex) / 8;
      const my = (st.sy + 3 * t[0].y + 3 * t[1].y + st.ey) / 8;
      let ddx = (s.pull.x - mx) / 0.75;
      let ddy = (s.pull.y - my) / 0.75;
      const L = Math.hypot(ddx, ddy);
      if (L > 340) { ddx *= 340 / L; ddy *= 340 / L; }
      t.forEach(q => { q.x += ddx; q.y += ddy; });
    }

    if (!s.c) {
      s.c = [
        { x: t[0].x, y: t[0].y, vx: 0, vy: 0 },
        { x: t[1].x, y: t[1].y, vx: 0, vy: 0 }
      ];
    }

    const kk = s.pull ? 0.22 : this.FLOW_K;
    t.forEach((q, i) => {
      const c = s.c[i];
      if (this.flowReducedMotion) { c.x = q.x; c.y = q.y; return; }
      c.vx = (c.vx + (q.x - c.x) * kk) * this.FLOW_D;
      c.vy = (c.vy + (q.y - c.y) * kk) * this.FLOW_D;
      c.x += c.vx;
      c.y += c.vy;
    });
    s.st = st;
  }

  private flowSegEnds(s: any): { sx: number; sy: number; ex: number; ey: number } {
    const a = s.a, b = s.b;
    if (s.k === 'A') {
      return { sx: a.x, sy: a.y - a.hh, ex: b.x + s.sp, ey: b.y + b.hh };
    }
    return { sx: a.x + s.sp, sy: a.y - a.hh, ex: b.x, ey: b.y + b.hh };
  }

  private flowBezierPt(s: any, t: number): { x: number; y: number } {
    const u = 1 - t;
    const e = s.st, c = s.c;
    return {
      x: u * u * u * e.sx + 3 * u * u * t * c[0].x + 3 * u * t * t * c[1].x + t * t * t * e.ex,
      y: u * u * u * e.sy + 3 * u * u * t * c[0].y + 3 * u * t * t * c[1].y + t * t * t * e.ey
    };
  }

  private flowW2(e: PointerEvent): { x: number; y: number } {
    const vp = this.flowViewportRef?.nativeElement;
    if (!vp) return { x: 0, y: 0 };
    const r = vp.getBoundingClientRect();
    return {
      x: (e.clientX - r.left - this.flowView.x) / this.flowView.k,
      y: (e.clientY - r.top - this.flowView.y) / this.flowView.k
    };
  }

  private bindFlowListeners(vp: HTMLDivElement): void {
    // Wheel zoom
    vp.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      this.flowZoomAt(
        e.clientX - r.left, e.clientY - r.top,
        Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016))
      );
    }, { passive: false });

    // FIX: never allow text selection / native drag inside the canvas
    vp.addEventListener('selectstart', (e) => e.preventDefault());
    vp.addEventListener('dragstart', (e) => e.preventDefault());

    // Pointer down
    vp.addEventListener('pointerdown', (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.flow-tools,.flow-legend')) return;
      // FIX: stops the browser starting a text selection while dragging
      e.preventDefault();
      vp.setPointerCapture(e.pointerId);
      this.flowPtrs[e.pointerId] = { x: e.clientX, y: e.clientY };

      const pts = Object.values(this.flowPtrs);
      if (pts.length === 2) {
        this.flowDrag = null;
        this.flowPinch = { d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) };
        return;
      }

      const nd = (e.target as HTMLElement).closest('.flow-node') as HTMLElement;
      const ht = (e.target as HTMLElement).closest('.flow-wire-hit') as SVGPathElement;

      if (nd) {
        this.flowDrag = { t: 'node', o: this.flowNodes[nd.dataset['id']!], lx: e.clientX, ly: e.clientY };
      } else if (ht) {
        const s = (ht as any).__seg;
        if (s) { s.pull = this.flowW2(e); this.flowDrag = { t: 'pull', s }; }
      } else {
        this.flowDrag = { t: 'pan', lx: e.clientX, ly: e.clientY };
        this.flowIsPanning = true;
      }
    });

    // Pointer move
    vp.addEventListener('pointermove', (e: PointerEvent) => {
      if (this.flowPtrs[e.pointerId]) {
        this.flowPtrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      }

      const pts = Object.values(this.flowPtrs);
      if (this.flowPinch && pts.length === 2) {
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const r = vp.getBoundingClientRect();
        this.flowZoomAt(
          (pts[0].x + pts[1].x) / 2 - r.left,
          (pts[0].y + pts[1].y) / 2 - r.top,
          d / this.flowPinch.d
        );
        this.flowPinch.d = d;
        return;
      }
      if (!this.flowDrag) return;

      if (this.flowDrag.t === 'pull') {
        this.flowDrag.s.pull = this.flowW2(e);
        return;
      }

      const dx = e.clientX - this.flowDrag.lx;
      const dy = e.clientY - this.flowDrag.ly;
      this.flowDrag.lx = e.clientX;
      this.flowDrag.ly = e.clientY;

      if (this.flowDrag.t === 'node') {
        this.flowDrag.o.x += dx / this.flowView.k;
        this.flowDrag.o.y += dy / this.flowView.k;
        this.flowDrag.o.el.style.left = this.flowDrag.o.x + 'px';
        this.flowDrag.o.el.style.top = this.flowDrag.o.y + 'px';
      } else {
        this.flowView.x += dx;
        this.flowView.y += dy;
        this.flowTouched = true;
        this.flowApplyTransform();
      }
    });

    // Pointer up
    const up = (e: PointerEvent) => {
      delete this.flowPtrs[e.pointerId];
      if (this.flowDrag && this.flowDrag.t === 'pull') this.flowDrag.s.pull = null;
      this.flowDrag = null;
      this.flowPinch = null;
      this.flowIsPanning = false;
    };
    vp.addEventListener('pointerup', up);
    vp.addEventListener('pointercancel', up);

    // Hover highlighting
    const wires = this.flowWiresRef?.nativeElement;
    if (wires) {
      vp.addEventListener('pointerover', (e: PointerEvent) => {
        if (this.flowDrag) return;
        const nd = (e.target as HTMLElement).closest('.flow-node') as HTMLElement;
        const g = (e.target as HTMLElement).closest('.flow-wire-group') as SVGGElement;

        if (nd && nd.dataset['m'] !== undefined) {
          this.flowHighlight(wires, x => x.dataset['m'] === nd.dataset['m']);
        } else if (nd && nd.dataset['o'] !== undefined) {
          this.flowHighlight(wires, x => x.dataset['o'] === nd.dataset['o']);
        } else if (nd && nd.dataset['id'] === 'hub') {
          this.flowHighlight(wires, () => true);
        } else if (g) {
          this.flowHighlight(wires, x => x === g);
        } else {
          this.flowHighlight(wires, null);
        }
      });
      vp.addEventListener('pointerleave', () => {
        if (!this.flowDrag) this.flowHighlight(wires, null);
      });
    }

    // FIX: window/document listeners are registered only once (not per viewport)
    if (!this.flowGlobalBound) {
      this.flowGlobalBound = true;
      window.addEventListener('resize', this.onFlowWindowResize);
      document.addEventListener('fullscreenchange', this.onFlowFullscreenChange);
      document.addEventListener('webkitfullscreenchange', this.onFlowFullscreenChange);
    }
  }

  private flowHighlight(wires: SVGSVGElement, fn: ((g: SVGGElement) => boolean) | null): void {
    wires.classList.toggle('highlight', !!fn);
    wires.querySelectorAll('.flow-wire-group').forEach((g: Element) => {
      (g as SVGGElement).classList.toggle('on', !!fn && fn(g as SVGGElement));
    });
  }

  private escHtml(s: string | null | undefined): string {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

