
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { CardData, ImplementationCardData, ImplementationData } from '../../../implementations/models/implementation.model';
import { environment } from '../../../../../environments/environment';
import { OnboardingCardData, OnboardingDataTableResponse } from '../../models/dashboard.model';

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

export class DashboardService {

  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  fetchDataTable(payload: DataTablePayload): Observable<OnboardingDataTableResponse> {








    if (environment) {
      console.log(environment.apiUrl);
      console.log(environment.appName);
      console.log(environment.production);
      console.log(environment.version);
      // console.log(environment.apiUrl);
      console.log('Running in PRODUCTION');
    } else {
      console.log('Running in DEVELOPMENT');
    }
    return this.http.post<OnboardingDataTableResponse>(`${this.baseUrl}/onboardingDashboardTable`, payload);
  }
  fetchOnboardCardData(): Observable<CardData> {
    return this.http
      .post<OnboardingCardData>(`${this.baseUrl}/imp/fetchImpCardData`, {})
      .pipe(map((res) => res.data));
  }



}

