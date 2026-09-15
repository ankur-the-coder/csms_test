import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../../environments/environment';
import { ClientDashboardTrackerResponse } from '../../../models/client/clientdashboardtracker.model';


export interface ClientDashboardTrackerPayload {
  orgId: string;
}

@Injectable({
  providedIn: 'root',
})

export class Clientdashboardtracker {

 public readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getClientDashboard(payload: ClientDashboardTrackerPayload): Observable<ClientDashboardTrackerResponse> {
    return this.http.post<ClientDashboardTrackerResponse>(`${this.baseUrl}/clientDashboardTracker`, payload);
  }

}
