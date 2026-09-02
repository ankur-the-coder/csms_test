import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TrainingService } from '../../services/Training/training';
import { AuthService } from '../../../../core/services/auth-service';
import { Utils } from '../../../../shared/utils/utils';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

interface Material {
  id: string;
  name: string;
  size: string;
  date: string;
  type: string;
  module_id: string | null;
  file_path: string;
  safeUrl?: SafeResourceUrl;
}

interface CourseModule {
  id: string;
  title: string;
  description: string;
  video_url: string;
  safeVideoUrl?: SafeResourceUrl;
  pdfMaterial?: Material;
  materials: Material[];
}

interface Course {
  id: number;
  title: string;
  slug: string;
  description: string;
  category_id?: number;
}

interface CourseCategory {
  id: number;
  name: string;
  slug?: string;
}

@Component({
  selector: 'app-training-materials',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './training-materials.html',
  styleUrl: './training-materials.css',
})
export class TrainingMaterials implements OnInit {
  private readonly trainingService = inject(TrainingService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly authService = inject(AuthService);
  private readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);

  // Dynamic lists from backend
  courses = signal<Course[]>([]);
  categories = signal<CourseCategory[]>([]);

  selectedCourseId = signal<number | null>(null);
  courseModules = signal<CourseModule[]>([]);
  courseMaterials = signal<Material[]>([]); // Course level materials

  // Category context (from query params)
  categoryId = signal<number | null>(null);
  selectedCategory = signal<{ id: number; name: string; slug: string; course_count: number } | null>(null);

  // API Request States
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  isSavingCourse = signal<boolean>(false);
  isSavingModule = signal<boolean>(false);

