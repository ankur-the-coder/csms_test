import { Injectable } from '@angular/core';
import {
  CatalogResponse,
  CourseDetail,
  EnrollmentRecord,
  MyLearningResponse,
} from '../models/course.model';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

// ─── Config ─────────────────────────────────────────────────────────────────
const SERVER_BASE = environment.apiUrl; 
const LEARNER_BASE = `${SERVER_BASE}/courses/learner`;

// Every API response from this backend is wrapped: { status, message, data }
interface ApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class LearnerCourseService {
  constructor(private http: HttpClient) {}

  // ── GET /courses/learner/catalog?user_id=X&org_id=Y ──────────────────────
  getCatalog(userId: string, orgId: string): Observable<CatalogResponse> {
    return this.http
      .get<ApiResponse<CatalogResponse>>(`${LEARNER_BASE}/catalog`, {
        params: { user_id: userId, org_id: orgId },
      })
      .pipe(map((res) => res.data));
  }

  // ── GET /courses/learner/my-learning?user_id=X&org_id=Y ──────────────────
  getMyLearning(userId: string, orgId: string): Observable<MyLearningResponse> {
    return this.http
      .get<ApiResponse<MyLearningResponse>>(`${LEARNER_BASE}/my-learning`, {
        params: { user_id: userId, org_id: orgId },
      })
      .pipe(map((res) => res.data));
  }

  // ── GET /courses/learner/:id?user_id=X&org_id=Y ─────────────────────────
  getCourseDetail(courseId: number | string, userId: string, orgId: string): Observable<CourseDetail> {
    return this.http
      .get<ApiResponse<CourseDetail>>(`${LEARNER_BASE}/${courseId}`, {
        params: { user_id: userId, org_id: orgId },
      })
      .pipe(map((res) => res.data));
  }

  // ── POST /courses/learner/:id/enroll  { user_id, org_id } ────────────────
  enroll(courseId: number | string, userId: string, orgId: string): Observable<EnrollmentRecord> {
    return this.http
      .post<ApiResponse<EnrollmentRecord>>(
        `${LEARNER_BASE}/${courseId}/enroll`,
        { user_id: userId, org_id: orgId }
      )
      .pipe(map((res) => res.data));
  }

  // ── POST /courses/learner/modules/:id/complete  { user_id, org_id } ──────
  markModuleComplete(
    moduleId: number,
    userId: string,
    orgId: string
  ): Observable<{ percent: number; status: string; module_id: number; course_id: number }> {
    return this.http
      .post<ApiResponse<{ percent: number; status: string; module_id: number; course_id: number }>>(
        `${LEARNER_BASE}/modules/${moduleId}/complete`,
        { user_id: userId, org_id: orgId }
      )
      .pipe(map((res) => res.data));
  }

  // ── POST /courses/learner/modules/:id/progress  { user_id, org_id, watched_percent } ─
  updateWatchedPercent(
    moduleId: number,
    watchedPercent: number,
    userId: string,
    orgId: string
  ): Observable<{ percent: number; status: string }> {
    return this.http
      .post<ApiResponse<{ percent: number; status: string }>>(
        `${LEARNER_BASE}/modules/${moduleId}/progress`,
        { user_id: userId, org_id: orgId, watched_percent: watchedPercent }
      )
      .pipe(map((res) => res.data));
  }
}