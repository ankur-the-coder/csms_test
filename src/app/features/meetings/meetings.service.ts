import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Organization {
  orgId: number;
  name: string;
}

export interface MeetingRow {
  id: number;
  orgId: number | null;
  orgName: string;
  empId: number;
  priority: number;
  purpose: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  duration: string;
  clientMail: string;
  meetingLink: string;
  webLink: string;
  status: number;
  eventId: string;
  onlineMeetingId: string | null;
  createdById: number;
  createdDate: string;
  lastModifiedById: number;
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
}

export interface FetchMeetingsResponse {
  status: boolean;
  data: MeetingRow[];
  meta: { total: number; first_page: number };
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

@Injectable({
  providedIn: 'root'
})
export class MeetingService {
  // Exact API you gave me for organization data
  private readonly imp = 'http://127.0.0.1:5000';

  constructor(private http: HttpClient) {}

  /**
   * Orgs for the "Schedule Meeting" dropdown.
   * Hits http://127.0.0.1:5000/imp/fetchDataTable directly.
   */
  getOrganizations(): Observable<Organization[]> {
    const payload: DataTablePayload = {
      start: 0,
      length: 10,
      search: '',
      sorting: '',
      filter: ''
    };

    return this.http.post<DataTableApiResponse>(`http://127.0.0.1:5000/meetings/fetchOrganizations`, payload).pipe(
      map(res => (res.data || []).map(row => ({
        orgId: row.orgId,
        name: row.organization
      })))
    );
  }

  getLeadOwners(): Observable<string[]> {
    return this.http.post<{status: boolean, data: {name: string}[]}>(`http://127.0.0.1:5000/meetings/fetchLeadOwners`, {}).pipe(
      map(res => (res.data || []).map(row => row.name))
    );
  }

  getSupportOwners(): Observable<string[]> {
    return this.http.post<{status: boolean, data: {name: string}[]}>(`http://127.0.0.1:5000/meetings/fetchSupportOwners`, {}).pipe(
      map(res => (res.data || []).map(row => row.name))
    );
  }

  fetchMeetings(payload: FetchMeetingsPayload): Observable<FetchMeetingsResponse> {
    return this.http.post<FetchMeetingsResponse>(`${this.imp}/meetings/fetchMeetings`, payload);
  }
}