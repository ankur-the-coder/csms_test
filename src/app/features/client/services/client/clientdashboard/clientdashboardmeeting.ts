import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../../environments/environment';
import { ClientDashaboardMeetingResponse } from '../../../models/client/clientdashboardmeeting.model';

export interface ClientDashboardMeetingPayload {
  orgId: string;
}

@Injectable({
  providedIn: 'root',
})
export class Clientdashboardmeeting {

public readonly baseUrl = environment.apiUrl;

constructor(private http: HttpClient) {}

getClientDashboard(payload: ClientDashboardMeetingPayload): Observable<ClientDashaboardMeetingResponse> {
  return this.http.post<ClientDashaboardMeetingResponse>(`${this.baseUrl}/clientDashboardMaeeting`, payload);
  }
}
