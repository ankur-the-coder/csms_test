import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DashboardCardCount, DashboardChartdata } from '../models/dashboardModel';

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getDashboardCards(from: string, to: string): Observable<DashboardCardCount> {
    let data = {
      fromDate: from,
      toDate: to,
    };

    return this.http.post<DashboardCardCount>(`${this.apiUrl}/fetchDashboardCards`, data);
  }
  fetchDashBoardFeedbackChart(from: string, to: string): Observable<DashboardChartdata> {
    let data = {
      fromDate: from,
      toDate: to,
    };

    return this.http.post<DashboardChartdata>(`${this.apiUrl}/fetchDashBoardFeedbackChart`, data);
  }
fetchDashBoardConnectChart(from: string, to: string): Observable<DashboardChartdata> {
    let data = {
      fromDate: from,
      toDate: to,
    };

    return this.http.post<DashboardChartdata>(`${this.apiUrl}/fetchDashBoardConnectChart`, data);
  }
  fetchDashBoardUsageChart(from: string, to: string): Observable<DashboardChartdata> {
    let data = {
      fromDate: from,
      toDate: to,
    };

    return this.http.post<DashboardChartdata>(`${this.apiUrl}/fetchDashBoardUsageChart`, data);
  }
  dashboardImplementProgressChart(from: string, to: string): Observable<DashboardChartdata> {
    let data = {
      fromDate: from,
      toDate: to,
    };

    return this.http.post<DashboardChartdata>(`${this.apiUrl}/dashboardImplementProgressChart`, data);
  }
}
