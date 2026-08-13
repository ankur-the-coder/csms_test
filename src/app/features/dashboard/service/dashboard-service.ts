import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DashboardCardCount } from '../models/dashboardModel';

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly apiUrl = `${environment.apiUrl}/fetchDashboardCards`;

  constructor(private http: HttpClient) {}

  getDashboardCards(): Observable<DashboardCardCount> {
    return this.http.get<DashboardCardCount>(this.apiUrl);
  }
}
