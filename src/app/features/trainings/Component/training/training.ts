import { Router } from '@angular/router';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TrainingService } from '../../services/Training/training';

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
}

@Component({
  selector: 'app-training',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './training.html',
  styleUrl: './training.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Training implements OnInit {

  private readonly router = inject(Router);
  private readonly trainingService = inject(TrainingService);

  ngOnInit(): void {
    this.loadCategories();
  }

  // =========================
  // Signals
  // =========================

  readonly categories = signal<CategoryRecord[]>([]);

  readonly isCategoryModalOpen = signal(false);

  readonly categoryName = signal('');

  readonly isSaving = signal(false);

  // =========================
  // API Calls
  // =========================

  loadCategories(): void {

    this.trainingService.getCategories().subscribe({

      next: (res: any) => {

        if (res.status) {

          this.categories.set(
            res.data.map((item: any) => ({
              id: item.id.toString(),
              name: item.name,
              slug: item.slug,
            }))
          );

        }

      },

      error: (err: any) => {
        console.error('Failed to load categories:', err);
      }

    });

  }

  createCategory(): void {

    const name = this.categoryName().trim();

    if (!name) {
      return;
    }

    this.isSaving.set(true);

    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const payload = { name, slug };

    this.trainingService.createCategory(payload).subscribe({

      next: (res: any) => {

        this.isSaving.set(false);

        // backend uses `msg` (not `message`) for this endpoint
        if (res.status) {
          this.closeCategoryModal();
          this.loadCategories();
        } else {
          console.error('Create category failed:', res.msg);
        }

      },

      error: (err: any) => {
        this.isSaving.set(false);
        console.error('Failed to create category:', err);
      }

    });

  }

  // =========================
  // Modal Controls
  // =========================

  openCategoryModal(): void {
    this.categoryName.set('');
    this.isCategoryModalOpen.set(true);
  }

  closeCategoryModal(): void {
    this.isCategoryModalOpen.set(false);
    this.categoryName.set('');
  }

  // =========================
  // Navigation
  // =========================

  navigateToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  goToCategoryMaterials(category: CategoryRecord): void {
    this.router.navigate(['/trainings/materials'], {
      queryParams: { categoryId: category.id, slug: category.slug },
    });
  }

}