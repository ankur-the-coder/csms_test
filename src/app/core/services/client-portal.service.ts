import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  PortalDashboardResponse,
  PortalTicketListResponse,
  PortalTicketDetailResponse,
  PortalPlanResponse,
  PortalUsageResponse,
  PortalTrendResponse,
  PortalImplementationResponse,
  PortalAddonsResponse,
  PortalInvoicesResponse,
  PortalSupportResponse,
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

  getPlan(): Observable<PortalPlanResponse> {
    return this.http.post<PortalPlanResponse>(`${this.baseUrl}/plan`, {});
  }

  getImplementation(): Observable<PortalImplementationResponse> {
    return this.http.post<PortalImplementationResponse>(`${this.baseUrl}/implementation`, {});
  }

  getSupport(): Observable<PortalSupportResponse> {
    return this.http.post<PortalSupportResponse>(`${this.baseUrl}/support`, {});
  }

  getInvoices(): Observable<PortalInvoicesResponse> {
    return this.http.post<PortalInvoicesResponse>(`${this.baseUrl}/invoices`, {});
  }

  getAddons(): Observable<PortalAddonsResponse> {
    return this.http.post<PortalAddonsResponse>(`${this.baseUrl}/addons`, {});
  }

  getUsage(): Observable<PortalUsageResponse> {
    return this.http.post<PortalUsageResponse>(`${this.baseUrl}/usage`, {});
  }

  /** Line-chart trend of one Usage Analytics tab (leave, employee, organization, ...) */
  getUsageModule(module: string): Observable<PortalTrendResponse> {
    return this.http.post<PortalTrendResponse>(`${this.baseUrl}/usage/module`, { module });
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

  submitTicketFeedback(payload: {
    ticketUid: string;
    rating: number;
    likedMost?: string;
    improve?: string;
    explanation?: string;
  }): Observable<{ status: boolean; data?: { rating: number; reopened: boolean }; msg?: string }> {
    return this.http.post<{ status: boolean; data?: { rating: number; reopened: boolean }; msg?: string }>(
      `${this.baseUrl}/tickets/feedback`,
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

  /** Raise a ticket directly on the ubiDesk server (multipart: subject, message, attachments[]). */
  raiseTicketToDesk(form: FormData): Observable<{ status: boolean; data?: { ticketId: number; ticketUid: string }; message?: string }> {
    return this.http.post<{ status: boolean; data?: { ticketId: number; ticketUid: string }; message?: string }>(
      `${environment.ubiDeskApiUrl}/public/client-portal/tickets`,
      form
    );
  }
}