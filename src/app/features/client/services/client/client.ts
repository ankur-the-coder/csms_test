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

@Injectable({
  providedIn: 'root',
})
export class ClientService {
  public readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getClientDataTable(payload: DataTablePayload): Observable<ClientDataTableResponse> {
    return this.http.post<ClientDataTableResponse>(`${this.baseUrl}/clientDataTable`, payload);
  }
}
