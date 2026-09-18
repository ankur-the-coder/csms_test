import { Router } from '@angular/router';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TrainingService } from '../../services/Training/training';
import { ToastrService } from 'ngx-toastr';

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  course_count: number;
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
  private readonly toastr = inject(ToastrService);

  ngOnInit(): void {
    this.loadCategories();
  }

  // =========================
  // Signals
  // =========================

  readonly categories = signal<CategoryRecord[]>([]);

  readonly isLoadingCategories = signal(false);
  readonly loadError = signal(false);

  readonly isCategoryModalOpen = signal(false);
  readonly editingCategoryId = signal<string | null>(null);

  readonly categoryName = signal('');

  readonly categoryError = signal<string | null>(null);

  readonly isSaving = signal(false);

  // Delete Confirmation Modal State
  readonly isDeleteConfirmOpen = signal(false);
  readonly isDeleting = signal(false);
  readonly deleteConfirmMessage = signal('');
  readonly deleteTargetCategory = signal<CategoryRecord | null>(null);

  readonly previewSlug = computed(() =>
    this.categoryName()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  );

  // =========================
  // API Calls
  // =========================

  loadCategories(): void {

    this.isLoadingCategories.set(true);
    this.loadError.set(false);

    this.trainingService.getCategories().subscribe({

      next: (res: any) => {

        this.isLoadingCategories.set(false);

        if (res.status) {

          this.categories.set(
            res.data.map((item: any) => ({
              id: item.id.toString(),
              name: item.name,
              slug: item.slug,
              course_count: item.course_count ?? 0,
            }))
          );

        } else {
          // API responded but indicated failure (e.g. status: false)
          this.categories.set([]);
          this.loadError.set(true);
          this.toastr.error(res.msg || 'Failed to load categories.', 'Error');
        }

      },

      error: (err: any) => {
        this.isLoadingCategories.set(false);
        this.categories.set([]);
        this.loadError.set(true);
        this.toastr.error('Failed to load categories. Please try again.', 'Server Error');
        console.error('Failed to load categories:', err);
      }

    });

  }

  saveCategory(): void {

    const name = this.categoryName().trim();

    if (!name) {
      this.toastr.warning('Please enter a category name.', 'Validation Warning');
      return;
    }

    this.isSaving.set(true);
    this.categoryError.set(null);

    const payload = { name, slug: this.previewSlug() };
    const editId = this.editingCategoryId();

    const request$ = editId
      ? this.trainingService.updateCategory(editId, payload)
      : this.trainingService.createCategory(payload);

    request$.subscribe({

      next: (res: any) => {

        this.isSaving.set(false);

        if (res.status) {
          if (editId) {
            this.toastr.success('Category updated successfully.', 'Success');
          } else {
            this.toastr.success('Category created successfully.', 'Success');
          }
          this.closeCategoryModal();
          this.loadCategories();
        } else {
          if (editId) {
            this.toastr.error('Failed to update category.', 'Error');
          } else {
            this.toastr.error('Failed to create category.', 'Error');
          }
          this.categoryError.set(res.msg || 'Something went wrong. Please try again.');
        }

      },

      error: (err: any) => {
        this.isSaving.set(false);
        if (editId) {
          this.toastr.error('Failed to update category due to a server error.', 'Server Error');
        } else {
          this.toastr.error('Failed to create category due to a server error.', 'Server Error');
        }
        this.categoryError.set('Failed to save category. Please try again.');
        console.error('Failed to save category:', err);
      }

    });

  }

  deleteCategory(category: CategoryRecord, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.deleteTargetCategory.set(category);
    this.deleteConfirmMessage.set(`Are you sure you want to delete category "${category.name}"?`);
    this.isDeleteConfirmOpen.set(true);
  }

  cancelDelete(): void {
    this.isDeleteConfirmOpen.set(false);
    this.isDeleting.set(false);
    this.deleteTargetCategory.set(null);
  }

  confirmDelete(): void {
    const category = this.deleteTargetCategory();
    if (!category) return;

    this.isDeleting.set(true);
    this.trainingService.deleteCategory(category.id).subscribe({
      next: (res: any) => {
        this.isDeleting.set(false);
        if (res.status) {
          this.toastr.success('Category deleted successfully.', 'Deleted');
          this.cancelDelete();
          this.loadCategories();
        } else {
          if (category.course_count && category.course_count > 0) {
            this.toastr.warning('Cannot delete category — it still contains courses.', 'Warning');
          } else {
            this.toastr.error(res.msg || 'Failed to delete category.', 'Error');
          }
          console.error('Failed to delete category:', res.msg);
          this.cancelDelete();
        }
      },
      error: (err: any) => {
        this.isDeleting.set(false);
        this.toastr.error('Failed to delete category due to a server error.', 'Server Error');
        console.error('Failed to delete category:', err);
        this.cancelDelete();
      }
    });
  }

  // =========================
  // Modal Controls
  // =========================

  openCategoryModal(): void {
    this.editingCategoryId.set(null);
    this.categoryName.set('');
    this.categoryError.set(null);
    this.isCategoryModalOpen.set(true);
  }

  openEditCategoryModal(category: CategoryRecord, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.editingCategoryId.set(category.id);
    this.categoryName.set(category.name);
    this.categoryError.set(null);
    this.isCategoryModalOpen.set(true);
  }

  closeCategoryModal(): void {
    this.isCategoryModalOpen.set(false);
    this.editingCategoryId.set(null);
    this.categoryName.set('');
    this.categoryError.set(null);
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