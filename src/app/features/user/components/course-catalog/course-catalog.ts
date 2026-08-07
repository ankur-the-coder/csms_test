import { Component, OnInit, Pipe, PipeTransform, ChangeDetectorRef } from '@angular/core';
import { CircularProgress } from '../circular-progress/circular-progress';
import { CommonModule } from '@angular/common';
import { LearnerCourseService } from '../../services/learner-course.service';
import { CatalogCourse } from '../../models/course.model';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

@Pipe({ name: 'filterByStatus', standalone: true })
export class FilterByStatusPipe implements PipeTransform {
  transform(courses: CatalogCourse[], status: string): number {
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
  loading = false;
  error = '';

  constructor(
    private learnerCourseService: LearnerCourseService,
    private router: Router,
    private cdr: ChangeDetectorRef   // ← needed because withFetch() runs outside Angular zone
  ) {}

  ngOnInit(): void {
    this.fetchCatalog();
  }

  fetchCatalog(): void {
    this.loading = true;
    this.error = '';

    this.learnerCourseService
      .getCatalog()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck(); // force Angular to re-render
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

  statusLabel(status: string): string {
    if (status === 'completed') return 'Completed';
    if (status === 'in_progress') return 'In progress';
    return 'Not started';
  }

  statusClass(status: string): string {
    if (status === 'completed')   return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    if (status === 'in_progress') return 'bg-amber-50 text-amber-700 border border-amber-200';
    return 'bg-slate-100 text-slate-500 border border-slate-200';
  }

  openCourse(course: CatalogCourse): void {
    this.router.navigate(['/courses', course.id]);
  }
}
