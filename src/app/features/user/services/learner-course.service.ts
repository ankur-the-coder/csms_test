import { Injectable } from '@angular/core';
import {
  CatalogResponse,
  CourseDetail,
  EnrollmentRecord,
  MyLearningResponse,
} from '../models/course.model';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

// ─── Config ─────────────────────────────────────────────────────────────────
const SERVER_BASE = 'http://127.0.0.1:5000';
const LEARNER_BASE = `${SERVER_BASE}/courses/learner`;

// TODO: Replace with a real auth service / token decode once login is wired up.
// For now we read from localStorage so you can set it manually during testing:
//   localStorage.setItem('user_id', '1')
function getUserId(): number {
  const stored = localStorage.getItem('user_id');
  if (stored && !isNaN(Number(stored)) && Number(stored) > 0) {
    return Number(stored);
  }
  return 1; // fallback for development — change to your test user ID
}

// Every API response from this backend is wrapped: { status, message, data }
interface ApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class LearnerCourseService {
  constructor(private http: HttpClient) {}

  // ── GET /courses/learner/catalog?user_id=X ───────────────────────────────
  getCatalog(): Observable<CatalogResponse> {
    return this.http
      .get<ApiResponse<CatalogResponse>>(`${LEARNER_BASE}/catalog`, {
        params: { user_id: 2224392 },
      })
      .pipe(map((res) => res.data));
  }

  // ── GET /courses/learner/my-learning?user_id=X ──────────────────────────
  getMyLearning(): Observable<MyLearningResponse> {
    return this.http
      .get<ApiResponse<MyLearningResponse>>(`${LEARNER_BASE}/my-learning`, {
        params: { user_id: 2224392 },
      })
      .pipe(map((res) => res.data));
  }

  // ── GET /courses/learner/:id?user_id=X ──────────────────────────────────
  getCourseDetail(courseId: number | string): Observable<CourseDetail> {
    return this.http
      .get<ApiResponse<CourseDetail>>(`${LEARNER_BASE}/${courseId}`, {
        params: { user_id: 2224392 },
      })
      .pipe(map((res) => res.data));
  }

  // ── POST /courses/learner/:id/enroll  { user_id } ───────────────────────
  enroll(courseId: number | string): Observable<EnrollmentRecord> {
    return this.http
      .post<ApiResponse<EnrollmentRecord>>(
        `${LEARNER_BASE}/${courseId}/enroll`,
        { user_id: 2224392 }
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
        { user_id: 2224392 }
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
        { user_id: 2224392, watched_percent: watchedPercent }
      )
      .pipe(map((res) => res.data));
  }
}