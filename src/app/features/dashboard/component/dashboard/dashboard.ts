import {
  Component,
  computed,
  OnInit,
  signal,
  WritableSignal,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Calendar, DayEvent } from '../../../../shared/components/inputs/calendar/calendar';
import { ChartComponent } from '../../../../shared/components/inputs/charts/charts';
import { DashboardService } from '../../service/dashboard-service';
import { Data, CalendarApiResponse, CalendarMeeting } from '../../models/dashboardModel';
import { CustomDateSelector } from '../../../../shared/components/inputs/custom-date-selector/custom-date-selector';
import { AuthService } from '../../../../core/services/auth-service';
import { Utils } from '../../../../shared/utils/utils';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, Calendar, ChartComponent, CustomDateSelector],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent implements OnInit {
  cardData = signal<Data | null>(null);
   readonly authService = inject(AuthService);
  // Animated (count-up) display values for the top stat cards — these start
  // at 0 and tween up to the real API value whenever cardData() updates.
  animatedTotalClients = signal(0);
  animatedLiveClients = signal(0);
  animatedImplPending = signal(0);
  animatedTrainingPending = signal(0);
  animatedMeeting = signal(0);
  connect = signal(0);
  isTrendLoading = signal(true);
  trendHasError = signal(false);

  // Feedback chart — populated dynamically from API
  feedbackDonutLabels = signal<string[]>([]);
  feedbackDonutData = signal<number[]>([]);
  feedbackDonutColors = signal<string[]>([]);
  // Center text: show total number only (primary line). Secondary
  // lines are left empty so the chart renders a single-line total.
  feedbackDonutCenterText = signal<{ line1: string; line2: string; line3: string }>({
    line1: '0',
    line2: 'Total',
    line3: 'Feedback',
  });
  isFeedbackLoading = signal(true);
  feedbackHasError = signal(false);

  // Connected chart — populated dynamically from API
  connectedDonutLabels = signal<string[]>([]);
  connectedDonutData = signal<number[]>([]);
  connectedDonutColors = signal<string[]>([]);
  // Center text: show total number only (primary line). Secondary
  // lines are left empty so the chart renders a single-line total.
  connectedDonutCenterText = signal<{ line1: string; line2: string; line3: string }>({
    line1: '0',
    line2: 'Total',
    line3: 'Connected',
  });
  isConnectedLoading = signal(true);
  connectedHasError = signal(false);

  // Usages chart — populated dynamically from API
  usagesChartLabels = signal<string[]>([]);
  usagesGroupedData = signal<number[][]>([]);
  usagesGroupLabels = signal<string[]>(['Actively Usages', 'Low Usages', 'Non Usages']);
  usagesGroupColors = signal<string[]>(['#10B981', '#F59E0B', '#EF4444']);
  usagesDonutLabels = signal<string[]>([]);
  usagesDonutData = signal<number[]>([]);
  usagesDonutColors = signal<string[]>([]);
    calendarEvents = signal<Record<string, DayEvent[]>>({});
  // Center text: show total number only (primary line). Secondary
  // lines are left empty so the chart renders a single-line total.
  usagesDonutCenterText = signal<{ line1: string; line2: string; line3: string }>({
    line1: '0',
    line2: 'Total',
    line3: 'Usages',
  });
  isUsagesLoading = signal(true);
  usagesHasError = signal(false);

  // Tracks whatever date range the user last applied on the dashboard's
  // own date picker, so a card click can carry it forward as query params.
  appliedFrom = signal('');
  appliedTo = signal('');

  constructor(
    private router: Router,
    private dashboardService: DashboardService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    this.onDateApplied(todayStr, todayStr);
    this.fetchCalendarForMonth(today);
  }

  onCalendarEventClick(event: DayEvent): void {
    console.log('[Calendar] event clicked:', event);
  }

  /**
   * Called when the user navigates to a new date/month in the calendar component.
   */
  onCalendarDateChange(date: Date): void {
    this.fetchCalendarForMonth(date);
  }

  /**
   * Fetches meetings for the entire month containing `date`.
   */
  fetchCalendarForMonth(date: Date): void {
    const year  = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    const from  = this.toDateStr(new Date(year, month, 1));
    const to    = this.toDateStr(new Date(year, month + 1, 0)); // last day of month
    const rawOrg = this.authService.getOrgId();
    const orgId = Utils.encode5t((rawOrg || '101').toString());
    console.log('[Calendar] fetchCalendarForMonth:', from, '->', to, 'orgId:', orgId);
    this.fetchCalendarEvents(from, to, orgId);
  }
  // fetchDashboardCards(): void {
  //   this.dashboardService.getDashboardCards().subscribe({
  //     next: (res) => {
  //       if (res && res.data) {
  //         this.cardData.set(res.data);
  //         this.cdr.markForCheck();
  //         this.cdr.detectChanges();

  //         this.animateCount(this.animatedTotalClients, res.data.totalClients);
  //         this.animateCount(this.animatedLiveClients, res.data.liveClients);
  //         this.animateCount(this.animatedImplPending, res.data.implPending);
  //         this.animateCount(this.animatedTrainingPending, res.data.trainingPending);
  //         this.animateCount(this.animatedMeeting, res.data.meeting);
  //       }
  //     },
  //     error: (err) => {
  //       console.error('Error fetching dashboard cards:', err);
  //     }
  //   });
  // }

  /** Tweens a signal from its current value up (or down) to `target` over `duration`ms. */
  private animateCount(target$: WritableSignal<number>, target: number, duration = 900): void {
    if (typeof window === 'undefined') {
      // SSR — no requestAnimationFrame available, just set the final value.
      target$.set(target);
      return;
    }

    const start = target$();
    if (start === target) return;

    const startTime = performance.now();
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      target$.set(Math.round(start + (target - start) * eased));

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        target$.set(target);
      }
    };

    requestAnimationFrame(step);
  }

  navigateToClient() {
    // this.router.navigate(['/client']);
    this.router.navigate(['/client'], { queryParams: this.dateQueryParams() });
  }

  navigateToImplementation() {
    // this.router.navigate(['/implementation']);
    this.router.navigate(['/implementation'], {
      queryParams: { ...this.dateQueryParams(), tab: 'in_progress' },
    });
  }

  navigateToTraining() {
    this.router.navigate(['/training']);
  }

  navigateToMeetings() {
    this.router.navigate(['/meetings']);
  }

  // ---------------------------------------------------------------------
  // Health Score Distribution donut data
  // ---------------------------------------------------------------------

  readonly healthSegments = [
    {
      label: 'Excellent',
      range: '80-100',
      value: 120,
      pct: 47,
      colorClass: 'bg-emerald-500',
      colorHex: '#10b981',
    },
    {
      label: 'Good',
      range: '60-79',
      value: 86,
      pct: 34,
      colorClass: 'bg-teal-500',
      colorHex: '#14b8a6',
    },
    {
      label: 'Average',
      range: '40-59',
      value: 32,
      pct: 12,
      colorClass: 'bg-amber-400',
      colorHex: '#fbbf24',
    },
    {
      label: 'Poor',
      range: '0-39',
      value: 18,
      pct: 6,
      colorClass: 'bg-rose-500',
      colorHex: '#f43f5e',
    },
  ];

  readonly healthDonutGradient = computed(() => {
    let acc = 0;
    const stops = this.healthSegments.map((seg) => {
      const start = acc;
      acc += seg.pct;
      return `${seg.colorHex} ${start}% ${acc}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  });

  // ---------------------------------------------------------------------
  // Data shaped specifically for <app-charts> (ChartComponent).
  // ChartComponent's real inputs are: chartType, chartData, chartLabels,
  // backgroundColors, headingText, hoverLabel, donutCenterText, chartId,
  // xAxisTitle, yAxisTitle, leaveChart — NOT `type`/`title`/`totalLabel`.
  // ---------------------------------------------------------------------

  // Donut chart — reuse the same healthSegments used for the custom widget above.
  readonly healthDonutLabels: string[] = this.healthSegments.map((seg) => seg.label);
  readonly healthDonutData: number[] = this.healthSegments.map((seg) => seg.value);
  readonly healthDonutColors: string[] = this.healthSegments.map((seg) => seg.colorHex);
  readonly healthDonutTotal: number = this.healthSegments.reduce((sum, seg) => sum + seg.value, 0);
  readonly healthDonutCenterText = {
    line1: String(this.healthDonutTotal),
    line2: 'Total',
    line3: 'Clients',
  };

  // Client Health Score Trend (line chart).
  // TODO: replace with real data from DashboardService once a trend
  // endpoint is available — using representative placeholder values for now.
  readonly ImplementationLabels: string[] = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  readonly ImplementationData: number[] = [62, 65, 68, 71, 74, 78];

  // Daily Tasks & Operations
  readonly dailyOps = [
    // { label: 'Overdue Tasks', value: 16, pct: 92, danger: true, barClass: 'bg-rose-600' },
    // { label: 'Pending Docs', value: 14, pct: 78, danger: false, barClass: 'bg-amber-500' },
    // { label: 'Integrations', value: 9, pct: 52, danger: false, barClass: 'bg-purple-600' },
    { label: "Today's Meetings", value: 7, pct: 80, danger: false, barClass: 'bg-indigo-600' },
    { label: "Today's Trainings", value: 5, pct: 68, danger: false, barClass: 'bg-emerald-500' },
    { label: "Today's Implementations", value: 3, pct: 48, danger: false, barClass: 'bg-cyan-500' },
  ];

  // Calendar Event Data — passed into <app-calendar [eventsByDay]="eventsByDay">
  readonly eventsByDay: Record<number, DayEvent[]> = {
    4: [
      this.mkEvent(
        'Team Sync',
        'Internal',
        '09:00 AM - 09:30 AM',
        '09:00 AM',
        540,
        570,
        'bg-blue-50 text-blue-700 border border-blue-200',
        'border-blue-500',
        '🤝',
      ),
    ],
    7: this.buildDay7Events(),
    12: [
      this.mkEvent(
        'Product Review',
        'Internal',
        '11:00 AM - 12:00 PM',
        '11:00 AM',
        660,
        720,
        'bg-blue-50 text-blue-700 border border-blue-200',
        'border-blue-500',
        '📋',
      ),
    ],
  };

  private mkEvent(
    title: string,
    client: string,
    timeLabel: string,
    startTime: string,
    startMinutes: number,
    endMinutes: number,
    chipClass: string,
    accentClass: string,
    icon: string,
  ): DayEvent {
    return {
      title,
      client,
      timeLabel,
      startTime,
      startMinutes,
      endMinutes,
      chipClass,
      accentClass,
      icon,
    };
  }

  private buildDay7Events(): DayEvent[] {
    const events: DayEvent[] = [
      this.mkEvent(
        'Admin Training',
        'ABC Ind.',
        '10:00 AM - 11:30 AM',
        '10:00 AM',
        600,
        690,
        'bg-indigo-50 text-indigo-700 border border-indigo-200',
        'border-indigo-500',
        '🎓',
      ),
      this.mkEvent(
        'Impl. Meeting',
        'XYZ Ltd',
        '12:00 PM - 01:00 PM',
        '12:00 PM',
        720,
        780,
        'bg-rose-50 text-rose-700 border border-rose-200',
        'border-indigo-600',
        '🚀',
      ),
      this.mkEvent(
        'Installation',
        'PQR Sol.',
        '02:30 PM - 04:00 PM',
        '02:30 PM',
        870,
        960,
        'bg-amber-50 text-amber-700 border border-amber-200',
        'border-amber-500',
        '🛠️',
      ),
    ];

    const templates = [
      { title: 'Dev Sync', client: 'GlobalTech' },
      { title: 'Executive Review', client: 'Nexus Ltd' },
      { title: 'Sales Demo', client: 'Apex Systems' },
      { title: '1-on-1 Checkin', client: 'Starlight Inc' },
      { title: 'Client Onboarding', client: 'Acme Corp' },
    ];

    let hour = 9,
      minute = 45;
    for (let i = 0; i < 101; i++) {
      const t = templates[i % templates.length];
      const num = i + 4;
      const startMinutes = hour * 60 + minute;
      const label = this.formatClock(hour, minute);
      events.push(
        this.mkEvent(
          `${t.title} #${num}`,
          t.client,
          label,
          label,
          startMinutes,
          startMinutes + 30,
          'bg-indigo-50 text-indigo-700 border border-indigo-200',
          'border-indigo-500',
          '📅',
        ),
      );
      minute += 15;
      if (minute >= 60) {
        minute -= 60;
        hour += 1;
      }
      if (hour >= 24) hour = 0;
    }
    return events;
  }

  private formatClock(hour: number, minute: number): string {
    const h12 = ((hour + 11) % 12) + 1;
    const ampm = hour < 12 ? 'AM' : 'PM';
    return `${String(h12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${ampm}`;
  }

    onCalendarViewChange(mode: 'day' | 'week' | 'month'): void {
    // TODO: re-fetch events scoped to the new view range if required
    console.log('[Calendar] view changed:', mode);
  }

  // ── Date filter ────────────────────────────────────────────────────────────
  onDateApplied(from: string, to: string): void {
    this.appliedFrom.set(from);
    this.appliedTo.set(to);
    console.log(from, to);

    let orgId = Utils.encode5t(this.authService.getOrgId().toString());
    this.dashboardService.getDashboardCards(from, to, orgId).subscribe({
      next: (res) => {
        if (res && res.data) {
          this.cardData.set(res.data);
          this.cdr.markForCheck();
          this.cdr.detectChanges();

          this.animateCount(this.animatedTotalClients, res.data.totalClients);
          this.animateCount(this.animatedLiveClients, res.data.liveClients);
          this.animateCount(this.animatedImplPending, res.data.implPending);
          this.animateCount(this.animatedTrainingPending, res.data.trainingPending);
          this.animateCount(this.animatedMeeting, res.data.meeting);
          this.animateCount(this.connect, res.data.connect);
        }
      },
      error: (err) => {
        console.error('Error fetching dashboard cards:', err);
      },
    });
    this.isFeedbackLoading.set(true);
    this.feedbackHasError.set(false);
    this.dashboardService.fetchDashBoardFeedbackChart(from, to, orgId).subscribe({
      next: (res) => {
        this.isFeedbackLoading.set(false);
        if (res && res.data && res.data.length) {
          const labels = res.data.map((item) => item.label);
          const values = res.data.map((item) => item.value);
          const total = values.reduce((sum, v) => sum + v, 0);
          const colors = this.generateColors(res.data.length);

          this.feedbackDonutLabels.set(labels);
          this.feedbackDonutData.set(values);
          this.feedbackDonutColors.set(colors);

          const primaryTotal =
            (res && res.total && (res.total.line1 ?? res.total?.line1)) ?? total ?? 0;
          this.feedbackDonutCenterText.set({
            line1: String(primaryTotal),
            line2: 'Total',
            line3: 'Feedback',
          });
        } else {
          this.feedbackDonutLabels.set([]);
          this.feedbackDonutData.set([]);
          this.feedbackDonutColors.set([]);
          this.feedbackDonutCenterText.set({
            line1: '0',
            line2: 'Total',
            line3: 'Feedback',
          });
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error fetching feedback chart:', err);
        this.isFeedbackLoading.set(false);
        this.feedbackHasError.set(true);
        this.cdr.markForCheck();
      },
    });

    this.isConnectedLoading.set(true);
    this.connectedHasError.set(false);
    this.dashboardService.fetchDashBoardConnectChart(from, to, orgId).subscribe({
      next: (res) => {
        this.isConnectedLoading.set(false);
        if (res && res.data && res.data.length) {
          const labels = res.data.map((item) => item.label);
          const values = res.data.map((item) => item.value);
          const total = values.reduce((sum, v) => sum + v, 0);
          const colors = this.generateColors(res.data.length);

          this.connectedDonutLabels.set(labels);
          this.connectedDonutData.set(values);
          this.connectedDonutColors.set(colors);

          const primaryTotal =
            (res && res.total && (res.total.line1 ?? res.total?.line1)) ?? total ?? 0;
          this.connectedDonutCenterText.set({
            line1: String(primaryTotal),
            line2: 'Total',
            line3: 'Connected',
          });
        } else {
          this.connectedDonutLabels.set([]);
          this.connectedDonutData.set([]);
          this.connectedDonutColors.set([]);
          this.connectedDonutCenterText.set({
            line1: '0',
            line2: 'Total',
            line3: 'Connected',
          });
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error fetching connect chart:', err);
        this.isConnectedLoading.set(false);
        this.connectedHasError.set(true);
        this.cdr.markForCheck();
      },
    });

    this.isUsagesLoading.set(true);
    this.usagesHasError.set(false);
    this.dashboardService.fetchDashBoardUsageChart(from, to, orgId).subscribe({
      next: (res: any) => {
        this.isUsagesLoading.set(false);
        if (res && res.modules) {
          const modulesObj = res.modules;
          const moduleKeys = Object.keys(modulesObj);
          const labels = moduleKeys.map((key) => key.charAt(0).toUpperCase() + key.slice(1));
          const groupedData = moduleKeys.map((key) => {
            const mod = modulesObj[key];
            return [mod.activelyUsages || 0, mod.lowuUsages || 0, mod.nonUsages || 0];
          });

          this.usagesChartLabels.set(labels);
          this.usagesGroupedData.set(groupedData);
          this.usagesGroupLabels.set(['Actively Usages', 'Low Usages', 'Non Usages']);
        } else if (res && res.data && res.data.length) {
          const labels = res.data.map((item: any) => item.label);
          const values = res.data.map((item: any) => item.value);
          const total = values.reduce((sum: number, v: number) => sum + v, 0);
          const colors = this.generateColors(res.data.length);

          this.usagesDonutLabels.set(labels);
          this.usagesDonutData.set(values);
          this.usagesDonutColors.set(colors);

          const primaryTotal =
            (res && res.total && (res.total.line1 ?? res.total?.line1)) ?? total ?? 0;
          this.usagesDonutCenterText.set({
            line1: String(primaryTotal),
            line2: 'Total',
            line3: 'Usages',
          });
        } else {
          this.usagesChartLabels.set([]);
          this.usagesGroupedData.set([]);
          this.usagesDonutLabels.set([]);
          this.usagesDonutData.set([]);
          this.usagesDonutColors.set([]);
          this.usagesDonutCenterText.set({
            line1: '0',
            line2: 'Total',
            line3: 'Usages',
          });
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error fetching usages chart:', err);
        this.isUsagesLoading.set(false);
        this.usagesHasError.set(true);
        this.cdr.markForCheck();
      },
    });


  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Format a Date as "YYYY-MM-DD". */
  private toDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /**
   * Fetch calendar meetings for [from, to] and update the calendarEvents signal.
   * Handles responses shaped as: { meetings: [...] }, { data: { meetings: [...] } },
   * { data: [...] }, or a flat array.
   */
  private fetchCalendarEvents(from: string, to: string, orgId: string): void {
    this.dashboardService.fetchDashBoardCalendar(from, to, orgId).subscribe({
      next: (res: any) => {
        console.log('[Calendar] API response:', res);

        let meetings: CalendarMeeting[] = [];
        if (Array.isArray(res?.meetings)) {
          meetings = res.meetings;
        } else if (Array.isArray(res?.data?.meetings)) {
          meetings = res.data.meetings;
        } else if (Array.isArray(res?.data)) {
          meetings = res.data;
        } else if (Array.isArray(res)) {
          meetings = res;
        }

        console.log('[Calendar] Extracted meetings count:', meetings.length);

        const eventMap: Record<string, DayEvent[]> = {};

        for (const m of meetings) {
          // Date: EndTime or Date or StartTime date component
          let rawDate = m.EndTime || (m as any).Date || (m as any).date || (m as any).MeetingDate || '';
          if (!rawDate && m.StartTime && m.StartTime.includes('-')) {
            rawDate = m.StartTime;
          }
          const dateKey = String(rawDate).split('T')[0].split(' ')[0].trim();
          if (!dateKey) continue;

          // Start Time
          const startRaw = m.StartTime || '09:00';
          const startParts = startRaw.split(':').map(Number);
          const startH = isNaN(startParts[0]) ? 9 : startParts[0];
          const startM = isNaN(startParts[1]) ? 0 : startParts[1];
          const startMinutes = startH * 60 + startM;

          // Duration
          const durationRaw = m.Duration || '01:00:00';
          const dParts = durationRaw.split(':');
          const dHours = parseInt(dParts[0], 10) || 0;
          const dMins = parseInt(dParts[1], 10) || 0;
          const durationMins = dHours * 60 + dMins || 60;
          const endMinutes = startMinutes + durationMins;

          const endH = Math.floor(endMinutes / 60) % 24;
          const endM = endMinutes % 60;

          const fmt = (h: number, mi: number) => {
            const h12 = ((h + 11) % 12) + 1;
            const ampm = h < 12 ? 'AM' : 'PM';
            return `${String(h12).padStart(2, '0')}:${String(mi).padStart(2, '0')} ${ampm}`;
          };

          const startLabel = fmt(startH, startM);
          const endLabel   = fmt(endH, endM);

          const durationDisplay = dHours > 0 ? `${dHours}h ${dMins}m` : `${dMins || 60}m`;

          const event: DayEvent = {
            title:        m.Title || m.OrgName || 'Meeting',
            client:       m.OrgName || 'Client',
            timeLabel:    `${startLabel} - ${endLabel}`,
            startTime:    startLabel,
            startMinutes,
            endMinutes,
            chipClass:    'bg-blue-50 text-blue-700 border border-blue-200',
            accentClass:  'border-blue-500',
            icon:         '🤝',
            purpose:      m.Purpose,
            meetingType:  m.MeetingType,
            duration:     durationDisplay,
            status:       m.Status,
            orgId:        m.OrgId,
          };

          if (!eventMap[dateKey]) eventMap[dateKey] = [];
          eventMap[dateKey].push(event);
        }

        console.log('[Calendar] Processed eventMap keys:', Object.keys(eventMap));
        this.calendarEvents.set({ ...eventMap });
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('[Calendar] Error fetching calendar data:', err);
      },
    });
  }

  private dateQueryParams() {
    return this.appliedFrom() && this.appliedTo()
      ? { from: this.appliedFrom(), to: this.appliedTo() }
      : {};
  }

  /** Returns a palette of hex colors for `count` slices. */
  private generateColors(count: number): string[] {
    const palette = [
      '#10b981', // emerald
      '#3b82f6', // blue
      '#f59e0b', // amber
      '#f43f5e', // rose
      '#8b5cf6', // violet
      '#06b6d4', // cyan
      '#ec4899', // pink
      '#14b8a6', // teal
      '#f97316', // orange
      '#6366f1', // indigo
    ];
    return Array.from({ length: count }, (_, i) => palette[i % palette.length]);
  }
}
