import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { TableFilter } from './data-table.types';

interface OwnerApiRow {
  // Adjust these field names to match your actual API response
  id?: number | string;
  Id?: number | string;
  userId?: number | string;
  name?: string;
  Name?: string;
  userName?: string;
  [key: string]: any;
}

interface OwnerApiResponse {
  status: boolean;
  data: OwnerApiRow[];
}

interface OrgApiRow {
  orgId: number;
  organization: string;
  [key: string]: any;
}

interface OrgApiResponse {
  status: boolean;
  data: OrgApiRow[];
}

@Injectable({ providedIn: 'root' })
export class DataTableService {
  private readonly baseUrl = 'http://127.0.0.1:5000';

  constructor(private http: HttpClient) {}

  /**
   * Fetch filter options by name.
   * Returns an empty TableFilter on error so the UI doesn't break.
   */
  getFilterOptions(name: string): Observable<TableFilter> {
    switch (name) {
      case 'health':
        return of({
          key: 'health',
          label: 'Health',
          options: [
            { label: 'Excellent', value: 'Excellent' },
            { label: 'Good',      value: 'Good' },
            { label: 'Neutral',   value: 'Neutral' },
            { label: 'Risk',      value: 'Risk' },
          ],
        });

      case 'gender':
        return of({
          key: 'gender',
          label: 'Gender',
          multiSelect: true,
          options: [
            { label: 'Male',   value: 'Male' },
            { label: 'Female', value: 'Female' },
          ],
        });

      case 'leadOwner':
        return this.http.get<OwnerApiResponse>(`${this.baseUrl}/fetchLeadOwner`).pipe(
          map((res) => ({
            key: 'leadOwner',
            label: 'Lead Owner',
            searchable: true,
            options: (res?.data || []).map((u) => ({
              label: u.name ?? u.Name ?? u.userName ?? '',
              value: String(u.id ?? u.Id ?? u.userId ?? ''),
            })),
          } as TableFilter)),
          catchError(() => of({ key: 'leadOwner', label: 'Lead Owner', searchable: true, options: [] } as TableFilter))
        );

      case 'supportOwner':
        return this.http.get<OwnerApiResponse>(`${this.baseUrl}/fetchSupportOwner`).pipe(
          map((res) => ({
            key: 'supportOwner',
            label: 'Support Owner',
            searchable: true,
            options: (res?.data || []).map((u) => ({
              label: u.name ?? u.Name ?? u.userName ?? '',
              value: String(u.id ?? u.Id ?? u.userId ?? ''),
            })),
          } as TableFilter)),
          catchError(() => of({ key: 'supportOwner', label: 'Support Owner', searchable: true, options: [] } as TableFilter))
        );

      // --------------------------------------------------------------
      // Meeting filters — map to the "filter" JSON keys accepted by
      // POST /meetings/fetchMeetings (status, priority, orgId, empId).
      // --------------------------------------------------------------

      case 'meetingStatus':
        return of({
          key: 'meetingStatus',
          label: 'Status',
          options: [
            { label: 'Scheduled',   value: '0' },
            { label: 'Completed',   value: '1' },
            { label: 'Rescheduled', value: '2' },
            { label: 'Cancelled',   value: '3' },
          ],
        });

      case 'meetingPriority':
        return of({
          key: 'meetingPriority',
          label: 'Priority',
          options: [
            { label: 'Low',    value: '0' },
            { label: 'Medium', value: '1' },
            { label: 'High',   value: '2' },
          ],
        });

      case 'organization':
        return this.http.get<OrgApiResponse>(`${this.baseUrl}/meetings/fetchOrganizations`).pipe(
          map((res) => ({
            key: 'organization',
            label: 'Organization',
            searchable: true,
            options: (res?.data || []).map((o) => ({
              label: o.organization,
              value: String(o.orgId),
            })),
          } as TableFilter)),
          catchError(() => of({ key: 'organization', label: 'Organization', searchable: true, options: [] } as TableFilter))
        );

      case 'host':
        // Meeting hosts are drawn from the same lead/support owner pools
        // used elsewhere — combined and deduplicated into one list so the
        // filter maps directly to the meeting's "empId" filter key.
        return forkJoin({
          leadOwners: this.http.get<OwnerApiResponse>(`${this.baseUrl}/fetchLeadOwner`).pipe(
            catchError(() => of({ status: false, data: [] } as OwnerApiResponse))
          ),
          supportOwners: this.http.get<OwnerApiResponse>(`${this.baseUrl}/fetchSupportOwner`).pipe(
            catchError(() => of({ status: false, data: [] } as OwnerApiResponse))
          ),
        }).pipe(
          map(({ leadOwners, supportOwners }) => {
            const seen = new Set<string>();

            const options = [...(leadOwners?.data || []), ...(supportOwners?.data || [])]
              .map((u) => ({
                label: u.name ?? u.Name ?? u.userName ?? '',
                value: String(u.id ?? u.Id ?? u.userId ?? ''),
              }))
              .filter((opt) => {
                if (!opt.value || seen.has(opt.value)) return false;
                seen.add(opt.value);
                return true;
              });

            return { key: 'host', label: 'Host', searchable: true, options } as TableFilter;
          }),
          catchError(() => of({ key: 'host', label: 'Host', searchable: true, options: [] } as TableFilter))
        );

      case 'renewalOwner':
        return of({
          key: 'renewalOwner',
          label: 'Renewal Owner',
          searchable: true,
          options: [
            { label: 'Anita Rao',  value: 'anita' },
            { label: 'Vikram Nair', value: 'vikram' },
          ],
        });

      case 'leadSource':
        return of({
          key: 'leadSource',
          label: 'Lead Source',
          options: [
            { label: 'Website',   value: 'website' },
            { label: 'Referral',  value: 'referral' },
            { label: 'Cold Call', value: 'cold_call' },
            { label: 'Social',    value: 'social' },
          ],
        });

      case 'reseller':
        return of({
          key: 'reseller',
          label: 'Reseller',
          searchable: true,
          options: [
            { label: 'Partner A', value: 'partner_a' },
            { label: 'Partner B', value: 'partner_b' },
          ],
        });

      case 'tags':
        return of({
          key: 'tags',
          label: 'Tags',
          multiSelect: true,
          searchable: true,
          options: [
            { label: 'Hot',  value: 'hot' },
            { label: 'Cold', value: 'cold' },
            { label: 'VIP',  value: 'vip' },
          ],
        });

      case 'rating':
        return of({
          key: 'rating',
          label: 'Rating',
          starRating: true,
          options: [
            { label: '1 Star',  value: '1' },
            { label: '2 Stars', value: '2' },
            { label: '3 Stars', value: '3' },
            { label: '4 Stars', value: '4' },
            { label: '5 Stars', value: '5' },
          ],
        });

      case 'country':
  return this.http.get<OwnerApiResponse>(`${this.baseUrl}/fetchAllCountry`).pipe(
    map((res) => ({
      key: 'country',
      label: 'Country',
      searchable: true,
      options: (res?.data || []).map((c) => ({
        label: c.name ?? c.Name ?? c['countryName'] ?? '',
        value: String(c.id ?? c.Id ?? c['countryId'] ?? c.name ?? c.Name ?? ''),
      })),
    } as TableFilter)),
    catchError(() => of({ key: 'country', label: 'Country', searchable: true, options: [] } as TableFilter))
  );

      case 'emailStatus':
        return of({
          key: 'emailStatus',
          label: 'Email Status',
          options: [
            { label: 'Verified',   value: 'verified' },
            { label: 'Bounced',    value: 'bounced' },
            { label: 'Unverified', value: 'unverified' },
          ],
        });

      case 'stage':
        return of({
          key: 'stage',
          label: 'Stages',
          options: [
            { label: 'New',        value: 'new' },
            { label: 'Contacted',  value: 'contacted' },
            { label: 'Qualified',  value: 'qualified' },
            { label: 'Closed Won', value: 'closed_won' },
          ],
        });

      case 'dateRange':
        return of({
          key: 'dateRange',
          label: 'Date Range',
          type: 'daterange',
          options: [],
        });

      default:
        return this.http.get<any>(`/api/filters/${name}`).pipe(
          map((res) => res as TableFilter),
          catchError(() => of({ key: name, label: name, options: [] } as TableFilter))
        );
    }
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