// 0 = not_started (DB default), 1 = completed, 2 = in_progress
// 3 = not_enrolled (frontend-only sentinel used by getCatalog when no enrollment row exists)
export type EnrollmentStatus = 0 | 1 | 2 | 3;

export interface CatalogCourse {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  category_name: string | null;
  module_count: number;
  enrollment_status: EnrollmentStatus;
  progress_percent: number;
  enrolled_at: string | null;
  last_accessed_at: string | null;
  completed_at: string | null;
  code?: string;
  duration_label?: string;
}

export interface CatalogResponse {
  totalCourses: number;
  seenCount: number;
  notSeenCount: number;
  courses: CatalogCourse[];
}

export interface CourseMaterial {
  id: number;
  course_id: number;
  module_id: number | null;
  title: string;
  file_path: string;   // public S3 URL stored directly (no material_type / file_url / mime_type)
}

export interface CourseModuleDetail {
  id: number;
  course_id: number;
  title: string;
  description: string | null;
  video_url: string | null;
  sort_order: number;
  materials: CourseMaterial[];
  is_completed: boolean;
  watched_percent: number;
  last_accessed_at: string | null;
  completed_at: string | null;
}

// Matches the FULL course_enrollments row -- backend returns this as-is,
// not a trimmed-down object.
export interface EnrollmentRecord {
  id: number;
  user_id: number;
  course_id: number;
  status: EnrollmentStatus;
  progress_percent: number;
  enrolled_at: string | null;
  last_accessed_at: string | null;
  completed_at: string | null;
  already_enrolled?: boolean; // only present on enroll() response when already enrolled
}

export interface CourseDetail {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  category_name: string | null;
  enrollment: any | null;
  materials: CourseMaterial[];
  modules: CourseModuleDetail[];
}

export interface MyLearningSummary {
  totalCourses: number;
  seenCount: number;
  notSeenCount: number;
  completedCourses: number;
  inProgressCourses: number;
}

export interface MyLearningCourse {
  id: number;
  title: string;
  slug: string;
  category_name: string | null;
  enrollment_status: EnrollmentStatus;
  progress_percent: number;
  enrolled_at: string | null;
  last_accessed_at: string | null;
  completed_at: string | null;
  total_modules: number;
  completed_modules: number;
}

export interface MyLearningResponse {
  summary: MyLearningSummary;
  courses: MyLearningCourse[];
}