  // Search / filter
  searchTerm = signal<string>('');
  filteredModules = computed<CourseModule[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const modules = this.courseModules();
    if (!term) return modules;
    return modules.filter((m) => m.title.toLowerCase().includes(term));
  });

  selectedCourseTitle = computed(() => {
    const courseId = this.selectedCourseId();
    if (courseId === null) return '';
    const course = this.courses().find(c => c.id === courseId);
    return course ? course.title : '';
  });

  // Delete Confirmation Modal State
  isDeleteConfirmOpen = signal<boolean>(false);
  isDeleting = signal<boolean>(false);
  deleteConfirmMessage = signal<string>('');
  private deleteTargetType: 'module' | 'material' | 'course' | null = null;
  private deleteTargetId: string | null = null;

  // ── Media Preview Modal ──────────────────────────────────────────────
  mediaModal = signal<{
    type: 'video' | 'pdf';
    url: SafeResourceUrl;
    title: string;
  } | null>(null);

  openMediaModal(type: 'video' | 'pdf', rawUrl: string, title: string): void {
    let safeUrl: SafeResourceUrl;
    if (type === 'video') {
      const videoId = this.extractYoutubeId(rawUrl);
      safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://www.youtube.com/embed/${videoId}?autoplay=1`
      );
    } else {
      safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(rawUrl);
    }
    this.mediaModal.set({ type, url: safeUrl, title });
  }

  closeMediaModal(): void {
    this.mediaModal.set(null);
  }

  // Modal / Form States
  isUploadModalOpen = false;
  isAddModuleModalOpen = false;
  editingModuleId: string | null = null;
  isAddCourseModalOpen = false;
  editingCourseId: number | null = null;
  selectedFile: File | null = null;
  materialTitle = '';
  materialCategory = 'pdf';
  targetModuleId: string | null = null;

  // New Module Form
  newModuleTitle = '';
  newModuleDescription = '';
  newModuleVideoUrl = '';
  newModuleFile: File | null = null;
  existingMaterialName = '';
  pdfRemoved = false;

  // New Course Form
  newCourseTitle = '';
  newCourseDescription = '';

  isDragOver = false;

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const catId = params.get('categoryId');

      if (catId) {
        this.categoryId.set(Number(catId));
        this.loadCategoryDetails(Number(catId));
      } else {
        this.categoryId.set(null);
        this.loadCourses();
      }
    });
  }

  loadCategoryDetails(id: number): void {
    this.loading.set(true);
    this.error.set(null);

    this.trainingService.getCategoryById(id).subscribe({
      next: (res: any) => {
        if (res.status && res.data) {
          this.selectedCategory.set(res.data);
        }

        this.loadCourses();
      },

      error: (err: any) => {
        this.loading.set(false);
        this.error.set('Unable to load category details.');
        console.error('Failed to load category', err);
      }
    });
  }

  loadCourses(): void {
    this.loading.set(true);
    this.error.set(null);

    const catId = this.categoryId() ?? undefined;

    this.trainingService.getCourses(catId).subscribe({
      next: (res) => {
        this.loading.set(false);

        if (res.status && res.data?.length > 0) {

          const sorted = [...res.data].sort(
            (a: Course, b: Course) => a.id - b.id
          );

          this.courses.set(sorted);
          this.selectedCourseId.set(null);
          this.courseModules.set([]);
          this.courseMaterials.set([]);

        } else {
          this.courses.set([]);
          this.selectedCourseId.set(null);
          this.courseModules.set([]);
          this.courseMaterials.set([]);
        }
      },

      error: (err) => {
        this.loading.set(false);
        this.error.set(
          'Unable to load courses. The backend service or API may be temporarily unavailable.'
        );
        console.error('Failed to load courses', err);
      }
    });
  }

  selectCourse(courseId: number | null): void {
    this.selectedCourseId.set(courseId);
    this.searchTerm.set(''); // Reset search when switching courses
    if (courseId !== null) {
      this.loadCourseDetails(courseId);
    } else {
      this.courseModules.set([]);
      this.courseMaterials.set([]);
    }
  }

  deleteModule(id: string): void {
    this.deleteTargetType = 'module';
    this.deleteTargetId = id;
    this.deleteConfirmMessage.set('Are you sure you want to delete this module and all its materials?');
    this.isDeleteConfirmOpen.set(true);
  }

  deleteMaterial(id: string): void {
    this.deleteTargetType = 'material';
    this.deleteTargetId = id;
    this.deleteConfirmMessage.set('Are you sure you want to delete this material?');
    this.isDeleteConfirmOpen.set(true);
  }

  cancelDelete(): void {
    this.isDeleteConfirmOpen.set(false);
    this.isDeleting.set(false);
    this.deleteTargetType = null;
    this.deleteTargetId = null;
  }

  confirmDelete(): void {
    if (!this.deleteTargetType || !this.deleteTargetId) return;

    this.isDeleting.set(true);

    if (this.deleteTargetType === 'module') {
      this.trainingService.deleteModule(Number(this.deleteTargetId)).subscribe({
        next: (res) => {
          this.isDeleting.set(false);
          if (res.status) {
            const courseId = this.selectedCourseId();
            if (courseId) this.loadCourseDetails(courseId);
          }
          this.cancelDelete();
        },
        error: (err) => {
          this.isDeleting.set(false);
          console.error('Failed to delete module', err);
          this.cancelDelete();
        }
      });
    } else if (this.deleteTargetType === 'material') {
      this.trainingService.deleteMaterial(Number(this.deleteTargetId)).subscribe({
        next: (res) => {
          this.isDeleting.set(false);
          if (res.status) {
            const courseId = this.selectedCourseId();
            if (courseId) this.loadCourseDetails(courseId);
          }
          this.cancelDelete();
        },
        error: (err) => {
          this.isDeleting.set(false);
          console.error('Failed to delete material', err);
          this.cancelDelete();
        }
      });
    } else if (this.deleteTargetType === 'course') {
      this.trainingService.deleteCourse(Number(this.deleteTargetId)).subscribe({
        next: (res) => {
          this.isDeleting.set(false);
          if (res.status) {
            this.loadCourses();
          }
          this.cancelDelete();
        },
        error: (err) => {
          this.isDeleting.set(false);
          console.error('Failed to delete course', err);
          this.cancelDelete();
        }
      });
    }
  }


  loadCourseDetails(courseId: number): void {
    this.trainingService.getCourseDetails(courseId, Number(this.authService.getEmpId())).subscribe({
      next: (res) => {
        if (res.status && res.data) {
          // Map backend modules to local models
          const mods = (res.data.modules || []).map((m: any, index: number) => {
            const rawModuleMaterials = m.materials || [];
            // Fallback: If it's the first module, also include any course-level materials (where module_id is null)
            const combinedMaterials = index === 0
              ? [...(res.data.materials || []), ...rawModuleMaterials]
              : rawModuleMaterials;

            const materialsList = combinedMaterials.map((mat: any) => {
              const ext = (mat.file_path || '').split('.').pop()?.toLowerCase() || '';
              const matType = ext === 'pdf' ? 'PDF' : ['jpg', 'jpeg', 'png'].includes(ext) ? 'IMAGE' : ext.toUpperCase();
              return {
                id: mat.id.toString(),
                name: mat.title,
                size: 'Unknown Size',
                date: mat.created_at ? mat.created_at.split('T')[0] : '',
                type: matType,
                module_id: m.id.toString(),
                file_path: mat.file_path,
                safeUrl: matType === 'PDF' ? this.sanitizer.bypassSecurityTrustResourceUrl(mat.file_path) : undefined
              };
            });

            // Find first PDF material to preview in the card
            const pdfMat = materialsList.find((mat: any) => mat.type === 'PDF');

            return {
              id: m.id.toString(),
              title: m.title,
              description: m.description || '',
              video_url: m.video_url || '',
              safeVideoUrl: m.video_url ? this.getSafeVideoUrl(m.video_url) : undefined,
              pdfMaterial: pdfMat,
              materials: materialsList
            };
          });
          this.courseModules.set(mods);

          // Course-level materials (not bound to modules)
          const mats = (res.data.materials || []).map((mat: any) => {
            const ext = (mat.file_path || '').split('.').pop()?.toLowerCase() || '';
            const matType = ext === 'pdf' ? 'PDF' : ['jpg', 'jpeg', 'png'].includes(ext) ? 'IMAGE' : ext.toUpperCase();
            return {
              id: mat.id.toString(),
              name: mat.title,
              size: 'Unknown Size',
              date: mat.created_at ? mat.created_at.split('T')[0] : '',
              type: matType,
              module_id: null,
              file_path: mat.file_path
            };
          });
          this.courseMaterials.set(mats);
        }
      },
      error: (err) => console.error('Failed to load course details', err)
    });
  }

  openUploadModal(moduleId: string | null = null): void {
    this.targetModuleId = moduleId;
    this.isUploadModalOpen = true;
    this.resetUploadForm();
  }

  closeUploadModal(): void {
    this.isUploadModalOpen = false;
    this.resetUploadForm();
  }

  openAddModuleModal(module?: CourseModule): void {
    this.isAddModuleModalOpen = true;
    this.newModuleFile = null;
    this.pdfRemoved = false;

    if (module) {
      // Edit mode - populate form with existing values saved for that session/module
      this.editingModuleId = module.id;
      this.newModuleTitle = module.title || '';
      this.newModuleDescription = module.description || '';
      this.newModuleVideoUrl = module.video_url || '';

      if (module.materials && module.materials.length > 0) {
        this.existingMaterialName = module.materials.map(m => m.name).join(', ');
      } else if (module.pdfMaterial) {
        this.existingMaterialName = module.pdfMaterial.name;
      } else {
        this.existingMaterialName = '';
      }
    } else {
      // Add mode - empty form
      this.editingModuleId = null;
      this.newModuleTitle = '';
      this.newModuleDescription = '';
      this.newModuleVideoUrl = '';
      this.existingMaterialName = '';
    }
  }

  removePdf(): void {
    this.newModuleFile = null;
    this.existingMaterialName = '';
    this.pdfRemoved = true;
  }

  closeAddModuleModal(): void {
    this.isAddModuleModalOpen = false;
    this.isSavingModule.set(false);
    this.editingModuleId = null;
    this.newModuleTitle = '';
    this.newModuleDescription = '';
    this.newModuleVideoUrl = '';
    this.newModuleFile = null;
    this.existingMaterialName = '';
    this.pdfRemoved = false;
  }

  openAddCourseModal(): void {
    this.isAddCourseModalOpen = true;
    this.editingCourseId = null;
    this.newCourseTitle = '';
    this.newCourseDescription = '';
  }

  openEditCourseModal(course: Course): void {
    this.isAddCourseModalOpen = true;
    this.editingCourseId = course.id;
    this.newCourseTitle = course.title || '';
    this.newCourseDescription = course.description || '';
  }

  closeAddCourseModal(): void {
    this.isAddCourseModalOpen = false;
    this.isSavingCourse.set(false);
    this.editingCourseId = null;
  }

  requestDeleteCourse(course: Course): void {
    this.deleteTargetType = 'course';
    this.deleteTargetId = course.id.toString();
    this.deleteConfirmMessage.set(`Are you sure you want to delete the course "${course.title}" and all its sessions?`);
    this.isDeleteConfirmOpen.set(true);
  }

  selectFile(files: FileList): void {
    if (!files || files.length === 0) return;
    this.selectedFile = files[0];
    this.materialTitle = this.materialTitle || files[0].name;
  }

  confirmUpload(): void {
    const courseId = this.selectedCourseId();
    if (!courseId || !this.selectedFile || !this.materialTitle.trim()) return;

    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('title', this.materialTitle.trim());
    formData.append('course_id', courseId.toString());
    formData.append('uploaded_by', Utils.encode5t(this.authService.getEmpId()));
    if (this.targetModuleId) {
      formData.append('module_id', this.targetModuleId);
    }

    this.trainingService.uploadMaterial(formData).subscribe({
      next: (res) => {
        if (res.status) {
          this.loadCourseDetails(courseId);
          this.closeUploadModal();
        }
      },
      error: (err) => console.error('Material upload failed', err)
    });
  }

  addCourse(): void {
    if (!this.newCourseTitle.trim()) return;

    this.isSavingCourse.set(true);

    const payload = {
      title: this.newCourseTitle.trim(),
      description: this.newCourseDescription.trim(),
      category_id: this.categoryId() ?? 1,
      created_by: Number(this.authService.getEmpId()),
      status: 'published'
    };

    if (this.editingCourseId) {
      // UPDATE MODE
      this.trainingService.updateCourse(this.editingCourseId, payload).subscribe({
        next: (res) => {
          this.isSavingCourse.set(false);
          if (res.status) {
            this.loadCourses();
            this.closeAddCourseModal();
          }
        },
        error: (err) => {
          this.isSavingCourse.set(false);
          console.error('Failed to update course', err);
        }
      });
    } else {
      // CREATE MODE
      this.trainingService.createCourse(payload).subscribe({
        next: (res) => {
          this.isSavingCourse.set(false);
          if (res.status && res.data) {
            this.loadCourses();
            this.closeAddCourseModal();
          }
        },
        error: (err) => {
          this.isSavingCourse.set(false);
          console.error('Failed to create course', err);
        }
      });
    }
  }

  onNewModuleFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.newModuleFile = input.files[0];
      this.pdfRemoved = false;
    }
  }

  addModule(): void {
    const courseId = this.selectedCourseId();

    if (!courseId || !this.newModuleTitle.trim()) {
      return;
    }

    this.isSavingModule.set(true);

    const empId = this.authService.getEmpId();
    const encodedUser = Utils.encode5t(empId);

    const formData = new FormData();
    formData.append('title', this.newModuleTitle.trim());
    formData.append('description', this.newModuleDescription.trim());
    formData.append('video_url', this.newModuleVideoUrl.trim());
    formData.append('course_id', courseId.toString());
    formData.append('updated_by', encodedUser);

    if (this.editingModuleId) {
      formData.append('module_id', this.editingModuleId.toString());

      if (this.newModuleFile) {
        formData.append('attachment', '1');
        formData.append('file', this.newModuleFile);
      } else if (this.pdfRemoved) {
        formData.append('attachment', '0');
        formData.append('file', '');
      } else {
        // Attachment unchanged
        formData.append('file', '');
      }

      this.trainingService.updateModule(Number(this.editingModuleId), formData).subscribe({
        next: (res: any) => {
          this.isSavingModule.set(false);
          if (res.status) {
            this.loadCourseDetails(courseId);
            this.closeAddModuleModal();
          }
        },
        error: (err: any) => {
          this.isSavingModule.set(false);
          console.error('Failed to update module', err);
        }
      });
      return;
    }

    // ADD MODE
    formData.append('sort_order', this.courseModules().length.toString());

    if (this.newModuleFile) {
      formData.append('attachment', '1');
      formData.append('file', this.newModuleFile);
    } else {
      formData.append('attachment', '0');
      formData.append('file', '');
    }

    this.trainingService.createModule(courseId, formData).subscribe({
      next: (res: any) => {
        this.isSavingModule.set(false);
        if (res.status) {
          this.loadCourseDetails(courseId);
          this.closeAddModuleModal();
        }
      },
      error: (err: any) => {
        this.isSavingModule.set(false);
        console.error('Failed to create module', err);
      }
    });
  }

  // deleteModule(id: string): void {
  //   if (confirm('Are you sure you want to delete this module and all its materials?')) {
  //     this.trainingService.deleteModule(Number(id)).subscribe({
  //       next: (res) => {
  //         if (res.status) {
  //           const courseId = this.selectedCourseId();
  //           if (courseId) this.loadCourseDetails(courseId);
  //         }
  //       },
  //       error: (err) => console.error('Failed to delete module', err)
  //     });
  //   }
  // }

  getSafeVideoUrl(url: string): SafeResourceUrl {
    const videoId = this.extractYoutubeId(url);
    return this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${videoId}`);
  }

  extractYoutubeId(url: string): string {
    if (!url) return '';
    const match = url.match(/(?:youtu\.be\/|v=|\/embed\/)([^&?#/]+)/);
    return match ? match[1] : '';
  }

  getTypeIconColor(type: string): string {
    switch (type) {
      case 'PDF':
        return 'bg-red-50 text-red-600 border-red-200';
      case 'IMAGE':
      case 'JPG':
      case 'PNG':
      case 'JPEG':
        return 'bg-blue-50 text-blue-600 border-blue-200';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.selectFile(files);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectFile(input.files);
    }
  }

  resetUploadForm(): void {
    this.selectedFile = null;
    this.materialTitle = '';
    this.isDragOver = false;
  }

  goBack(): void {
    this.location.back();
  }


}
