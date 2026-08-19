import { Component, computed, OnInit, signal, WritableSignal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Calendar, DayEvent } from '../../../../shared/components/inputs/calendar/calendar';
import { ChartComponent } from '../../../../shared/components/inputs/charts/charts';
import { DashboardService } from '../../service/dashboard-service';
import { Data } from '../../models/dashboardModel';
import { CustomDateSelector } from "../../../../shared/components/inputs/custom-date-selector/custom-date-selector";

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, Calendar, ChartComponent, CustomDateSelector],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent implements OnInit {
  cardData = signal<Data | null>(null);

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
    line1: '0', line2: 'Total', line3: 'Feedback'
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
    line1: '0', line2: 'Total', line3: 'Connect'
  });
  isConnectedLoading = signal(true);
  connectedHasError = signal(false);






  // Usages chart — populated dynamically from API
  usagesDonutLabels = signal<string[]>([]);
  usagesDonutData = signal<number[]>([]);
  usagesDonutColors = signal<string[]>([]);
  // Center text: show total number only (primary line). Secondary
  // lines are left empty so the chart renders a single-line total.
  usagesDonutCenterText = signal<{ line1: string; line2: string; line3: string }>({
    line1: '0', line2: 'Total', line3: 'Usages'
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
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    this.onDateApplied(todayStr, todayStr);
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
    this.router.navigate(['/implementation'], { queryParams: this.dateQueryParams() });
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
    { label: 'Excellent', range: '80-100', value: 120, pct: 47, colorClass: 'bg-emerald-500', colorHex: '#10b981' },
    { label: 'Good', range: '60-79', value: 86, pct: 34, colorClass: 'bg-teal-500', colorHex: '#14b8a6' },
    { label: 'Average', range: '40-59', value: 32, pct: 12, colorClass: 'bg-amber-400', colorHex: '#fbbf24' },
    { label: 'Poor', range: '0-39', value: 18, pct: 6, colorClass: 'bg-rose-500', colorHex: '#f43f5e' },
  ];

  readonly healthDonutGradient = computed(() => {
    let acc = 0;
    const stops = this.healthSegments.map(seg => {
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
  readonly healthDonutLabels: string[] = this.healthSegments.map(seg => seg.label);
  readonly healthDonutData: number[] = this.healthSegments.map(seg => seg.value);
  readonly healthDonutColors: string[] = this.healthSegments.map(seg => seg.colorHex);
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
    { label: 'Overdue Tasks', value: 16, pct: 92, danger: true, barClass: 'bg-rose-600' },
    { label: 'Pending Docs', value: 14, pct: 78, danger: false, barClass: 'bg-amber-500' },
    { label: 'Integrations', value: 9, pct: 52, danger: false, barClass: 'bg-purple-600' },
    { label: "Today's Meetings", value: 7, pct: 40, danger: false, barClass: 'bg-indigo-600' },
    { label: "Today's Trainings", value: 5, pct: 28, danger: false, barClass: 'bg-emerald-500' },
    { label: 'Installations', value: 3, pct: 18, danger: false, barClass: 'bg-cyan-500' },
  ];

  // Calendar Event Data — passed into <app-calendar [eventsByDay]="eventsByDay">
  readonly eventsByDay: Record<number, DayEvent[]> = {
    4: [
      this.mkEvent('Team Sync', 'Internal', '09:00 AM - 09:30 AM', '09:00 AM', 540, 570, 'bg-blue-50 text-blue-700 border border-blue-200', 'border-blue-500', '🤝'),
    ],
    7: this.buildDay7Events(),
    12: [
      this.mkEvent('Product Review', 'Internal', '11:00 AM - 12:00 PM', '11:00 AM', 660, 720, 'bg-blue-50 text-blue-700 border border-blue-200', 'border-blue-500', '📋'),
    ],
  };

  private mkEvent(
    title: string, client: string, timeLabel: string, startTime: string,
    startMinutes: number, endMinutes: number, chipClass: string, accentClass: string, icon: string
  ): DayEvent {
    return { title, client, timeLabel, startTime, startMinutes, endMinutes, chipClass, accentClass, icon };
  }

  private buildDay7Events(): DayEvent[] {
    const events: DayEvent[] = [
      this.mkEvent('Admin Training', 'ABC Ind.', '10:00 AM - 11:30 AM', '10:00 AM', 600, 690, 'bg-indigo-50 text-indigo-700 border border-indigo-200', 'border-indigo-500', '🎓'),
      this.mkEvent('Impl. Meeting', 'XYZ Ltd', '12:00 PM - 01:00 PM', '12:00 PM', 720, 780, 'bg-rose-50 text-rose-700 border border-rose-200', 'border-indigo-600', '🚀'),
      this.mkEvent('Installation', 'PQR Sol.', '02:30 PM - 04:00 PM', '02:30 PM', 870, 960, 'bg-amber-50 text-amber-700 border border-amber-200', 'border-amber-500', '🛠️'),
    ];

    const templates = [
      { title: 'Dev Sync', client: 'GlobalTech' },
      { title: 'Executive Review', client: 'Nexus Ltd' },
      { title: 'Sales Demo', client: 'Apex Systems' },
      { title: '1-on-1 Checkin', client: 'Starlight Inc' },
      { title: 'Client Onboarding', client: 'Acme Corp' },
    ];

    let hour = 9, minute = 45;
    for (let i = 0; i < 101; i++) {
      const t = templates[i % templates.length];
      const num = i + 4;
      const startMinutes = hour * 60 + minute;
      const label = this.formatClock(hour, minute);
      events.push(
        this.mkEvent(`${t.title} #${num}`, t.client, label, label, startMinutes, startMinutes + 30,
          'bg-indigo-50 text-indigo-700 border border-indigo-200', 'border-indigo-500', '📅')
      );
      minute += 15;
      if (minute >= 60) { minute -= 60; hour += 1; }
      if (hour >= 24) hour = 0;
    }
    return events;
  }

  private formatClock(hour: number, minute: number): string {
    const h12 = ((hour + 11) % 12) + 1;
    const ampm = hour < 12 ? 'AM' : 'PM';
    return `${String(h12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${ampm}`;
  }

  // ── Date filter ────────────────────────────────────────────────────────────
  onDateApplied(from: string, to: string): void {
    this.appliedFrom.set(from);
    this.appliedTo.set(to);
    console.log(from, to);



    this.dashboardService.getDashboardCards(from, to).subscribe({
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
      }
    });
    this.isFeedbackLoading.set(true);
    this.feedbackHasError.set(false);
    this.dashboardService.fetchDashBoardFeedbackChart(from, to).subscribe({
      next: (res) => {
        this.isFeedbackLoading.set(false);
        if (res && res.data && res.data.length) {
          const labels = res.data.map(item => item.label);
          const values = res.data.map(item => item.value);
          const total = values.reduce((sum, v) => sum + v, 0);
          const colors = this.generateColors(res.data.length);

          this.feedbackDonutLabels.set(labels);
          this.feedbackDonutData.set(values);
          this.feedbackDonutColors.set(colors);

          const primaryTotal = (res && res.total && (res.total.line1 ?? res.total?.line1)) ?? total ?? 0;
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
      }
    });

    this.isConnectedLoading.set(true);
    this.connectedHasError.set(false);
    this.dashboardService.fetchDashBoardConnectChart(from, to).subscribe({
      next: (res) => {
        this.isConnectedLoading.set(false);
        if (res && res.data && res.data.length) {
          const labels = res.data.map(item => item.label);
          const values = res.data.map(item => item.value);
          const total = values.reduce((sum, v) => sum + v, 0);
          const colors = this.generateColors(res.data.length);

          this.connectedDonutLabels.set(labels);
          this.connectedDonutData.set(values);
          this.connectedDonutColors.set(colors);

          const primaryTotal = (res && res.total && (res.total.line1 ?? res.total?.line1)) ?? total ?? 0;
          this.connectedDonutCenterText.set({
            line1: String(primaryTotal),
            line2: 'Total',
            line3: 'Connect',
          });
        } else {
          this.connectedDonutLabels.set([]);
          this.connectedDonutData.set([]);
          this.connectedDonutColors.set([]);
          this.connectedDonutCenterText.set({
            line1: '0',
            line2: 'Total',
            line3: 'Connect',
          });
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error fetching connect chart:', err);
        this.isConnectedLoading.set(false);
        this.connectedHasError.set(true);
        this.cdr.markForCheck();
      }
    });

    this.isUsagesLoading.set(true);
    this.usagesHasError.set(false);
    this.dashboardService.fetchDashBoardUsageChart(from, to).subscribe({
      next: (res) => {
        this.isUsagesLoading.set(false);
        if (res && res.data && res.data.length) {
          const labels = res.data.map(item => item.label);
          const values = res.data.map(item => item.value);
          const total = values.reduce((sum, v) => sum + v, 0);
          const colors = this.generateColors(res.data.length);

          this.usagesDonutLabels.set(labels);
          this.usagesDonutData.set(values);
          this.usagesDonutColors.set(colors);

          const primaryTotal = (res && res.total && (res.total.line1 ?? res.total?.line1)) ?? total ?? 0;
          this.usagesDonutCenterText.set({
            line1: String(primaryTotal),
            line2: 'Total',
            line3: 'Usages',
          });
        } else {
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
      }
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

