import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../../environments/environment';
import { ClientImplementationResponse } from '../../../models/client/clientimplementation.model';

export interface ClientImplementationPayload {
  orgId: string;
}

@Injectable({
  providedIn: 'root',
})
export class Clientimplementation {
  public readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getOrgImplementation(payload: ClientImplementationPayload): Observable<ClientImplementationResponse> {
    return this.http.post<ClientImplementationResponse>(`${this.baseUrl}/clientDashboardImplementation`, payload);
  }
}

