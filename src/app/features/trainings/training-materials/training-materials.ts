import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Material {
  id: string;
  name: string;
  size: string;
  date: string;
  type: 'PDF' | 'PPT' | 'DOC' | 'MP4';
  module: string;
  category: string;
}

interface TrainingModuleOption {
  key: string;
  label: string;
}

@Component({
  selector: 'app-training-materials',
  imports: [CommonModule, FormsModule],
  templateUrl: './training-materials.html',
  styleUrl: './training-materials.css',
})
export class TrainingMaterials {
  activeTab = 'Materials';
  tabs = ['Dashboard', 'Trainers', 'Materials', 'Feedback', 'My Trainings'];

  selectedModule = 'employee';
  isUploadModalOpen = false;
  selectedFile: File | null = null;
  materialTitle = '';
  materialCategory = 'Onboarding Guide';

  trainingModules: TrainingModuleOption[] = [
    { key: 'employee', label: 'Employee' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'leave', label: 'Leave' },
    { key: 'salary', label: 'Salary' },
    { key: 'organization', label: 'Organization' },
    { key: 'timesheet', label: 'Timesheet' },
    { key: 'payroll', label: 'Payroll' },
  ];

  categories = ['Onboarding Guide', 'Process Document', 'Reference Material', 'Video Tutorial'];

  materials: Material[] = [
    {
      id: '1',
      name: 'HRMS_User_Guide.pdf',
      size: '2.4 MB',
      date: '2026-07-20',
      type: 'PDF',
      module: 'employee',
      category: 'Onboarding Guide',
    },
    {
      id: '2',
      name: 'Attendance_Process.pdf',
      size: '1.1 MB',
      date: '2026-07-18',
      type: 'PDF',
      module: 'attendance',
      category: 'Process Document',
    },
    {
      id: '3',
      name: 'Payroll_Module.pptx',
      size: '8.1 MB',
      date: '2026-07-15',
      type: 'PPT',
      module: 'payroll',
      category: 'Reference Material',
    },
  ];

  isDragOver = false;

  selectModule(moduleKey: string): void {
    this.selectedModule = moduleKey;
  }

  getSelectedModuleLabel(): string {
    return this.trainingModules.find((module) => module.key === this.selectedModule)?.label ?? 'Selected Module';
  }

  getVisibleMaterials(): Material[] {
    return this.materials.filter((material) => material.module === this.selectedModule);
  }

  openUploadModal(): void {
    this.isUploadModalOpen = true;
    this.resetUploadForm();
  }

  closeUploadModal(): void {
    this.isUploadModalOpen = false;
    this.resetUploadForm();
  }

  selectFile(files: FileList): void {
    if (!files || files.length === 0) {
      return;
    }
    this.selectedFile = files[0];
    this.materialTitle = this.materialTitle || files[0].name;
  }

  confirmUpload(): void {
    if (!this.selectedFile || !this.materialTitle.trim()) {
      return;
    }

    const extension = this.selectedFile.name.split('.').pop()?.toUpperCase() || 'PDF';
    const type = extension === 'PPTX' ? 'PPT' : (extension as Material['type']);

    const newMaterial: Material = {
      id: Date.now().toString(),
      name: this.materialTitle.trim(),
      size: this.formatFileSize(this.selectedFile.size),
      date: new Date().toISOString().split('T')[0],
      type,
      module: this.selectedModule,
      category: this.materialCategory,
    };

    this.materials = [newMaterial, ...this.materials];
    this.closeUploadModal();
  }

  addMaterial(material: Material): void {
    this.materials = [material, ...this.materials];
  }

  getTypeIconColor(type: string): string {
    switch (type) {
      case 'PDF':
        return 'bg-red-50 text-red-600 border-red-200';
      case 'PPT':
        return 'bg-orange-50 text-orange-600 border-orange-200';
      case 'DOC':
        return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'MP4':
        return 'bg-purple-50 text-purple-600 border-purple-200';
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

  handleFiles(files: FileList): void {
    this.selectFile(files);
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  uploadMaterial(): void {
    this.openUploadModal();
  }

  resetUploadForm(): void {
    this.selectedFile = null;
    this.materialTitle = '';
    this.materialCategory = 'Onboarding Guide';
    this.isDragOver = false;
  }

  deleteMaterial(id: string): void {
    if (confirm('Are you sure you want to delete this material?')) {
      this.materials = this.materials.filter((material) => material.id !== id);
    }
  }
}
  