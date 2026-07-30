import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { DataTablePayload, Implementation, CardData, ImplementationCardData } from '../../../implementation/implentation.model';

@Injectable({
  providedIn: 'root',
})
export class Dashboard {

private readonly baseUrl = 'http://127.0.0.1:5000/imp';

  constructor(private http: HttpClient) {}

  fetchDataTable(payload: DataTablePayload): Observable<Implementation> {
    return this.http.post<Implementation>(`${this.baseUrl}/fetchDataTable`, payload);
  }

  fetchImpCardData(): Observable<CardData> {
    return this.http.post<ImplementationCardData>(`${this.baseUrl}/fetchImpCardData`, {}).pipe(
      map(res => res.data)
    );
  }

}
