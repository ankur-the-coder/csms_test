import { Injectable } from '@angular/core';
import { ClientDashboardUsageResponse } from '../../../models/client/clientdashboardusage.model';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../../environments/environment';


export interface ClientDashboardUsagePayload {
  orgId: string;

}

@Injectable({
  providedIn: 'root',
})


export class Clientdashboardusage {

  public readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getClientDashboard(payload: ClientDashboardUsagePayload): Observable<ClientDashboardUsageResponse> {
    return this.http.post<ClientDashboardUsageResponse>(`${this.baseUrl}/clientDashboardUsage`, payload);
  }

}
