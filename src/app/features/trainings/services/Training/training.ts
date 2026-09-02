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

export interface CourseCategory {
  id: number;
  name: string;
  slug?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TrainingService {
  private http = inject(HttpClient);
  public readonly API_URL = environment.apiUrl;


  // Training APIs

  trainingTable(payload: any): Observable<TrainingResponse> {
    return this.http.post<TrainingResponse>(
      `${this.API_URL}/trainingTable`,
      payload
    );
  }


  // Course APIs

getCourses(categoryId?: number): Observable<any> {
  const url = categoryId
    ? `${this.API_URL}/courses/admin/list?category_id=${categoryId}`
    : `${this.API_URL}/courses/admin/list`;

  return this.http.get<any>(url);
}

  createCourse(payload: any): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/courses/admin/create`, payload);
  }

  updateCourse(id: number | string, payload: any): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/courses/admin/${id}/update`, payload);
  }

  deleteCourse(id: number | string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/courses/admin/${id}/delete`, {});
  }

  getCourseDetails(courseId: number, userId: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/courses/learner/${courseId}?user_id=${userId}`);
  }


  // Category APIs

  getCategories(): Observable<any> {
    return this.http.get<any>(
      `${this.API_URL}/courses/admin/categories`
    );
  }

  getCategoryById(id: number): Observable<any> {
    return this.http.get<any>(
      `${this.API_URL}/courses/admin/categories/${id}`
    );
  }

  createCategory(
    payload: {
      name: string;
      slug?: string;
    }
  ): Observable<any> {
    return this.http.post<any>(
      `${this.API_URL}/courses/admin/categories/create`,
      payload
    );
  }

  updateCategory(
    id: number | string,
    payload: {
      name: string;
      slug?: string;
    }
  ): Observable<any> {
    return this.http.post<any>(
      `${this.API_URL}/courses/admin/categories/${id}/update`,
      payload
    );
  }

  deleteCategory(id: number | string): Observable<any> {
    return this.http.post<any>(
      `${this.API_URL}/courses/admin/categories/${id}/delete`,
      {}
    );
  }


  // Module APIs

  createModule(
    courseId: number,
    formData: FormData
  ): Observable<any> {
    return this.http.post<any>(
      `${this.API_URL}/courses/admin/${courseId}/modules`,
      formData
    );
  }

  updateModule(
    id: number,
    formData: FormData
  ): Observable<any> {
    return this.http.post<any>(
      `${this.API_URL}/courses/admin/modules/${id}/update`,
      formData
    );
  }

  deleteModule(id: number): Observable<any> {
    return this.http.post<any>(
      `${this.API_URL}/courses/admin/modules/${id}/delete`,
      {}
    );
  }


  // Material APIs

  uploadMaterial(formData: FormData): Observable<any> {
    return this.http.post<any>(
      `${this.API_URL}/courses/admin/materials/upload`,
      formData
    );
  }

  deleteMaterial(id: number): Observable<any> {
    return this.http.post<any>(
      `${this.API_URL}/courses/admin/materials/${id}/delete`,
      {}
    );
  }

}   