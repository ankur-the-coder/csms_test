import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

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

@Component({
  selector: 'app-my-training',
  imports: [CommonModule],
  templateUrl: './my-training.html',
  styleUrl: './my-training.css',
})
export class MyTraining {

  activeTab = 'My Trainings';
  tabs = ['Dashboard', 'Trainers', 'Materials', 'Feedback', 'My Trainings'];
  organisation = 'ABC Industries';

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

}
