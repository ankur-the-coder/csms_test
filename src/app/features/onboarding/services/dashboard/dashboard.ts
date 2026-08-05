
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { CardData, DataTablePayload, ImplementationCardData, ImplementationData } from '../../../implementations/models/implementation.model';
import { environment } from '../../../../../environments/environment';



@Injectable({
  providedIn: 'root',
})

export class DashboardService {

private readonly baseUrl =environment.apiUrl;

  constructor(private http: HttpClient) {}

  fetchDataTable(payload: DataTablePayload): Observable<ImplementationData> {
    return this.http.post<ImplementationData>(`${this.baseUrl}/onboardingDashboardTable`, payload);
  }

  fetchImpCardData(): Observable<any> {
    return this.http.post<ImplementationCardData>(`${this.baseUrl}/fetchImpCardData`, {});


    // .pipe(
    //   map(res => res.data)
    // );
  }

}

