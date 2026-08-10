import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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

  private readonly API_URL = 'http://127.0.0.1:5000';

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

  getCourseDetails(courseId: number, userId: number = 2254960): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/courses/learner/${courseId}?user_id=${userId}`);
  }

  uploadMaterial(formData: FormData): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/courses/admin/materials/upload`, formData);
  }

  deleteMaterial(id: number): Observable<any> {
    return this.http.delete<any>(`${this.API_URL}/courses/admin/materials/${id}`);
  }  

  createModule(courseId: number, payload: any): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/courses/admin/${courseId}/modules`, payload);
  }

  deleteModule(id: number): Observable<any> {
    return this.http.delete<any>(`${this.API_URL}/courses/admin/modules/${id}`);
  }

}  