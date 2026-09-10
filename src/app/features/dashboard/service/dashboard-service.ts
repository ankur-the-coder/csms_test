import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DashboardCardCount, DashboardChartdata, CalendarApiResponse } from '../models/dashboardModel';
import { ConnectedDataTableResponse } from '../models/connected.model';
import { FeedbackDataTableResponse } from '../models/feedback.model';
export interface DataTablePayload {
  start: number;
  length: number;
  search: string;
  sorting: string;
  filter: string;
  tabSts: number;
  fromDate: string;
  toDate: string;
}
export interface TodaysTasksResponse {
  data: {
    meetingCount: number;
    pendingTrainingCount: number;
    orgCounts: number; // implementations
  };
  total: number;
  status: boolean;
  msg: string;
}
@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getDashboardCards(from: string, to: string, orgId: string): Observable<DashboardCardCount> {
    let data = {
      fromDate: from,
      toDate: to,
      orgId
    };

    return this.http.post<DashboardCardCount>(`${this.apiUrl}/fetchDashboardCards`, data);
  }
  fetchDashBoardFeedbackChart(from: string, to: string, orgId: string): Observable<DashboardChartdata> {
    let data = {
      fromDate: from,
      toDate: to, orgId
    };

    return this.http.post<DashboardChartdata>(`${this.apiUrl}/fetchDashBoardFeedbackChart`, data);
  }
  fetchDashBoardConnectChart(from: string, to: string, orgId: string): Observable<DashboardChartdata> {
    let data = {
      fromDate: from,
      toDate: to, orgId
    };

    return this.http.post<DashboardChartdata>(`${this.apiUrl}/fetchDashBoardConnectChart`, data);
  }
  fetchDashBoardUsageChart(from: string, to: string, orgId: string): Observable<DashboardChartdata> {
    let data = {
      fromDate: from,
      toDate: to, orgId
    };

    return this.http.post<DashboardChartdata>(`${this.apiUrl}/fetchDashBoardUsageChart`, data);
  }
  dashboardImplementProgressChart(from: string, to: string, orgId: string): Observable<DashboardChartdata> {
    let data = {
      fromDate: from,
      toDate: to, orgId
    };

    return this.http.post<DashboardChartdata>(`${this.apiUrl}/dashboardImplementProgressChart`, data);
  }
  fetchDashBoardCalendar(from: string, to: string, orgId: string): Observable<CalendarApiResponse> {
    let data = {
      fromDate: from,
      toDate: to, orgId
    };

    return this.http.post<CalendarApiResponse>(`${this.apiUrl}/fetchDashBoardCalendar`, data);
  }
  fetchTodaysTasksData(from: string, to: string, orgId: string): Observable<TodaysTasksResponse> {
    let data = {
      fromDate: from,
      toDate: to, orgId
    };

    return this.http.post<TodaysTasksResponse>(`${this.apiUrl}/fetchTodaysTasksData`, data);
  }


  // Data table Api

  fetchFeedbackDataTable(payload: DataTablePayload): Observable<FeedbackDataTableResponse> {

    return this.http.post<FeedbackDataTableResponse>(`${this.apiUrl}/fetchFeedbackDataTable`, payload);

  }
  fetchConnectedDataTable(payload: DataTablePayload): Observable<ConnectedDataTableResponse> {

    return this.http.post<ConnectedDataTableResponse>(`${this.apiUrl}/fetchConnectedDataTable`, payload);

  }
  fetchUsagesDataTable(payload: DataTablePayload): Observable<any> {

    return this.http.post<any>(`${this.apiUrl}/fetchDashBoardUsagesTable`, payload);

  }





}
