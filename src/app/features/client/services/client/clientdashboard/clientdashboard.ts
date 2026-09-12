import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ClientCard } from '../../../models/client/clientdashboard.model';
import { environment } from '../../../../../../environments/environment';


export interface ClientDashboardPayload {
  orgId: string;
}

@Injectable({
  providedIn: 'root',
})
export class Clientdashboard {
  public readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getClientDashboard(payload: ClientDashboardPayload): Observable<ClientCard> {
    return this.http.post<ClientCard>(`${this.baseUrl}/clientDashboard`, payload);
  }
}