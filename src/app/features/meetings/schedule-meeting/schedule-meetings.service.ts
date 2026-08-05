import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, shareReplay } from 'rxjs/operators';

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

}

export interface CreateTeamsMeetingResponse {

  status: boolean;

  meetingLink: string;

  meetingId: string;

  eventId: string;

  webLink: string;

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

  createTeamsMeeting(payload: CreateTeamsMeetingRequest) {

  return this.http.post<CreateTeamsMeetingResponse>(
    `${this.baseUrl}/meetings/create`,
    payload
  );

}

}