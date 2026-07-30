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

@Injectable({
  providedIn: 'root'
})
export class ImplementationService {
  private readonly baseUrl = 'http://127.0.0.1:5000/imp';

  constructor(private http: HttpClient) {}

  fetchDataTable(): Observable<ApiClientRow[]> {
    return this.http.post<ApiResponse>(`${this.baseUrl}/fetchDataTable`, {}).pipe(
      map(res => res.data || [])
    );
  }

  fetchImpCardData(): Observable<CardData> {
    return this.http.post<CardDataResponse>(`${this.baseUrl}/fetchImpCardData`, {}).pipe(
      map(res => res.data)
    );
  }
}
