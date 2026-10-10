import { Injectable } from '@angular/core';
import { environment } from '../../../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { ClientDashboardModulesResponse } from '../../../models/client/clientdashboardmodules.model';
import { Observable } from 'rxjs';


export interface ClientDashboardModulesPayload {
  orgId: string;
  fromDate: string; // yyyy-MM-dd
  toDate: string; // yyyy-MM-dd
}

@Injectable({
  providedIn: 'root',
})

export class Clientdashboardmodules {

 public readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getClientDashboard(
    payload: ClientDashboardModulesPayload,
  ): Observable<ClientDashboardModulesResponse> {
    return this.http.post<ClientDashboardModulesResponse>(
      `${this.baseUrl}/clientDashboardModules`,
      payload,
    );
  }


}
