import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Organization {
  orgId: number;
  name: string;
}

export interface InviteAttendeesResponse {
  status: boolean;
  message: string;
  meetingId: number;
  addedEmails: string[];
  totalAttendees: number;
}

export interface MeetingRow {
  id: number;
  orgId: number | string | null;
  orgName: string;
  empId: number | string;
  organizerName?: string;
  priority: number;
  purpose: string;
  title: string;
  meetingType: string;
  startTime: string | null;
  endTime: string | null;
  duration: string;
  clientMail: string;
  meetingLink: string;
  webLink: string;
  status: number;
  eventId: string;
  onlineMeetingId: string | null;
  createdById: number | string;
  createdDate: string;
  lastModifiedById: number | string;
  lastModifiedDate: string;
}

export interface FetchMeetingsPayload {
  start: number;
  length: number;
  search: string;
  sorting: string;
  filter: string;
  fromDate: string;
  toDate: string;
  userId?: number | string;
}

export interface FetchMeetingsResponse {
  status: boolean;
  data: MeetingRow[];
  meta: { total: number; first_page: number };
}

/** Response of GET /meetings/dashboard-stats — all the KPI card numbers. */
export interface DashboardStats {
  todayMeetings: number;
  upcoming7Days: number;
  completedThisMonth: number;
  followUpsPending: number;
  thisWeekMeetings: number;
  overdueCount: number;
  completionRate: number;
  totalMeetings: number;
}

interface DashboardStatsApiResponse {
  status: boolean;
  data: DashboardStats;
}

/** One entry from GET /meetings/recent-activity — powers the dashboard's "Recent Activity" panel. */
export interface RecentActivity {
  id: number;
  meetingId: number;
  action: string;
  title: string;
  time: string;
  user: string;
}

interface RecentActivityApiResponse {
  status: boolean;
  data: RecentActivity[];
}

/** One attendee/host entry from a checked meeting's attendance report. */
export interface AttendanceRecord {
  name: string;
  email: string | null;
  role: string;
  joinTime: string | null;
  leaveTime: string | null;
  totalDurationSeconds: number;
}

/** Response of POST /meetings/check-attendance. */
export interface AttendanceCheckResponse {
  status: boolean;
  meetingId: number;
  hostName?: string | null;
  wasHeld: boolean;
  meetingStart: string | null;
  meetingEnd: string | null;
  totalDurationMinutes: number | null;
  attendeeCount: number;
  attendees: AttendanceRecord[];
}

interface DataTablePayload {
  start: number;
  length: number;
  search: string;
  sorting: string;
  filter: string;
}

interface DataTableApiResponse {
  status: boolean;
  data: { orgId: number; organization: string; [key: string]: any }[];
  meta: { total: number; first_page: number };
}

export interface RescheduleMeetingResponse {
  status: boolean;
  message: string;
  meetingId: number;
  eventId?: string;
  meetingLink?: string;
  start?: string;
  end?: string;
  duration?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MeetingService {
  // API base URL now comes from environment config instead of being
  // hardcoded, so it works outside your local machine (staging, prod,
  // a teammate's machine, etc). Set `apiUrl` in
  // src/environments/environment.ts (dev) and environment.prod.ts (prod).
  private readonly imp = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Orgs for the "Schedule Meeting" dropdown.
   */
  getOrganizations(): Observable<Organization[]> {
    const payload: DataTablePayload = {
      start: 0,
      length: 10,
      search: '',
      sorting: '',
      filter: ''
    };

    return this.http.post<DataTableApiResponse>(`${this.imp}/meetings/fetchOrganizations`, payload).pipe(
      map(res => (res.data || []).map(row => ({
        orgId: row.orgId,
        name: row.organization
      })))
    );
  }

  getLeadOwners(): Observable<string[]> {
    return this.http.post<{status: boolean, data: {name: string}[]}>(`${this.imp}/meetings/fetchLeadOwners`, {}).pipe(
      map(res => (res.data || []).map(row => row.name))
    );
  }

  getSupportOwners(): Observable<string[]> {
    return this.http.post<{status: boolean, data: {name: string}[]}>(`${this.imp}/meetings/fetchSupportOwners`, {}).pipe(
      map(res => (res.data || []).map(row => row.name))
    );
  }

  fetchMeetings(payload: FetchMeetingsPayload): Observable<FetchMeetingsResponse> {
    return this.http.post<FetchMeetingsResponse>(`${this.imp}/meetings/fetchMeetings`, payload);
  }

  /**
   * Asks the backend to check (live, against Microsoft Graph) whether a
   * meeting actually happened — who joined, their role, how long they
   * stayed, and the meeting's real duration. Not cached: each call re-checks
   * against Microsoft, since attendance can only be known after the fact
   * and may not exist yet if the meeting hasn't finished/report hasn't
   * generated.
   */
  checkAttendance(meetingId: number,hostmail:string): Observable<AttendanceCheckResponse> {
    return this.http.post<AttendanceCheckResponse>(`${this.imp}/meetings/check-attendance`, { meetingId,hostmail });
  }

  /**
   * Cancels a meeting via Microsoft Graph (notifies attendees) and marks
   * it Cancelled in MeetingTable. Backend rejects this if the meeting is
   * already Cancelled or Completed — that error message passes through
   * as-is for the component to show.
   */
  cancelMeeting(meetingId: number, hostmail:string): Observable<{ status: boolean; message: string; meetingId: number }> {
    return this.http.post<{ status: boolean; message: string; meetingId: number }>(
      `${this.imp}/meetings/cancel`,
      { meetingId, hostmail }
    );
  }


  getUpcomingMeetings(): Observable<MeetingRow[]> {
  const rawEmpId = localStorage.getItem('empId');
  const filters: Record<string, any> = {};


  return this.http
    .post<FetchMeetingsResponse>(
      `${this.imp}/meetings/fetchMeetings`,
      {
        start: 0,
        length: 50,
        search: '',
        sorting: 'startTime,asc',
        filter: JSON.stringify(filters),
        fromDate: '',
        toDate: ''
      }
    )
    .pipe(
      map(res => res.data || [])
    );
}

  /**
   * The 4 dashboard KPI card counts (today / upcoming 7 days / completed
   * this month / follow-ups pending). Not cached — always fetch fresh.
   */
  getDashboardStats(userId?: number | string): Observable<DashboardStats> {
    const query = userId ? `?userId=${userId}` : '';
    return this.http
      .get<DashboardStatsApiResponse>(`${this.imp}/meetings/dashboard-stats${query}`)
      .pipe(map(res => res.data));
  }

  /**
   * Recent activity feed for the dashboard's "Recent Activity" panel.
   * Not cached — always fetch fresh.
   */
  getRecentActivity(userId?: number | string): Observable<RecentActivity[]> {
  const query = userId ? `?userId=${userId}` : '';
  return this.http
    .get<RecentActivityApiResponse>(`${this.imp}/meetings/recent-activity${query}`)
    .pipe(map(res => res.data || []));
}

  rescheduleMeeting(
  meetingId: number,
  hostmail:string,
  start: string,
  end: string
): Observable<RescheduleMeetingResponse> {

  return this.http.post<RescheduleMeetingResponse>(
    `${this.imp}/meetings/reschedule`,
    {
      meetingId,
      hostmail,
      start,
      end
    }
  );
}

// inside MeetingService class:
inviteAttendees(meetingId: number, emails: string[], hostmail:string): Observable<InviteAttendeesResponse> {
  return this.http.post<InviteAttendeesResponse>(`${this.imp}/meetings/invite`, {
    meetingId,
    emails,
    hostmail
  });
}

}