import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ClientDataTableResponse } from '../../models/client/client.model';

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
export class Client {
  private readonly baseUrl = 'http://127.0.0.1:5000/clientDataTable';

  constructor(private http: HttpClient) {}

  getClientDataTable(payload: DataTablePayload): Observable<ClientDataTableResponse> {
    return this.http.post<ClientDataTableResponse>(this.baseUrl, payload);
  }
}
