import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CircularProgress } from '../circular-progress/circular-progress';
import { MyLearningCourse, MyLearningSummary } from '../../models/course.model';
import { Router } from '@angular/router';
import { LearnerCourseService } from '../../services/learner-course.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-my-learning',
  imports: [CommonModule, CircularProgress],
  templateUrl: './my-learning.html',
  styleUrl: './my-learning.css',
})
export class MyLearning implements OnInit {
  summary: MyLearningSummary | null = null;
  courses: MyLearningCourse[] = [];
  loading = true;
  error = '';

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

 statusLabel(status: number): string {
   if (status === 1) return 'Completed';      // 1 = completed
   if (status === 2) return 'In progress';     // 2 = in_progress
    return 'Not started';
  }

  statusClass(status: number): string {
    if (status === 1) return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    if (status === 2) return 'bg-amber-50 text-amber-700 border border-amber-200';
    return 'bg-slate-100 text-slate-500 border border-slate-200';
  }

 actionLabel(status: number): string {
    if (status === 1) return 'Review';
    if (status === 2) return 'Continue';
    return 'Start';
  }

  goToCourse(course: MyLearningCourse): void {
    this.router.navigate(['/courses', course.id]);
  }
}
