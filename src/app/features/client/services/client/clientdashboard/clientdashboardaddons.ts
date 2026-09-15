import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../../environments/environment';
import { ClientDashboardAddonsResponse } from '../../../models/client/ClientDashboardAddons.model';

export interface ClientDashboardAddonsPayload {
  orgId: string;
}

@Injectable({
  providedIn: 'root',
})
export class Clientdashboardaddons {

 public readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getClientDashboard(payload: ClientDashboardAddonsPayload): Observable<ClientDashboardAddonsResponse> {
    return this.http.post<ClientDashboardAddonsResponse>(`${this.baseUrl}/clientDashboardAddons`, payload);
  }

}
