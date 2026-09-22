import { Injectable } from '@angular/core';

import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CardData, DataTablePayload, ImplementationCardData, ImplementationData, ImpCardPayload } from '../../models/implementation.model';
import { environment } from '../../../../../environments/environment';



@Injectable({
  providedIn: 'root',
})

export class ImplementationService {

  public readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  fetchDataTable(payload: DataTablePayload): Observable<ImplementationData> {
    return this.http.post<ImplementationData>(`${this.baseUrl}/imp/fetchDataTable`, payload);
  }

  fetchImpCardData(payload?: ImpCardPayload): Observable<CardData> {
    return this.http.post<ImplementationCardData>(`${this.baseUrl}/imp/fetchImpCardData`, payload ?? {}).pipe(
      map(res => res.data)
    );
  }
}
