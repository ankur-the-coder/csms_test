import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Trainer } from '../../trainer/trainer';
import { TrainingMaterials } from '../../training-materials/training-materials';
import { MyTraining } from '../../my-training/my-training';

interface TrainingSession {
  id: string;
  sessionName: string;
  customer: string;
  trainer: string;
  date: string;
  time: string;
  mode: 'Online' | 'Offline';
  status: 'SCHEDULED' | 'COMPLETED' | 'IN-PROGRESS' | 'CANCELLED';
}

interface StatCard {
  label: string;
  value: number | string;
  badge?: string;
  badgeColor?: string;
}

@Component({
  selector: 'app-training',
  imports: [CommonModule, FormsModule, Trainer, TrainingMaterials, MyTraining],
  templateUrl: './training.html',
  styleUrl: './training.css',
})
export class Training {
   activeNavTab = 'Dashboard';
  activeFilterTab = 'All Sessions';
  searchQuery = '';
  viewMode: 'list' | 'calendar' = 'list';

  navTabs = ['Dashboard', 'Trainers', 'Materials', 'My Trainings'];
  filterTabs = ['All Sessions', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'];

  stats: StatCard[] = [
    { label: 'TOTAL TRAININGS', value: 3, badge: '+12%', badgeColor: 'green' },
    { label: 'COMPLETED', value: 1, badge: '81%', badgeColor: 'green' },
    { label: 'UPCOMING', value: 2, badge: 'Active', badgeColor: 'blue' },
    { label: "TODAY'S SESSIONS", value: 1, badge: 'Today', badgeColor: 'orange' },
    { label: 'CANCELLED', value: 0, badge: '-2%', badgeColor: 'red' },
  ];

  sessions: TrainingSession[] = [
    {
      id: 'TR001',
      sessionName: 'Platform Onboarding',
      customer: 'ABC Industries',
      trainer: 'Jane Doe',
      date: '2026-07-28',
      time: '10:00 AM',
      mode: 'Online',
      status: 'SCHEDULED',
    },
    {
      id: 'TR002',
      sessionName: 'Advanced Reporting',
      customer: 'XYZ Pvt Ltd',
      trainer: 'John Smith',
      date: '2026-07-29',
      time: '03:00 PM',
      mode: 'Offline',
      status: 'COMPLETED',
    },
    {
      id: 'TR003',
      sessionName: 'Admin Configuration',
      customer: 'ABC Industries',
      trainer: 'Jane Doe',
      date: '2026-07-25',
      time: '11:00 AM',
      mode: 'Online',
      status: 'IN-PROGRESS',
    },
  ];

  get filteredSessions(): TrainingSession[] {
    if (this.activeFilterTab === 'All Sessions') return this.sessions;
    const statusMap: Record<string, string> = {
      Scheduled: 'SCHEDULED',
      'In Progress': 'IN-PROGRESS',
      Completed: 'COMPLETED',
      Cancelled: 'CANCELLED',
    };
    return this.sessions.filter(
      (s) => s.status === statusMap[this.activeFilterTab]
    );
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'SCHEDULED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'COMPLETED':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'IN-PROGRESS':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'CANCELLED':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  }

  getBadgeColor(color: string): string {
    switch (color) {
      case 'green':
        return 'bg-green-50 text-green-700';
      case 'blue':
        return 'bg-blue-50 text-blue-700';
      case 'orange':
        return 'bg-orange-50 text-orange-700';
      case 'red':
        return 'bg-red-50 text-red-700';
      case 'purple':
        return 'bg-purple-50 text-purple-700';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  }

  getStatValueColor(index: number): string {
    switch (index) {
      case 0: return 'text-gray-900';
      case 1: return 'text-green-600';
      case 2: return 'text-blue-600';
      case 3: return 'text-orange-500';
      case 4: return 'text-red-500';
      case 5: return 'text-purple-600';
      default: return 'text-gray-900';
    }
  }

}
