import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Data, LoginResponse } from '../models/login.model';
import { Utils } from '../../shared/utils/utils';

@Injectable({
  providedIn: 'root',
})
export class AuthService {

  private readonly baseUrl = environment.apiUrl;
  readonly isLoggedIn = signal<boolean>(false);
  constructor(private http: HttpClient) { }

  login(userName: string, password: string): Observable<LoginResponse> {

    const payload = new FormData();
    // const payload: Data = {
    payload.append('userName', Utils.encode5t(userName));
    payload.append('password', Utils.encode5t(password));
    // };
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, payload);
  }
}
