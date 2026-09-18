import {
  Component,
  OnInit,
  signal,
  inject,
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
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly dashboardService = inject(DashboardService);
  readonly authService = inject(AuthService);

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

  ngOnInit(): void {
    const today = new Date();

    const todayString = this.toDateString(today);

    this.onDateApplied(todayString, todayString);
    this.fetchCalendarForMonth(today);
  }

  // ---------------------------------------------------------------------------
  // Date Filter
  // ---------------------------------------------------------------------------

  onDateApplied(from: string, to: string): void {
    this.appliedFrom.set(from);
    this.appliedTo.set(to);

    const orgId = Utils.encode5t(
      this.authService.getOrgId().toString(),
    );

    const userId = Utils.encode5t(
      this.authService.getEmpId().toString(),
    );

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
    this.dashboardService
      .getDashboardCards(from, to, orgId, userId)
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
      .fetchDashBoardFeedbackChart(from, to, orgId, userId)
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
      .fetchDashBoardConnectChart(from, to, orgId, userId)
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
      .fetchDashBoardUsageChart(from, to, orgId, userId)
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
    const orgId = Utils.encode5t(
      (rawOrgId || '101').toString(),
    );
    const empId = Utils.encode5t(
      (rawUserId).toString(),
    );
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
    this.dashboardService
      .fetchDashBoardCalendar(
        from,
        to,
        orgId,
        userId
      )
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
  ): {
    dateKey: string;
    dayEvent: DayEvent;
  } | null {
    const rawDate =
      meeting.EndTime ||
      (meeting as any).Date ||
      (meeting as any).date ||
      (meeting as any).MeetingDate ||
      meeting.StartTime ||
      '';

    const dateKey = String(rawDate)
      .split('T')[0]
      .split(' ')[0]
      .trim();

    if (!dateKey) {
      return null;
    }

    const startTime =
      meeting.StartTime || '09:00';

    const startParts = startTime
      .split(':')
      .map(Number);

    const startHour = Number.isNaN(
      startParts[0],
    )
      ? 9
      : startParts[0];

    const startMinute = Number.isNaN(
      startParts[1],
    )
      ? 0
      : startParts[1];

    const startMinutes =
      startHour * 60 + startMinute;

    const duration =
      meeting.Duration || '01:00:00';

    const durationParts =
      duration.split(':');

    const durationHours =
      Number(durationParts[0]) || 0;

    const durationMinutes =
      Number(durationParts[1]) || 0;

    const totalDuration =
      durationHours * 60 +
      durationMinutes ||
      60;

    const endMinutes =
      startMinutes + totalDuration;

    const endHour =
      Math.floor(endMinutes / 60) % 24;

    const endMinute =
      endMinutes % 60;

    const startLabel =
      this.formatTime(
        startHour,
        startMinute,
      );

    const endLabel =
      this.formatTime(
        endHour,
        endMinute,
      );

    const durationLabel =
      durationHours > 0
        ? `${durationHours}h ${durationMinutes}m`
        : `${durationMinutes || 60}m`;

    const dayEvent: DayEvent = {
      title:
        meeting.Title ||
        meeting.OrgName ||
        'Meeting',

      client:
        meeting.OrgName ||
        'Client',

      timeLabel:
        `${startLabel} - ${endLabel}`,

      startTime: startLabel,

      startMinutes,

      endMinutes,

      chipClass:
        'bg-blue-50 text-blue-700 border border-blue-200',

      accentClass:
        'border-blue-500',

      icon: '🤝',

      purpose: meeting.Purpose,

      meetingType:
        meeting.MeetingType,

      duration: durationLabel,

      status: meeting.Status,

      orgId: meeting.OrgId,
    };

    return {
      dateKey,
      dayEvent,
    };
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

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

  navigateToPendingMeetings(): void {
    this.router.navigate(
      ['/meetings'],
      {
        queryParams: {
          ...this.dateQueryParams(),
          status: 'pending',
        },
      },
    );
  }

  navigateToRenewable(): void {
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
