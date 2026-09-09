import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, shareReplay } from 'rxjs/operators';

export interface BookedMeeting {
  id: number;
  title: string;
  startTime: string;   // ISO  e.g. "2026-08-29T06:30:00.000Z"
  endTime: string;     // ISO  e.g. "2026-08-29T07:30:00.000Z"
}

export interface Organization {
  orgId: number;
  name: string;
  email: string;
}

export interface OwnerOption {
  id: string;
  name: string;
  email: string;
}

/** Response of POST /meetings/employee-details — the logged-in user, used as the meeting host. */
export interface EmployeeDetails {
  currentMail: string;
  companyId: string;
  name: string;
}

interface EmployeeDetailsApiResponse {
  status: boolean;
  data: EmployeeDetails;
}

interface DataTablePayload {
  start: number;
  length: number;
  search: string;
  sorting: string;
  filter: string;
}

interface OrgApiRow {
  orgId: number;
  organization: string;
  email?: string;
  Email?: string;
  contactEmail?: string;
  [key: string]: any;
}

interface DataTableApiResponse {
  status: boolean;
  data: OrgApiRow[];
  meta: { total: number; first_page: number };
}

interface OwnerApiRow {
  id: number | string;
  name: string;
  email?: string;
  Email?: string;
  mail?: string;
  [key: string]: any;
}

interface OwnerApiResponse {
  status: boolean;
  msg?: string;
  data: OwnerApiRow[];
}

export interface CreateTeamsMeetingRequest {

  hostEmail: string;

  clientEmails: string[];

  title: string;

  purpose: string;

  start: string;

  end: string;

  // --- additional fields ---
  meetingType?: string;

  duration?: string;

  // Backend validator expects a number: 0 = Low, 1 = Medium, 2 = High.
  priority?: number;

  // NOTE: must be named orgId/orgName — MeetingsService.createMeeting()
  // reads data.orgId / data.orgName directly. Using
  // organizationId/organizationName here means the backend never
  // receives them.
  orgId?: number | null;

  orgName?: string;

  hostId?: string;

  hostName?: string;

}

export interface CreateTeamsMeetingResponse {

  status: boolean;

  meetingLink: string;

  meetingId: string;

  eventId: string;

  webLink: string;

}

export interface MeetingType {
  id: number;
  name: string;
}

interface MeetingTypeApiResponse {
  status: boolean;
  data: MeetingType[];
}

@Injectable({
  providedIn: 'root'
})
export class ScheduleMeetingService {
  private readonly baseUrl = 'http://127.0.0.1:5000';

  private organizations$?: Observable<Organization[]>;
  private leadOwners$?: Observable<OwnerOption[]>;
  private supportOwners$?: Observable<OwnerOption[]>;

  constructor(private http: HttpClient) {}

  getOrganizations(): Observable<Organization[]> {
    if (!this.organizations$) {
      const payload: DataTablePayload = { start: 0, length: 10, search: '', sorting: '', filter: '' };

      this.organizations$ = this.http
        .post<DataTableApiResponse>(`${this.baseUrl}/meetings/fetchOrganizations`, payload)
        .pipe(
          map(res => (res.data || []).map(row => ({
            orgId: row.orgId,
            name: row.organization,
            email: row.email ?? row.Email ?? row.contactEmail ?? ''
          }))),
          catchError(() => of([])),
          shareReplay(1)
        );
    }
    return this.organizations$;
  }

  getLeadOwners(): Observable<OwnerOption[]> {
    if (!this.leadOwners$) {
      this.leadOwners$ = this.http
        .get<OwnerApiResponse>(`${this.baseUrl}/fetchLeadOwner`)
        .pipe(
          map((res) => (res?.data || []).map((u) => ({
            id: String(u.id),
            name: u.name,
            email: u.email ?? u.Email ?? u.mail ?? ''
          }))),
          catchError(() => of([])),
          shareReplay(1)
        );
    }
    return this.leadOwners$;
  }

  getSupportOwners(): Observable<OwnerOption[]> {
    if (!this.supportOwners$) {
      this.supportOwners$ = this.http
        .get<OwnerApiResponse>(`${this.baseUrl}/fetchSupportOwner`)
        .pipe(
          map((res) => (res?.data || []).map((u) => ({
            id: String(u.id),
            name: u.name,
            email: u.email ?? u.Email ?? u.mail ?? ''
          }))),
          catchError(() => of([])),
          shareReplay(1)
        );
    }
    return this.supportOwners$;
  }

  /**
   * Fetches the currently logged-in employee's details (name + email) so it can be
   * used as the meeting host. Deliberately NOT cached/shareReplay'd like the other
   * lookups above, since this must reflect whoever is logged in right now.
   * Errors are intentionally left uncaught here — the component decides what to do
   * (e.g. fall back to manual host entry) when this call fails.
   */
  getEmployeeDetails(employeeId: number | string): Observable<EmployeeDetails> {
    return this.http
      .post<EmployeeDetailsApiResponse>(`${this.baseUrl}/meetings/employee-details`, { employeeId })
      .pipe(
        map(res => res.data)
      );
  }

  createTeamsMeeting(payload: CreateTeamsMeetingRequest) {

  return this.http.post<CreateTeamsMeetingResponse>(
    `${this.baseUrl}/meetings/create`,
    payload
  );

}

  /**
   * Fetches booked meetings for a given employee on a specific date.
   * Used to detect time-slot conflicts before scheduling a new meeting.
   */
  getBookedTimes(empId: number | string, date: string): Observable<BookedMeeting[]> {
    return this.http
      .post<BookedMeeting[]>(`${this.baseUrl}/meetings/booked-times`, { empId: Number(empId), date })
      .pipe(
        catchError(() => of([]))
      );
  }


  // inside ScheduleMeetingService class:
private meetingTypes$?: Observable<MeetingType[]>;

getMeetingTypes(): Observable<MeetingType[]> {
  if (!this.meetingTypes$) {
    this.meetingTypes$ = this.http
      .get<MeetingTypeApiResponse>(`${this.baseUrl}/meetings/meeting-types`)
      .pipe(
        map(res => res.data || []),
        catchError(() => of([])),
        shareReplay(1)
      );
  }
  return this.meetingTypes$;
}

}