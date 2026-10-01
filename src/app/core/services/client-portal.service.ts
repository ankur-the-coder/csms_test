import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  PortalDashboardResponse,
  PortalTicketListResponse,
  PortalTicketDetailResponse,
} from '../models/client-portal.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ClientPortalService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/client-portal`;

  /**
   * Authorization: Bearer <session_token> is added by the global auth interceptor.
   * Organisation and user are resolved server-side from the session token.
   */
  getDashboard(): Observable<PortalDashboardResponse> {
    return this.http.post<PortalDashboardResponse>(`${this.baseUrl}/dashboard`, {});
  }

  listTickets(filters: {
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  } = {}): Observable<PortalTicketListResponse> {
    return this.http.post<PortalTicketListResponse>(`${this.baseUrl}/tickets`, filters);
  }

  getTicketDetail(ticketUid: string): Observable<PortalTicketDetailResponse> {
    return this.http.post<PortalTicketDetailResponse>(`${this.baseUrl}/tickets/detail`, { ticketUid });
  }

  createTicket(payload: {
    subject: string;
    description: string;
    priority?: string;
    attachments?: Array<{ fileName: string; contentType?: string; size?: number; storagePath: string }>;
  }): Observable<{ status: boolean; data?: { ticketId: number; ticketUid: string; isDuplicate?: boolean }; msg?: string }> {
    return this.http.post<{ status: boolean; data?: { ticketId: number; ticketUid: string; isDuplicate?: boolean }; msg?: string }>(
      `${this.baseUrl}/tickets/create`,
      payload
    );
  }

  uploadAttachment(file: File): Observable<{ status: boolean; data?: { fileName: string; contentType: string; size: number; storagePath: string }; msg?: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ status: boolean; data?: { fileName: string; contentType: string; size: number; storagePath: string }; msg?: string }>(
      `${this.baseUrl}/tickets/attachments`,
      formData
    );
  }
}