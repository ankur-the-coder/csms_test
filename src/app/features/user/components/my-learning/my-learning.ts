import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CircularProgress } from '../circular-progress/circular-progress';
import { MyLearningCourse, MyLearningSummary } from '../../models/course.model';
import { Router } from '@angular/router';
import { LearnerCourseService } from '../../services/learner-course.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-my-learning',
  imports: [CommonModule, FormsModule, CircularProgress],
  templateUrl: './my-learning.html',
  styleUrl: './my-learning.css',
})
export class MyLearning implements OnInit {
  summary: MyLearningSummary | null = null;
  courses: MyLearningCourse[] = [];
  selectedCategory: string | null = null;
  loading = true;
  error = '';

  get categories(): string[] {
    const set = new Set<string>();
    this.courses.forEach(c => {
      if (c.category_name?.trim()) set.add(c.category_name.trim());
    });
    return Array.from(set).sort();
  }

  getFilteredCourses(): MyLearningCourse[] {
    if (!this.selectedCategory) return this.courses;
    return this.courses.filter(
      c => (c.category_name?.trim() || '') === this.selectedCategory
    );
  }

  // ── Dynamic stat counts (react to selected category) ──────
  get filteredTotal(): number {
    return this.getFilteredCourses().length;
  }

  get filteredCompleted(): number {
    return this.getFilteredCourses().filter(c => c.enrollment_status === 'completed').length;
  }

  get filteredInProgress(): number {
    return this.getFilteredCourses().filter(c => c.enrollment_status === 'in_progress').length;
  }

  get filteredNotStarted(): number {
    return this.getFilteredCourses().filter(c => c.enrollment_status === 'not_started').length;
  }

  get filteredCompletionPercent(): number {
    if (!this.filteredTotal) return 0;
    return Math.round((this.filteredCompleted / this.filteredTotal) * 100);
  }


  constructor(
    private learnerCourseService: LearnerCourseService,
    private router: Router,
    private cdr: ChangeDetectorRef  // ← needed because withFetch() runs outside Angular zone
  ) {}

  ngOnInit(): void {
    this.fetchMyLearning();
  }

  fetchMyLearning(): void {
    this.loading = true;
    this.error = '';

    this.learnerCourseService
      .getMyLearning()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res) => {
          try {
            this.summary = res?.summary ?? null;
            this.courses = res?.courses ?? [];
          } catch {
            this.error = 'Unexpected data format from server.';
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'Unable to load your learning data. Please try again.';
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

  actionLabel(status: string): string {
    if (status === 'completed') return 'Review';
    if (status === 'in_progress') return 'Continue';
    return 'Start';
  }

  goToCourse(course: MyLearningCourse): void {
    this.router.navigate(['/courses', course.id]);
  }
}
