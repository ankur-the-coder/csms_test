import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { signal } from '@angular/core';


interface Training {
  id: string;
  name: string;
  description: string;
  trainer: string;
  date: string;
  time: string;
  mode: 'Online' | 'Offline';
  status: 'SCHEDULED' | 'IN-PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

const EMPTY_FORM = {
  customer: '',
  title: '',
  trainingType: '',
  mode: 'Online',
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  meetingLink: '',
  description: '',
  participants: '',
  status: 'SCHEDULED',
};



@Component({
  selector: 'app-my-training',
  imports: [CommonModule, FormsModule],
  templateUrl: './my-training.html',
  styleUrl: './my-training.css',
})
export class MyTraining {
  [x: string]: any;




  activeTab = 'My Trainings';
  tabs = ['Dashboard', 'Trainers', 'Materials', 'Feedback', 'My Trainings'];
  organisation = 'ABC Industries';

  constructor(private router: Router) { }

  readonly isCreateModalOpen = signal(false);
  readonly selectedMaterials = signal<File[]>([]);

  navigateToMyTraining(): void {
    this.router.navigate(['/trainings/materials']);
  }

  navigateToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }



  trainings: Training[] = [
    {
      id: '1',
      name: 'Platform Onboarding',
      description: 'Basic platform navigation and setup.',
      trainer: 'Jane Doe',
      date: '2026-07-28',
      time: '10:00 AM',
      mode: 'Online',
      status: 'SCHEDULED',
    },
    {
      id: '2',
      name: 'Admin Configuration',
      description: 'Role setup and permissions.',
      trainer: 'Jane Doe',
      date: '2026-07-25',
      time: '11:00 AM',
      mode: 'Online',
      status: 'IN-PROGRESS',
    },
  ];

  readonly formModel = signal({
    ...EMPTY_FORM
  });



  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'SCHEDULED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'IN-PROGRESS':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'COMPLETED':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'CANCELLED':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  }

  joinSession(training: Training): void {
    console.log('Joining session:', training.name);
    // Implement join session logic (open video call, redirect, etc.)
  }

  viewMaterials(training: Training): void {
    console.log('Viewing materials for:', training.name);
    // Implement materials view logic
  }

  readonly statusOptions = [
    'SCHEDULED',
    'IN-PROGRESS',
    'COMPLETED',
    'CANCELLED'
  ] as const;

  readonly customerOptions = [
    'ABC Industries',
    'XYZ Pvt Ltd'
  ];

  readonly trainingTypeOptions = [
    'Platform Onboarding',
    'Admin Configuration'
  ];

  updateFormField(field: string, value: any): void {
    this.formModel.update(form => ({
      ...form,
      [field]: value
    }));
  }

  getStatusLabel(status: string): string {
    return status.replace('-', ' ');
  }

  onMaterialsSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (input.files) {
      this.selectedMaterials.set(Array.from(input.files));
    }
  }


  isCreateFormValid(): boolean {
    return true;
  }

  createTraining(): void {
    console.log(this.formModel());
    this.closeCreateModal();
  }


  openCreateModal(): void {
    this.formModel.set({ ...EMPTY_FORM });
    this.selectedMaterials.set([]);
    this.isCreateModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
    this.formModel.set({ ...EMPTY_FORM });
    this.selectedMaterials.set([]);
  }




}


