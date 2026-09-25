import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ClientDataTableResponse } from '../../models/client/client.model';
import { environment } from '../../../../../environments/environment';
export interface DataTablePayload {
  start: number;
  length: number;
  search: string;
  sorting: string;
  filter: string;
  tabSts: number;
  fromDate?: string;
  toDate?: string;
}

export interface SendWelcomeMailPayload {
  hostEmail: string;
  toEmail: string;
  companyName: string;
  contactName: string;
}

export interface SendWelcomeMailResponse {
  status: boolean;
  message: string;
}

export interface SendCustomMailPayload {
  hostEmail: string;
  toEmails: string[];
  subject: string;
  message: string;
  companyName?: string;
  orgId?: number;
  empId?: number|string;
  attachments?: {
    name: string;
    contentType: string;
    contentBytes: string;
  }[];
  
}

export interface SendCustomMailResponse {
  status: boolean;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class ClientService {
  public readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getClientDataTable(payload: DataTablePayload): Observable<ClientDataTableResponse> {
    return this.http.post<ClientDataTableResponse>(`${this.baseUrl}/clientDataTable`, payload);
  }

  sendWelcomeMail(payload: SendWelcomeMailPayload): Observable<SendWelcomeMailResponse> {
    return this.http.post<SendWelcomeMailResponse>(`${this.baseUrl}/meetings/send-welcome-mail`, payload);
  }

  sendCustomMail(payload: SendCustomMailPayload): Observable<SendCustomMailResponse> {
    return this.http.post<SendCustomMailResponse>(`${this.baseUrl}/meetings/send-custom-mail`, payload);
  }
}