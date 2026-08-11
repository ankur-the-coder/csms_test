export type EnrollmentStatus = 'not_started' | 'in_progress' | 'completed';

export interface CatalogCourse {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
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
  material_type: 'pdf' | 'image';
  title: string;
  file_path: string;   // S3 key or external URL
  file_url?: string;   // present when uploaded via CourseMaterialService (S3 public URL)
  mime_type: string | null;
}

export interface CourseModuleDetail {
  id: number;
  course_id: number;
  title: string;
  description: string | null;
  video_url: string | null;
  video_duration_secs: number | null;
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
  thumbnail_url: string | null;
  category_name: string | null;
  enrollment: any | null;   // <-- fixed: full row, not trimmed object
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
  thumbnail_url: string | null;
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