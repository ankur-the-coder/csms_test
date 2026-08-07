import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CircularProgress } from '../circular-progress/circular-progress';
import { CommonModule } from '@angular/common';
import { SafeResourceUrl, DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { LearnerCourseService } from '../../services/learner-course.service';
import { CourseDetail as CourseDetailModel, CourseModuleDetail } from '../../models/course.model';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-course-detail',
  imports: [CommonModule, CircularProgress],
  templateUrl: './course-detail.html',
  styleUrl: './course-detail.css',
})
export class CourseDetail implements OnInit {
  course: CourseDetailModel | null = null;
  activeModule: CourseModuleDetail | null = null;
  safeVideoUrl: SafeResourceUrl | null = null;
  loading = false;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private learnerCourseService: LearnerCourseService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef  // ← needed because withFetch() runs outside Angular zone
  ) {}

  ngOnInit(): void {
    const courseId = this.route.snapshot.paramMap.get('id');
    if (!courseId) {
      this.error = 'No course ID found in URL.';
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }
    this.fetchCourse(courseId);
  }

  fetchCourse(courseId: string): void {
    this.loading = true;
    this.error = '';

    this.learnerCourseService
      .getCourseDetail(courseId)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res) => {
          try {
            this.course = res;
                this.loading = false;
            if (res?.modules?.length) {
              const firstIncomplete = res.modules.find((m) => !m.is_completed);
              this.selectModule(firstIncomplete ?? res.modules[0]);
            }
          } catch {
            this.error = 'Unexpected data format from server.';
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'Unable to load course. Please try again.';
          this.cdr.markForCheck();
        },
      });
  }

  selectModule(module: CourseModuleDetail): void {
    this.activeModule = module;
    this.safeVideoUrl = module.video_url
      ? this.sanitizer.bypassSecurityTrustResourceUrl(this.toEmbedUrl(module.video_url))
      : null;
    this.cdr.markForCheck();
  }

  private toEmbedUrl(url: string): string {
    const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
    if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;
    const longMatch = url.match(/[?&]v=([^&]+)/);
    if (longMatch) return `https://www.youtube.com/embed/${longMatch[1]}`;
    return url;
  }

  markComplete(module: CourseModuleDetail): void {
    module.is_completed = true;
    module.watched_percent = 100;
    this.recalcProgress();
    this.cdr.markForCheck();

    this.learnerCourseService.markModuleComplete(module.id).subscribe({
      next: (res) => {
        if (this.course?.enrollment) {
          this.course.enrollment.progress_percent = res.percent;
          this.course.enrollment.status = res.status;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        // Optimistic update already applied
      },
    });
  }

  private recalcProgress(): void {
    if (!this.course) return;
    const total = this.course.modules.length;
    const done  = this.course.modules.filter((m) => m.is_completed).length;
    if (!this.course.enrollment) {
      this.course.enrollment = {};
    }
    this.course.enrollment.progress_percent = total ? Math.round((done / total) * 100) : 0;
    this.course.enrollment.status = done === total ? 'completed' : 'in_progress';
  }

  backToCatalog(): void {
    this.router.navigate(['/courses']);
  }

  get progressPercent(): number {
    return this.course?.enrollment?.progress_percent ?? 0;
  }
}
