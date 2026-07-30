import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Trainers {
  id: string;
  name: string;
  email: string;
  avatar: string;
  avatarColor: string;
  description: string;
  skills: string[];
  workloadCapacity: number;
  assigned: number;
  rating: number;
}
@Component({
  selector: 'app-trainer',
  imports: [CommonModule],
  templateUrl: './trainer.html',
  styleUrl: './trainer.css',
})
export class Trainer {
  activeTab = 'Trainers';
  tabs = ['Dashboard', 'Trainers', 'Materials', 'Feedback', 'My Trainings'];

  trainers: Trainers[] = [
    {
      id: '1',
      name: 'Jane Doe',
      email: 'jane.doe@csms.com',
      avatar: 'JD',
      avatarColor: 'bg-purple-500',
      description: 'Senior training specialist with 8+ years of experience.',
      skills: ['HRMS', 'Onboarding', 'Payroll'],
      workloadCapacity: 90,
      assigned: 12,
      rating: 4.9,
    },
    {
      id: '2',
      name: 'John Smith',
      email: 'john.smith@csms.com',
      avatar: 'JS',
      avatarColor: 'bg-indigo-500',
      description: 'Technical trainer focused on integrations and advanced features.',
      skills: ['CRM', 'API Integration', 'Reporting'],
      workloadCapacity: 50,
      assigned: 8,
      rating: 4.7,
    },
    {
      id: '3',
      name: 'Priya Patel',
      email: 'priya.patel@csms.com',
      avatar: 'PP',
      avatarColor: 'bg-emerald-500',
      description: 'Design-focused trainer with industry expertise.',
      skills: ['UX Design', 'User Research'],
      workloadCapacity: 50,
      assigned: 5,
      rating: 4.8,
    },
  ];

  getCapacityColor(capacity: number): string {
    if (capacity >= 80) return 'bg-orange-500';
    if (capacity >= 50) return 'bg-emerald-500';
    return 'bg-blue-500';
  }

  getCapacityTextColor(capacity: number): string {
    if (capacity >= 80) return 'text-orange-600';
    if (capacity >= 50) return 'text-emerald-600';
    return 'text-blue-600';
  }

  editTrainer(trainer: Trainers): void {
    console.log('Edit trainer:', trainer);
    // Implement edit logic
  }

  deleteTrainer(trainerId: string): void {
    if (confirm('Are you sure you want to delete this trainer?')) {
      this.trainers = this.trainers.filter(t => t.id !== trainerId);
    }
  }

  addTrainer(): void {
    console.log('Add new trainer');
    // Implement add trainer logic (open modal, navigate to form, etc.)
  }
}