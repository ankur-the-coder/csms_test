import {
  Component,
  OnInit,
  signal,
  inject,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { Calendar, DayEvent } from '../../../../shared/components/inputs/calendar/calendar';
import { ChartComponent } from '../../../../shared/components/inputs/charts/charts';
import { CustomDateSelector } from '../../../../shared/components/inputs/custom-date-selector/custom-date-selector';

import { DashboardService } from '../../service/dashboard-service';
import {
  CalendarMeeting,
  Data,
} from '../../models/dashboardModel';

import { AuthService } from '../../../../core/services/auth-service';
import { Utils } from '../../../../shared/utils/utils';
import { CountUpDirective } from './count-up.directive';
import { finalize } from 'rxjs';

interface DashboardCardData {
  premiumClients: number;
  usages: number;
  meetingPending: number;
  renewable: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    Calendar,
    ChartComponent,
    CustomDateSelector,
    CountUpDirective,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly dashboardService = inject(DashboardService);
  readonly authService = inject(AuthService);

  readonly isCardsLoading = signal(true);
  readonly isCalendarLoading = signal(true);
  readonly skeletonCards = Array.from({ length: 4 });
  readonly skeletonCalendarCells = Array.from({ length: 35 });

  readonly isChartsLoading = computed(
    () => this.isUsagesLoading() || this.isFeedbackLoading(),
  );

  // ---------------------------------------------------------------------------
  // Dashboard Cards
  // ---------------------------------------------------------------------------

  readonly cardData = signal<DashboardCardData>({
    premiumClients: 0,
    usages: 0,
    meetingPending: 0,
    renewable: 0,
  });

  // ---------------------------------------------------------------------------
  // Connected Chart
  // ---------------------------------------------------------------------------

  readonly connectedDonutLabels = signal<string[]>([]);
  readonly connectedDonutData = signal<number[]>([]);
  readonly connectedDonutColors = signal<string[]>([]);

  readonly connectedDonutCenterText = signal({
    line1: '0',
    line2: 'Total',
    line3: 'Connected',
  });

  readonly isConnectedLoading = signal(true);
  readonly connectedHasError = signal(false);

  // ---------------------------------------------------------------------------
  // Usages Chart
  // ---------------------------------------------------------------------------

  readonly usagesChartLabels = signal<string[]>([]);
  readonly usagesGroupedData = signal<number[][]>([]);
  readonly usagesGroupLabels = signal([
    'Actively Usages',
    'Low Usages',
    'Non Usages',
  ]);

  readonly usagesGroupColors = signal([
    '#10B981',
    '#F59E0B',
    '#EF4444',
  ]);

  readonly isUsagesLoading = signal(true);
  readonly usagesHasError = signal(false);

  // ---------------------------------------------------------------------------
  // Feedback Chart
  // ---------------------------------------------------------------------------

  readonly feedbackDonutLabels = signal<string[]>([]);
  readonly feedbackDonutData = signal<number[]>([]);
  readonly feedbackDonutColors = signal<string[]>([]);

  readonly feedbackDonutCenterText = signal({
    line1: '0',
    line2: 'Total',
    line3: 'Feedback',
  });

  readonly isFeedbackLoading = signal(true);
  readonly feedbackHasError = signal(false);

  // ---------------------------------------------------------------------------
  // Calendar
  // ---------------------------------------------------------------------------

  readonly calendarEvents = signal<Record<string, DayEvent[]>>({});

  // ---------------------------------------------------------------------------
  // Date Filter
  // ---------------------------------------------------------------------------

  readonly appliedFrom = signal('');
  readonly appliedTo = signal('');

  private getTodayDateString(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getFirstDayOfMonthString(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  }

  private getLastDayOfMonthString(): string {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(lastDay).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  ngOnInit(): void {
    const today = new Date();
    const initialFrom = this.getFirstDayOfMonthString();
    const initialTo = this.getTodayDateString();

    this.onDateApplied(initialFrom, initialTo);
    this.fetchCalendarForMonth(today);
  }

  // ---------------------------------------------------------------------------
  // Date Filter
  // ---------------------------------------------------------------------------

  onDateApplied(from: string, to: string): void {
    this.appliedFrom.set(from);
    this.appliedTo.set(to);

    const orgId =
      this.authService.getOrgId();


    const userId =
      this.authService.getEmpId();

    this.cardData.set({
      /*
       * New API names:
       * premiumClients
       * usages
       * meetingPending
       * renewable
       *
       * Fallbacks are kept for your existing API response.
       */
      premiumClients: 0,


      usages: 0,


      meetingPending: 0,


      renewable: 0

    });
    this.fetchDashboardCards(from, to, orgId, userId);
    this.fetchFeedbackChart(from, to, orgId, userId);
    // this.fetchConnectedChart(from, to, orgId, userId);
    this.fetchUsagesChart(from, to, orgId, userId);
  }

  // ---------------------------------------------------------------------------
  // Dashboard Cards
  // ---------------------------------------------------------------------------

  private fetchDashboardCards(
    from: string,
    to: string,
    orgId: string,
    userId: string
  ): void {
    this.isCardsLoading.set(true);
    this.dashboardService
      .getDashboardCards(from, to, orgId, userId, this.authService.adminSts())
      .pipe(finalize(() => this.isCardsLoading.set(false)))
      .subscribe({
        next: (res: any) => {
          if (!res?.data) {
            return;
          }




          const data = res.data;

          this.cardData.set({
            /*
             * New API names:
             * premiumClients
             * usages
             * meetingPending
             * renewable
             *
             * Fallbacks are kept for your existing API response.
             */
            premiumClients:
              Number(
                data.premiumClients ??
                data.liveClients ??
                data.totalClients ??
                0,
              ),

            usages:
              Number(
                data.usages ??
                data.connect ??
                0,
              ),

            meetingPending:
              Number(
                data.meetingPending ??
                data.meeting ??
                data.meetingPendingCount ??
                0,
              ),

            renewable:
              Number(
                data.renewable ??
                data.renewableCount ??
                data.renewal ??
                0,
              ),
          });
        },

        error: (error) => {
          console.error(
            'Error fetching dashboard cards:',
            error,
          );
        },
      });
  }

  // ---------------------------------------------------------------------------
  // Feedback Chart
  // ---------------------------------------------------------------------------

  private fetchFeedbackChart(
    from: string,
    to: string,
    orgId: string,
    userId: string
  ): void {
    this.isFeedbackLoading.set(true);
    this.feedbackHasError.set(false);

    this.dashboardService
      .fetchDashBoardFeedbackChart(from, to, orgId, userId, this.authService.adminSts())
      .subscribe({
        next: (res: any) => {
          this.isFeedbackLoading.set(false);

          const data = Array.isArray(res?.data)
            ? res.data
            : [];

          const labels = data.map(
            (item: any) => item.label,
          );

          const values = data.map(
            (item: any) => Number(item.value) || 0,
          );

          const total = values.reduce(
            (sum: number, value: number) => sum + value,
            0,
          );

          this.feedbackDonutLabels.set(labels);
          this.feedbackDonutData.set(values);
          this.feedbackDonutColors.set(
            this.generateColors(values.length),
          );

          const apiTotal = Number(
            res?.total?.line1 ?? total,
          );

          this.feedbackDonutCenterText.set({
            line1: String(apiTotal),
            line2: 'Total',
            line3: 'Feedback',
          });
        },

        error: (error) => {
          console.error(
            'Error fetching feedback chart:',
            error,
          );

          this.isFeedbackLoading.set(false);
          this.feedbackHasError.set(true);
        },
      });
  }

  // ---------------------------------------------------------------------------
  // Connected Chart
  // ---------------------------------------------------------------------------

  private fetchConnectedChart(
    from: string,
    to: string,
    orgId: string,
    userId: string
  ): void {
    this.isConnectedLoading.set(true);
    this.connectedHasError.set(false);

    this.dashboardService
      .fetchDashBoardConnectChart(from, to, orgId, userId, this.authService.adminSts())
      .subscribe({
        next: (res: any) => {
          this.isConnectedLoading.set(false);

          const data = Array.isArray(res?.data)
            ? res.data
            : [];

          const labels = data.map(
            (item: any) => item.label,
          );

          const values = data.map(
            (item: any) => Number(item.value) || 0,
          );

          const total = values.reduce(
            (sum: number, value: number) => sum + value,
            0,
          );

          this.connectedDonutLabels.set(labels);
          this.connectedDonutData.set(values);
          this.connectedDonutColors.set(
            this.generateColors(values.length),
          );

          const apiTotal = Number(
            res?.total?.line1 ?? total,
          );

          this.connectedDonutCenterText.set({
            line1: String(apiTotal),
            line2: 'Total',
            line3: 'Connected',
          });
        },

        error: (error) => {
          console.error(
            'Error fetching connected chart:',
            error,
          );

          this.isConnectedLoading.set(false);
          this.connectedHasError.set(true);
        },
      });
  }

  // ---------------------------------------------------------------------------
  // Usages Chart
  // ---------------------------------------------------------------------------

  private fetchUsagesChart(
    from: string,
    to: string,
    orgId: string,
    userId: string
  ): void {
    this.isUsagesLoading.set(true);
    this.usagesHasError.set(false);

    this.dashboardService
      .fetchDashBoardUsageChart(from, to, orgId, userId, this.authService.adminSts())
      .subscribe({
        next: (res: any) => {
          this.isUsagesLoading.set(false);

          if (res?.modules) {
            const moduleKeys = Object.keys(
              res.modules,
            );

            this.usagesChartLabels.set(
              moduleKeys.map((key) =>
                this.formatLabel(key),
              ),
            );

            this.usagesGroupedData.set(
              moduleKeys.map((key) => {
                const module = res.modules[key];

                return [
                  Number(module?.activelyUsages) || 0,
                  Number(module?.lowuUsages) || 0,
                  Number(module?.nonUsages) || 0,
                ];
              }),
            );

            return;
          }

          // Fallback if API returns normal data array.
          if (Array.isArray(res?.data)) {
            this.usagesChartLabels.set(
              res.data.map(
                (item: any) => item.label,
              ),
            );

            this.usagesGroupedData.set(
              res.data.map((item: any) => [
                Number(item.activelyUsages) || 0,
                Number(item.lowuUsages) || 0,
                Number(item.nonUsages) || 0,
              ]),
            );

            return;
          }

          this.usagesChartLabels.set([]);
          this.usagesGroupedData.set([]);
        },

        error: (error) => {
          console.error(
            'Error fetching usages chart:',
            error,
          );

          this.isUsagesLoading.set(false);
          this.usagesHasError.set(true);
        },
      });
  }

  // ---------------------------------------------------------------------------
  // Calendar
  // ---------------------------------------------------------------------------

  onCalendarDateChange(date: Date): void {
    this.fetchCalendarForMonth(date);
  }

  onCalendarEventClick(event: DayEvent): void {
    console.log('Calendar event clicked:', event);
  }

  onCalendarViewChange(
    mode: 'day' | 'week' | 'month',
  ): void {
    console.log('Calendar view changed:', mode);
  }

  private fetchCalendarForMonth(date: Date): void {
    const year = date.getFullYear();
    const month = date.getMonth();

    const from = this.toDateString(
      new Date(year, month, 1),
    );

    const to = this.toDateString(
      new Date(year, month + 1, 0),
    );

    const rawOrgId = this.authService.getOrgId();
    const rawUserId = this.authService.getEmpId();
    const orgId =
      (rawOrgId || '101').toString();

    const empId =
      (rawUserId).toString();

    this.fetchCalendarEvents(
      from,
      to,
      orgId,
      empId
    );
  }

  private fetchCalendarEvents(
    from: string,
    to: string,
    orgId: string,
    userId: string
  ): void {
    this.isCalendarLoading.set(true);
    this.dashboardService
      .fetchDashBoardCalendar(
        from,
        to,
        orgId,
        userId
      )
      .pipe(finalize(() => this.isCalendarLoading.set(false)))
      .subscribe({
        next: (res: any) => {
          const meetings =
            this.extractMeetings(res);

          const eventMap: Record<
            string,
            DayEvent[]
          > = {};

          for (const meeting of meetings) {
            const event =
              this.createCalendarEvent(
                meeting,
              );

            if (!event) {
              continue;
            }

            if (!eventMap[event.dateKey]) {
              eventMap[event.dateKey] = [];
            }

            eventMap[event.dateKey].push(
              event.dayEvent,
            );
          }

          this.calendarEvents.set(eventMap);
        },

        error: (error) => {
          console.error(
            'Error fetching calendar data:',
            error,
          );

          this.calendarEvents.set({});
        },
      });
  }

  private extractMeetings(
    res: any,
  ): CalendarMeeting[] {
    if (Array.isArray(res?.meetings)) {
      return res.meetings;
    }

    if (Array.isArray(res?.data?.meetings)) {
      return res.data.meetings;
    }

    if (Array.isArray(res?.data)) {
      return res.data;
    }

    if (Array.isArray(res)) {
      return res;
    }

    return [];
  }


  private createCalendarEvent(
    meeting: CalendarMeeting,
  ): { dateKey: string; dayEvent: DayEvent } | null {

    const rawStart = meeting.StartTime || '';
    const rawDate =
      (meeting as any).Date ||
      (meeting as any).date ||
      (meeting as any).MeetingDate ||
      meeting.EndTime ||
      meeting.StartTime ||
      '';

    const fallbackDateKey = String(rawDate).split('T')[0].split(' ')[0].trim();

    // 1. Build UTC ISO string
    let utcStartInput = '';
    if (rawStart.includes('T') || (rawStart.includes('-') && rawStart.includes(':'))) {
      utcStartInput = rawStart;
    } else if (fallbackDateKey && rawStart) {
      utcStartInput = `${fallbackDateKey}T${rawStart}`;
    } else if (rawStart) {
      utcStartInput = rawStart;
    }

    const startIso = Utils.ensureUtcIso(utcStartInput);
    const startDate = startIso ? new Date(startIso) : null;
    const isValidStartDate = startDate !== null && !Number.isNaN(startDate.getTime());

    // 2. Date in user's local country timezone
    const dateKey = isValidStartDate
      ? this.toDateString(startDate)
      : fallbackDateKey;

    if (!dateKey) return null;

    // 3. Start time in user's local country timezone
    const startHour = isValidStartDate ? startDate.getHours() : 9;
    const startMinute = isValidStartDate ? startDate.getMinutes() : 0;
    const startMinutes = startHour * 60 + startMinute;

    // 4. Duration calculation
    const duration = meeting.Duration || '01:00:00';
    const durationParts = duration.split(':');

    const durationHours = Number(durationParts[0]) || 0;
    const durationMinutes = Number(durationParts[1]) || 0;

    const totalDuration =
      durationHours * 60 + durationMinutes || 60;

    const endMinutes = startMinutes + totalDuration;
    const endHour = Math.floor(endMinutes / 60) % 24;
    const endMinute = endMinutes % 60;

    // 5. Formatted local country time labels
    const startLabel = this.formatTime(startHour, startMinute);
    const endLabel = this.formatTime(endHour, endMinute);

    const durationLabel =
      durationHours > 0
        ? `${durationHours}h ${durationMinutes} mins`
        : `${durationMinutes || 60} mins`;

    const status = String(meeting.Status || '').toLowerCase().trim();

    const statusStyle: Record<string, {
      chipClass: string;
      accentClass: string;
    }> = {
      3: {
        chipClass: 'bg-amber-50 text-amber-700 border border-amber-200',
        accentClass: 'border-amber-500',
      },
      1: {
        chipClass: 'bg-green-50 text-green-700 border border-green-200',
        accentClass: 'border-green-500',
      },
      // cancel: {
      //   chipClass: 'bg-red-50 text-red-700 border border-red-200',
      //   accentClass: 'border-red-500',
      // },
      4: {
        chipClass: 'bg-red-50 text-red-700 border border-red-200',
        accentClass: 'border-red-500',
      },
      0: {
        chipClass: 'bg-blue-50 text-blue-700 border border-blue-200',
        accentClass: 'border-blue-500',
      },
      2: {
        chipClass: 'bg-red-50 text-red-700 border border-red-200',
        accentClass: 'border-red-500',
      },
    };

    const style = statusStyle[status] || {
      chipClass: 'bg-slate-50 text-slate-700 border border-slate-200',
      accentClass: 'border-slate-400',
    };

    const dayEvent: DayEvent = {
      title: meeting.Title || meeting.OrgName || 'Meeting',
      client: meeting.OrgName || 'Client',

      timeLabel: `${startLabel}  (${durationLabel})`,
      startTime: startLabel,
      startMinutes,
      endMinutes,

      chipClass: style.chipClass,
      accentClass: style.accentClass,

      icon: '🤝',
      purpose: meeting.Purpose,
      meetingType: meeting.MeetingType,
      duration: durationLabel,
      status: meeting.Status,
      orgId: meeting.OrgId,
    };

    return {
      dateKey,
      dayEvent,
    };
  }
  navigateToClient(): void {
    this.router.navigate(
      ['/client'],
      {
        queryParams:
          this.dateQueryParams(),
      },
    );
  }

  navigateToUsages(): void {
    this.router.navigate(
      ['/usages'],
      {
        queryParams:
          this.dateQueryParams(),
      },
    );
  }

  navigateToPendingRenewal(): void {
    this.router.navigate(
      ['/pendingrenewal'],
      {
        queryParams: {
          ...this.dateQueryParams(),
          status: 'pending',
        },
      },
    );
  }

  navigateToRenewed(): void {
    this.router.navigate(
      ['/renewal'],
      {
        queryParams: {
          ...this.dateQueryParams(),
          status: 'renewable',
        },
      },
    );
  }

  private dateQueryParams(): {
    from?: string;
    to?: string;
  } {
    const from = this.appliedFrom();
    const to = this.appliedTo();

    return from && to
      ? { from, to }
      : {};
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private toDateString(date: Date): string {
    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1,
    ).padStart(2, '0');

    const day = String(
      date.getDate(),
    ).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private formatTime(
    hour: number,
    minute: number,
  ): string {
    const hour12 =
      ((hour + 11) % 12) + 1;

    const period =
      hour < 12 ? 'AM' : 'PM';

    return `${String(hour12).padStart(
      2,
      '0',
    )}:${String(minute).padStart(
      2,
      '0',
    )} ${period}`;
  }

  private formatLabel(
    value: string,
  ): string {
    return value
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .replace(/^./, (char) =>
        char.toUpperCase(),
      )
      .trim();
  }

  private generateColors(
    count: number,
  ): string[] {
    const palette = [
      '#10B981',
      '#3B82F6',
      '#F59E0B',
      '#F43F5E',
      '#8B5CF6',
      '#06B6D4',
      '#EC4899',
      '#14B8A6',
      '#F97316',
      '#6366F1',
    ];

    return Array.from(
      { length: count },
      (_, index) =>
        palette[
        index % palette.length
        ],
    );
  }
}
