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

export interface CategorySummary {
  name: string;
  totalCourses: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  progressPercent: number;
  colorBg: string;
  textColor: string;
  iconBg: string;
}

@Component({
  selector: 'app-course-catalog',
  imports: [CommonModule, CircularProgress, FilterByStatusPipe],
  templateUrl: './course-catalog.html',
  styleUrl: './course-catalog.css',
})
export class CourseCatalog implements OnInit {
  courses: CatalogCourse[] = [];
  categories: CategorySummary[] = [];
  selectedCategory: string | null = null;
  totalCourses = 0;
  loading = true;
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
            this.buildCategorySummaries();
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

  buildCategorySummaries(): void {
    const map = new Map<string, CatalogCourse[]>();
    for (const course of this.courses) {
      const catName = course.category_name?.trim() || 'General';
      if (!map.has(catName)) {
        map.set(catName, []);
      }
      map.get(catName)!.push(course);
    }

    const categoriesList: CategorySummary[] = [];
    const colorPairs = [
      { colorBg: 'from-emerald-500 to-teal-600', textColor: 'text-emerald-700', iconBg: 'bg-emerald-100 text-emerald-600' },
      { colorBg: 'from-blue-500 to-indigo-600', textColor: 'text-indigo-700', iconBg: 'bg-indigo-100 text-indigo-600' },
      { colorBg: 'from-purple-500 to-violet-600', textColor: 'text-purple-700', iconBg: 'bg-purple-100 text-purple-600' },
      { colorBg: 'from-amber-500 to-orange-600', textColor: 'text-amber-700', iconBg: 'bg-amber-100 text-amber-600' },
      { colorBg: 'from-rose-500 to-pink-600', textColor: 'text-pink-700', iconBg: 'bg-pink-100 text-pink-600' },
      { colorBg: 'from-cyan-500 to-blue-600', textColor: 'text-cyan-700', iconBg: 'bg-cyan-100 text-cyan-600' },
    ];

    let idx = 0;
    map.forEach((cList, catName) => {
      const colorScheme = colorPairs[idx % colorPairs.length];
      const totalCourses = cList.length;
      const completedCount = cList.filter((c) => c.enrollment_status === 'completed').length;
      const inProgressCount = cList.filter((c) => c.enrollment_status === 'in_progress').length;
      const notStartedCount = cList.filter((c) => c.enrollment_status === 'not_started').length;
      const avgProgress = Math.round(
        cList.reduce((sum, c) => sum + (c.progress_percent || 0), 0) / (totalCourses || 1)
      );

      categoriesList.push({
        name: catName,
        totalCourses,
        completedCount,
        inProgressCount,
        notStartedCount,
        progressPercent: avgProgress,
        ...colorScheme,
      });
      idx++;
    });

    this.categories = categoriesList;
  }

  selectCategory(categoryName: string | null): void {
    this.selectedCategory = categoryName;
  }

  getFilteredCourses(): CatalogCourse[] {
    if (!this.selectedCategory) {
      return this.courses;
    }
    return this.courses.filter(
      (c) => (c.category_name?.trim() || 'General') === this.selectedCategory
    );
  }

  getSelectedCategorySummary(): CategorySummary | undefined {
    return this.categories.find(c => c.name === this.selectedCategory);
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

