import { ChangeDetectorRef, Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CircularProgress } from '../circular-progress/circular-progress';
import { CommonModule } from '@angular/common';
import { SafeResourceUrl, DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { LearnerCourseService } from '../../services/learner-course.service';
import { CourseDetail as CourseDetailModel, CourseModuleDetail } from '../../models/course.model';
import { environment } from '../../../../../environments/environment';
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

  // Full-screen PDF viewer state
  activePdfUrl: SafeResourceUrl | null = null;
  activePdfTitle: string | null = null;

  loading = true;
  error = '';
  isLastModuleFlag = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private learnerCourseService: LearnerCourseService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    const courseId = this.route.snapshot.paramMap.get('id');
    if (!courseId) {
      this.error = 'No course ID found in URL.';
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }
    if (isPlatformBrowser(this.platformId)) {
      this.fetchCourse(courseId);
    }
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
    // Compute once and store so the template never relies on a getter that can return stale -1
    if (this.course) {
      const idx = this.course.modules.findIndex((m) => String(m.id) === String(module.id));
      this.isLastModuleFlag = idx === this.course.modules.length - 1;
    }
    this.closePdfViewer();
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

  // ── Step navigation (Back / Next / Finish) ──────────────────────────
  get activeModuleIndex(): number {
    if (!this.course || !this.activeModule) return -1;
    // eslint-disable-next-line eqeqeq
    return this.course.modules.findIndex((m) => m.id == this.activeModule!.id);
  }

  get isFirstModule(): boolean {
    return this.activeModuleIndex <= 0;
  }

  get isLastModule(): boolean {
    return this.isLastModuleFlag;
  }

  goToPreviousModule(): void {
    if (!this.course || this.isFirstModule) return;
    this.selectModule(this.course.modules[this.activeModuleIndex - 1]);
  }

  goToNextModule(): void {
    if (!this.course || this.isLastModule) return;
    this.selectModule(this.course.modules[this.activeModuleIndex + 1]);
  }

  finishCourse(): void {
    this.router.navigate(['/courses']);
  }

  // ── Materials / full-screen PDF viewer ──────────────────────────────
  getFullUrl(mat: { file_url?: string; file_path?: string }): string {
    let url = mat.file_url || mat.file_path || '';
    if (url && !url.startsWith('http')) {
      const baseUrl = environment.apiUrl.endsWith('/') ? environment.apiUrl.slice(0, -1) : environment.apiUrl;
      url = `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    }
    return url;
  }

  isPdf(mat: { file_url?: string; file_path?: string }): boolean {
    const url = this.getFullUrl(mat);
    return url.toLowerCase().split('?')[0].endsWith('.pdf');
  }

  openMaterial(mat: { title: string; file_url?: string; file_path?: string }): void {
    const url = this.getFullUrl(mat);
    if (!url) return;

    if (this.isPdf(mat)) {
      this.activePdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
      this.activePdfTitle = mat.title;
      document.body.style.overflow = 'hidden'; // lock scroll behind overlay
      this.cdr.markForCheck();
    } else {
      window.open(url, '_blank');
    }
  }

  /** Returns a safe URL for PDF inline viewing */
  getPdfSafeUrl(mat: { file_url?: string; file_path?: string }): SafeResourceUrl {
    const url = this.getFullUrl(mat);
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  downloadMaterial(mat: { title: string; file_url?: string; file_path?: string }): void {
    const url = this.getFullUrl(mat);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = mat.title || 'download';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  }

  /** Returns the first PDF material from the active module (used as fallback when no video) */
  get firstModulePdf(): { title: string; file_url?: string; file_path?: string } | null {
    if (!this.activeModule?.materials?.length) return null;
    return this.activeModule.materials.find(m => this.isPdf(m)) ?? null;
  }
get completedModulesCount(): number {
  if (!this.course?.modules) return 0;
  return this.course.modules.filter((m) => m.is_completed).length;
}
  closePdfViewer(): void {
    this.activePdfUrl = null;
    this.activePdfTitle = null;
    document.body.style.overflow = '';
  }
}