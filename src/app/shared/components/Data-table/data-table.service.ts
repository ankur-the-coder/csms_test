// ─────────────────────────────────────────────────────────────────────────────
// data-table.service.ts
// Minimal service for DataTable — filter option loading
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { TableFilter } from './data-table.types';

@Injectable({ providedIn: 'root' })
export class DataTableService {
  constructor(private http: HttpClient) {}

  /**
   * Fetch filter options by name.
   * Returns an empty TableFilter on error so the UI doesn't break.
   */
  getFilterOptions(name: string): Observable<TableFilter> {
    return this.http.get<any>(`/api/filters/${name}`).pipe(
      map((res) => res as TableFilter),
      catchError(() => of({ key: name, label: name, options: [] } as TableFilter))
    );
  }

  /**
   * Fetch cities for a given country (for location cascade).
   */
  getCities(country: string): Observable<{ label: string; value: string }[]> {
    return this.http.get<any[]>(`/api/cities?country=${country}`).pipe(
      map((res) => res),
      catchError(() => of([]))
    );
  }
}
