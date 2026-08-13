import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';


export interface Organization {
  id: number;
  organization: string;
  contactPerson: string;
  email: string;
  phone: string;
  supportOwner: string;
  leadOwner: string;
  stage: string;
  createdDate: string;
}

export interface TrainingResponse {
  status: boolean;
  msg: string;
  data: Organization[];
  meta: {
    total: number;
    start: number;
    length: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class TrainingService {
  private http = inject(HttpClient);
  public readonly API_URL = environment.apiUrl;

  trainingTable(payload: any): Observable<TrainingResponse> {
    return this.http.post<TrainingResponse>(
      `${this.API_URL}/trainingTable`,
      payload
    );
  }

  getCourses(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/courses/admin/list`);
  }

  createCourse(payload: any): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/courses/admin/create`, payload);
  }

  getCourseDetails(courseId: number, userId: number): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/courses/learner/${courseId}?user_id=${userId}`);
  }

  uploadMaterial(formData: FormData): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/courses/admin/materials/upload`, formData);
  }

  deleteMaterial(id: number): Observable<any> {
    return this.http.delete<any>(`${this.API_URL}/courses/admin/materials/${id}`);
  }

  createModule(courseId: number, formData: FormData): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/courses/admin/${courseId}/modules`, formData);
  }

  updateModule(id: number, formData: FormData): Observable<any> {
    return this.http.put<any>(`${this.API_URL}/courses/admin/modules/${id}`, formData);
  }

  deleteModule(id: number): Observable<any> {
    return this.http.delete<any>(`${this.API_URL}/courses/admin/modules/${id}`);
  }





}
