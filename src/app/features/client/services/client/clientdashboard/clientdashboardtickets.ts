import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../../environments/environment';
import { ClientDashboardTicketsResponse } from '../../../models/client/clientdashboardtickets';




export interface ClientDashboardTicketsPayload {
  orgId: string;
}

@Injectable({
  providedIn: 'root',
})


export class Clientdashboardtickets {

  public readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getClientDashboard(payload: ClientDashboardTicketsPayload): Observable<ClientDashboardTicketsResponse> {
    return this.http.post<ClientDashboardTicketsResponse>(`${this.baseUrl}/clientDashboardTickets`, payload);
  }

}
