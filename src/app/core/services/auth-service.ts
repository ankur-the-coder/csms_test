import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginRequest, LoginResponse } from '../models/login.model';
import { Utils } from '../../shared/utils/utils';

@Injectable({
  providedIn: 'root',
})
export class AuthService {

  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  login(userName: string, password: string): Observable<LoginResponse> {
    const payload: LoginRequest = {
      userName: Utils.encode5t(userName),
      password: Utils.encode5t(password),
    };
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, payload);
  }
}
