import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  OnInit,
  OnDestroy,
  signal,
  PLATFORM_ID,
} from '@angular/core';
import { Subscription, interval } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ClickOutsideDirective } from '../../shared/directives/click-outside.directive';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../core/services/auth-service';
import { MeetingService, MeetingRow } from '../../features/meetings/meetings.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, ClickOutsideDirective],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar implements OnInit, OnDestroy {

  private router = inject(Router);

  @Input() searchQuery = '';
  @Output() searchChange = new EventEmitter<string>();
  @Output() menuToggle = new EventEmitter<void>();

  showNotifications = false;
  showProfileMenu = signal(false);
  isImplementationRoute = true;
  adminName = signal<string>('');
  designation = signal<string>('');

  // Upcoming meeting notification
  upcomingMeeting = signal<MeetingRow | null>(null);
  meetingCountdown = signal<number | null>(null);
  showUpcomingMeeting = signal(false);

  private meetingTimer?: Subscription;
  private meetingRefreshTimer?: Subscription;

  private plateFormId = inject(PLATFORM_ID);

  private meetingService = inject(MeetingService);

  constructor(private authService: AuthService) {}

  /** '1' = admin/global view. Meeting notifications are for individual employees only. */
private isAdminView(): boolean {
  return localStorage.getItem('admisSts') === '1';
}

  ngOnInit() {

    if (isPlatformBrowser(this.plateFormId)) {

  this.adminName.set(
    this.authService.getUserName()
  );

  this.designation.set(
    this.authService.getDesignation()
  );

  // Meeting notifications are per-employee only — admins (admisSts === '1')
  // never see this widget, so don't even fetch or tick for it.
  if (!this.isAdminView()) {

    // Load upcoming meeting once
    this.loadUpcomingMeeting();

    // Check countdown every second.
    // This does NOT call the backend.
    this.meetingTimer = interval(1000).subscribe(() => {
      this.updateMeetingTimer();
    });

    // Refresh meeting data every 60 seconds.
    this.meetingRefreshTimer = interval(60000).subscribe(() => {
      this.loadUpcomingMeeting();
    });
  }
}

    this.checkRoute(this.router.url);

    this.router.events
      .pipe(
        filter(
          (event) =>
            event instanceof NavigationEnd
        )
      )
      .subscribe((event: any) => {
        this.checkRoute(
          event.urlAfterRedirects || event.url
        );
      });
  }

  private checkRoute(url: string) {
    this.isImplementationRoute = url.includes('implementation'); 
  }
  getFirstLetter(): string {
    const name = this.adminName().trim();
// console.log(name)

    if (!name) {
      return '';
    }

    return name.charAt(0).toUpperCase();
  }
  logOut(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  private loadUpcomingMeeting(): void {

  if (this.isAdminView()) {
    this.upcomingMeeting.set(null);
    this.showUpcomingMeeting.set(false);
    this.meetingCountdown.set(null);
    return;
  }

  this.meetingService
    .getUpcomingMeetings()
    .subscribe({

        next: (meetings) => {

          const now = Date.now();

          const eligibleMeetings = meetings
            .filter((meeting) => {

              // Scheduled = 0
              // Rescheduled = 2
              if (![0, 2].includes(Number(meeting.status))) {
  return false;
}

              if (!meeting.startTime) {
                return false;
              }

              const startTime =
                this.parseMeetingDate(
                  meeting.startTime
                ).getTime();

              if (Number.isNaN(startTime)) {
                return false;
              }

              const tenMinutes =
                10 * 60 * 1000;

              return (
                now >= startTime - tenMinutes &&
                now < startTime + tenMinutes
              );
            })
            .sort((a, b) => {

              const aTime =
                this.parseMeetingDate(
                  a.startTime!
                ).getTime();

              const bTime =
                this.parseMeetingDate(
                  b.startTime!
                ).getTime();

              return aTime - bTime;
            });

          if (eligibleMeetings.length > 0) {

            this.upcomingMeeting.set(
              eligibleMeetings[0]
            );

            this.updateMeetingTimer();

            return;
          }

          // No meeting currently inside
          // the 20-minute notification window.
          // Find the next future meeting.

          const futureMeetings = meetings
            .filter((meeting) => {

              if (![0, 2].includes(Number(meeting.status))) {
  return false;
}

              if (!meeting.startTime) {
                return false;
              }

              const startTime =
                this.parseMeetingDate(
                  meeting.startTime
                ).getTime();

              return startTime > now;
            })
            .sort((a, b) => {

              const aTime =
                this.parseMeetingDate(
                  a.startTime!
                ).getTime();

              const bTime =
                this.parseMeetingDate(
                  b.startTime!
                ).getTime();

              return aTime - bTime;
            });

          this.upcomingMeeting.set(
            futureMeetings[0] ?? null
          );

          this.updateMeetingTimer();
        },

        error: (error) => {

          console.error(
            'Failed to load upcoming meeting:',
            error
          );

          this.upcomingMeeting.set(null);
          this.showUpcomingMeeting.set(false);
          this.meetingCountdown.set(null);
        }
      });
  }

  private updateMeetingTimer(): void {

    const meeting =
      this.upcomingMeeting();

    if (!meeting?.startTime) {

      this.showUpcomingMeeting.set(false);
      this.meetingCountdown.set(null);

      return;
    }

    const startTime =
      this.parseMeetingDate(
        meeting.startTime
      ).getTime();

    const now = Date.now();

    const tenMinutes =
      10 * 60 * 1000;

    const difference =
      startTime - now;

    // More than 10 minutes before meeting

    if (difference > tenMinutes) {

      this.showUpcomingMeeting.set(false);
      this.meetingCountdown.set(null);

      return;
    }

    // 10 minutes before meeting

    if (difference > 0) {

      this.showUpcomingMeeting.set(true);

      this.meetingCountdown.set(
        Math.ceil(difference / 1000)
      );

      return;
    }

    // Meeting started.
    // Keep Join visible for 10 minutes.

    const elapsed =
      now - startTime;

    if (elapsed <= tenMinutes) {

      this.showUpcomingMeeting.set(true);

      this.meetingCountdown.set(0);

      return;
    }

    // More than 10 minutes after start.

    this.showUpcomingMeeting.set(false);
    this.meetingCountdown.set(null);
  }

  private parseMeetingDate(
    value: string
  ): Date {

    // Normalize "YYYY-MM-DD HH:mm:ss.ffffff" -> "YYYY-MM-DDTHH:mm:ss"
    const normalized =
      value
        .replace(' ', 'T')
        .split('.')[0];

    // The backend sends timestamps with no timezone marker. Without
    // one, `new Date(...)` parses the string as LOCAL time. If the
    // backend actually stores UTC (as this one does), that silently
    // shifts every meeting by your UTC offset (e.g. 5:30 hrs for IST),
    // which pushes meetings outside the 10-minute notification window
    // even when they're really about to start. Append 'Z' so it's
    // parsed as UTC instead — unless an offset is already present.
    const hasOffset =
      /Z$|[+-]\d{2}:\d{2}$/.test(normalized);

    const isoUtc = hasOffset
      ? normalized
      : `${normalized}Z`;

    return new Date(isoUtc);
  }

  formatMeetingCountdown(): string {

    const seconds =
      this.meetingCountdown();

    if (
      seconds === null ||
      seconds <= 0
    ) {
      return '00:00';
    }

    const minutes =
      Math.floor(seconds / 60);

    const remainingSeconds =
      seconds % 60;

    return (
      `${String(minutes).padStart(2, '0')}:` +
      `${String(remainingSeconds).padStart(2, '0')}`
    );
  }

  joinUpcomingMeeting(): void {

    const meeting =
      this.upcomingMeeting();

    if (!meeting?.meetingLink) {
      return;
    }

    window.open(
      meeting.meetingLink,
      '_blank'
    );
  }

  ngOnDestroy(): void {

    this.meetingTimer?.unsubscribe();

    this.meetingRefreshTimer?.unsubscribe();
  }
}