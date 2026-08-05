import { Injectable } from '@angular/core';

import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CardData, DataTablePayload, ImplementationCardData, ImplementationData } from '../../models/implementation.model';



@Injectable({
  providedIn: 'root',
})

export class ImplementationService {
  public readonly baseUrl = 'http://127.0.0.1:5000/imp';

  constructor(private http: HttpClient) {}

  fetchDataTable(payload: DataTablePayload): Observable<ImplementationData> {
    return this.http.post<ImplementationData>(`${this.baseUrl}/fetchDataTable`, payload);
  }

  fetchImpCardData(): Observable<CardData> {
    return this.http.post<ImplementationCardData>(`${this.baseUrl}/fetchImpCardData`, {}).pipe(
      map(res => res.data)
    );
  }
}
