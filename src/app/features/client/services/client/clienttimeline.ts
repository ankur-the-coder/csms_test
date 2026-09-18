import { Injectable } from '@angular/core';
import { environment } from '../../../../../environments/environment';
import { ClientTimelineResponse } from '../../models/client/clienttimeline.model';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';



export interface ClientTimelinePayload {
  orgId: string;
}


@Injectable({
  providedIn: 'root',
})


export class Clienttimeline {

  public readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getClientTimeline(payload: ClientTimelinePayload): Observable<ClientTimelineResponse> {
    return this.http.post<ClientTimelineResponse>(`${this.baseUrl}/clientTimeline`, payload);
  }

}
