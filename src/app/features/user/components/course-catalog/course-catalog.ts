import { Component, OnInit, Pipe, PipeTransform, ChangeDetectorRef } from '@angular/core';
import { CircularProgress } from '../circular-progress/circular-progress';
import { CommonModule } from '@angular/common';
import { LearnerCourseService } from '../../services/learner-course.service';
import { CatalogCourse } from '../../models/course.model';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';

@Pipe({ name: 'filterByStatus', standalone: true })
export class FilterByStatusPipe implements PipeTransform {
  transform(courses: CatalogCourse[], status: number): number {
    return courses.filter((c) => c.enrollment_status === status).length;
  }
}

@Component({
  selector: 'app-course-catalog',
  imports: [CommonModule, CircularProgress, FilterByStatusPipe],
  templateUrl: './course-catalog.html',
  styleUrl: './course-catalog.css',
})
export class CourseCatalog implements OnInit {
  courses: CatalogCourse[] = [];
  totalCourses = 0;
  loading = true;
  error = '';

  private userId = '';
  private orgId = '';

  constructor(
    private learnerCourseService: LearnerCourseService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Read user_id and org_id from query params
    const qp = this.route.snapshot.queryParams;
    this.userId = qp['user_id'] ?? '';
    this.orgId = qp['org_id'] ?? '';
    this.fetchCatalog();
  }

  fetchCatalog(): void {
    this.loading = true;
    this.error = '';

    this.learnerCourseService
      .getCatalog(this.userId, this.orgId)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res) => {
          try {
            this.totalCourses = res?.totalCourses ?? 0;
            this.courses = (res?.courses ?? []).map((c) => ({
              ...c,
              code: 'CRS-' + String(c.id).padStart(3, '0'),
            }));
          } catch {
            this.error = 'Unexpected data format from server.';
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'Unable to load courses. Please check your connection and try again.';
          this.cdr.markForCheck();
        },
      });
  }

  statusLabel(status: number): string {
    if (status === 1) return 'Completed';
    if (status === 2) return 'In progress';
    return 'Not started';
  }

  statusClass(status: number): string {
    if (status === 1)   return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    if (status === 2) return 'bg-amber-50 text-amber-700 border border-amber-200';
    return 'bg-slate-100 text-slate-500 border border-slate-200';
  }

  openCourse(course: CatalogCourse): void {
    this.router.navigate(['/user/courses', course.id], {
      queryParams: { user_id: this.userId, org_id: this.orgId },
    });
  }
}
