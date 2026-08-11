import { Injectable } from '@angular/core';
import {
  CatalogResponse,
  CourseDetail,
  EnrollmentRecord,
  MyLearningResponse,
} from '../models/course.model';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { AuthService } from '../../../core/services/auth-service';

// ─── Config ─────────────────────────────────────────────────────────────────
const SERVER_BASE = 'http://127.0.0.1:5000';
const LEARNER_BASE = `${SERVER_BASE}/courses/learner`;

// Every API response from this backend is wrapped: { status, message, data }
interface ApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class LearnerCourseService {
  constructor(private http: HttpClient, private auth: AuthService) {}

  // ── GET /courses/learner/catalog?user_id=X ───────────────────────────────
  getCatalog(): Observable<CatalogResponse> {
    return this.http
      .get<ApiResponse<CatalogResponse>>(`${LEARNER_BASE}/catalog`, {
        params: { user_id: this.auth.getEmpId() },
      })
      .pipe(map((res) => res.data));
  }

  // ── GET /courses/learner/my-learning?user_id=X ──────────────────────────
  getMyLearning(): Observable<MyLearningResponse> {
    return this.http
      .get<ApiResponse<MyLearningResponse>>(`${LEARNER_BASE}/my-learning`, {
        params: { user_id: this.auth.getEmpId() },
      })
      .pipe(map((res) => res.data));
  }

  // ── GET /courses/learner/:id?user_id=X ──────────────────────────────────
  getCourseDetail(courseId: number | string): Observable<CourseDetail> {
    return this.http
      .get<ApiResponse<CourseDetail>>(`${LEARNER_BASE}/${courseId}`, {
        params: { user_id: this.auth.getEmpId() },
      })
      .pipe(map((res) => res.data));
  }

  // ── POST /courses/learner/:id/enroll  { user_id } ───────────────────────
  enroll(courseId: number | string): Observable<EnrollmentRecord> {
    return this.http
      .post<ApiResponse<EnrollmentRecord>>(
        `${LEARNER_BASE}/${courseId}/enroll`,
        { user_id: this.auth.getEmpId() }
      )
      .pipe(map((res) => res.data));
  }

  // ── POST /courses/learner/modules/:id/complete  { user_id } ─────────────
  markModuleComplete(
    moduleId: number
  ): Observable<{ percent: number; status: string; module_id: number; course_id: number }> {
    return this.http
      .post<ApiResponse<{ percent: number; status: string; module_id: number; course_id: number }>>(
        `${LEARNER_BASE}/modules/${moduleId}/complete`,
        { user_id: this.auth.getEmpId() }
      )
      .pipe(map((res) => res.data));
  }

  // ── POST /courses/learner/modules/:id/progress  { user_id, watched_percent } ─
  updateWatchedPercent(
    moduleId: number,
    watchedPercent: number
  ): Observable<{ percent: number; status: string }> {
    return this.http
      .post<ApiResponse<{ percent: number; status: string }>>(
        `${LEARNER_BASE}/modules/${moduleId}/progress`,
        { user_id: this.auth.getEmpId(), watched_percent: watchedPercent }
      )
      .pipe(map((res) => res.data));
  }
}