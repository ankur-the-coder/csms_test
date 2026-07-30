import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiModuleProgress {
  completed: number;
  total: number;
}

export interface ApiOverallProgress {
  approved: number;
  total: number;
  percentage: number;
}

export interface ApiClientRow {
  orgId: number;
  organization: string;
  onboardedDate: string;
  csLead: string;
  health: string;
  overallProgress: ApiOverallProgress;
  modules: {
    employee: ApiModuleProgress;
    attendance: ApiModuleProgress;
    leave: ApiModuleProgress;
    salary: ApiModuleProgress;
    organization: ApiModuleProgress;
    timesheet: ApiModuleProgress;
    payroll: ApiModuleProgress;
  };
}

export interface ApiResponse {
  status: boolean;
  data: ApiClientRow[];
  meta: {
    total: number;
    first_page: number;
  };
}

export interface DataTablePayload {
  start: number;          // offset = (page) * pageSize
  length: number;         // page size
  search: string;         // free-text search
  sorting: string;        // JSON string: { require: 0|1, col: string, dir: 'asc'|'desc' }
  filter: string;         // JSON string of active filter key-value pairs
}

export interface CardData {
  totalAccounts: number;
  completed: number;
  inProgress: number;
  notStarted: number;
}

export interface CardDataResponse {
  status: boolean;
  data: CardData;
}

export interface FetchDataTablePayload {
  start?: number;
  length?: number;
  search?: string;
  sorting?: string;
  filter?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ImplementationService {
  private readonly baseUrl = 'http://127.0.0.1:5000/imp';

  constructor(private http: HttpClient) {}

  fetchDataTable(payload: DataTablePayload): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.baseUrl}/fetchDataTable`, payload);
  }

  fetchImpCardData(): Observable<CardData> {
    return this.http.post<CardDataResponse>(`${this.baseUrl}/fetchImpCardData`, {}).pipe(
      map(res => res.data)
    );
  }
}