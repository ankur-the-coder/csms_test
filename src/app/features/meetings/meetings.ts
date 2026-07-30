import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Meeting {
  id: number;
  title: string;
  subtitle: string;
  customer: string;
  customerInitial: string;
  customerColor: string;
  type: string;
  date: string;
  time: string;
  owner: string;
  ownerInitial: string;
  priority: 'Low' | 'Medium' | 'High';
  status: 'Scheduled' | 'InProgress' | 'Pending' | 'Completed';
}

interface Activity {
  id: number;
  title: string;
  time: string;
  icon: string;
  iconBg: string;
  iconText: string;
}

@Component({
  selector: 'app-meetings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './meetings.html'
})
export class MeetingsComponent {
  // UI State
  activeView = 'table';
  timeRange = 'Week';
  showScheduleModal = false;
  showDetailDrawer = false;
  selectedMeeting: Meeting | null = null;

  // Mock Data
  meetings: Meeting[] = [
    { id: 1, title: 'Kickoff Meeting', subtitle: 'Project Introduction', customer: 'TechNova Solutions', customerInitial: 'T', customerColor: 'bg-indigo-500', type: 'Kickoff', date: 'May 20, 2025', time: '10:00 AM', owner: 'Rohit S.', ownerInitial: 'RS', priority: 'High', status: 'Scheduled' },
    { id: 2, title: 'Implementation Review', subtitle: 'Phase 1 Progress', customer: 'BrightWave LLC', customerInitial: 'B', customerColor: 'bg-amber-500', type: 'Review', date: 'May 20, 2025', time: '02:00 PM', owner: 'Anita P.', ownerInitial: 'AP', priority: 'Medium', status: 'Scheduled' },
    { id: 3, title: 'Training Planning', subtitle: 'User Training', customer: 'GreenLeaf Corp', customerInitial: 'G', customerColor: 'bg-emerald-500', type: 'Training', date: 'May 21, 2025', time: '11:00 AM', owner: 'Neha K.', ownerInitial: 'NK', priority: 'Medium', status: 'Scheduled' },
    { id: 4, title: 'QBR Meeting', subtitle: 'Quarterly Business Review', customer: 'InnoSoft Systems', customerInitial: 'I', customerColor: 'bg-purple-500', type: 'Qbr', date: 'May 22, 2025', time: '10:30 AM', owner: 'Rohit S.', ownerInitial: 'RS', priority: 'High', status: 'InProgress' },
    { id: 5, title: 'Go Live Readiness', subtitle: 'Final Checkpoint', customer: 'Alpha Digital', customerInitial: 'A', customerColor: 'bg-blue-500', type: 'Golive', date: 'May 23, 2025', time: '03:00 PM', owner: 'Anita P.', ownerInitial: 'AP', priority: 'High', status: 'Scheduled' },
    { id: 6, title: 'Renewal Discussion', subtitle: 'Plan for Renewal', customer: 'DataCore Inc.', customerInitial: 'D', customerColor: 'bg-rose-500', type: 'Renewal', date: 'May 26, 2025', time: '11:30 AM', owner: 'Rohit S.', ownerInitial: 'RS', priority: 'Medium', status: 'Pending' },
  ];

  activities: Activity[] = [
    { id: 1, title: 'Marketing Automation Discussion with TechNova Solutions completed', time: 'May 19, 2025 · 02:30 PM · Rohit Sharma', icon: '✓', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600' },
    { id: 2, title: 'Implementation Review with BrightWave LLC rescheduled', time: 'May 19, 2025 · 11:15 AM · Anita Patil', icon: '↻', iconBg: 'bg-amber-100', iconText: 'text-amber-600' },
    { id: 3, title: 'Training Planning with GreenLeaf Corp completed', time: 'May 18, 2025 · 04:00 PM · Neha Kapoor', icon: '✓', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600' },
    { id: 4, title: 'QBR Meeting agenda updated with 5 new items', time: 'May 18, 2025 · 10:20 AM · Rohit Sharma', icon: '📄', iconBg: 'bg-blue-100', iconText: 'text-blue-600' },
    { id: 5, title: 'Vikram Singh added to Kickoff Meeting attendees', time: 'May 17, 2025 · 03:45 PM · Rohit Sharma', icon: '', iconBg: 'bg-purple-100', iconText: 'text-purple-600' },
  ];

  meetingTypes = [
    { name: 'Kickoff', percentage: 30, color: 'bg-indigo-500' },
    { name: 'Review', percentage: 20, color: 'bg-purple-500' },
    { name: 'Training', percentage: 15, color: 'bg-emerald-500' },
    { name: 'QBR', percentage: 10, color: 'bg-amber-500' },
    { name: 'Renewal', percentage: 25, color: 'bg-rose-500' },
  ];

  // Form Model
  newMeeting = {
    title: '', customer: '', type: '', date: '', time: '', duration: '1 hour',
    priority: 'Medium', link: '', description: ''
  };

  customers = ['TechNova Solutions', 'BrightWave LLC', 'GreenLeaf Corp', 'InnoSoft Systems', 'Alpha Digital', 'DataCore Inc.'];
  meetingTypesList = ['Kickoff', 'Review', 'Training', 'QBR', 'Renewal', 'Go Live'];

  // Methods
  openScheduleModal() { this.showScheduleModal = true; }
  closeScheduleModal() { this.showScheduleModal = false; }
  viewMeeting(meeting: Meeting) { this.selectedMeeting = meeting; this.showDetailDrawer = true; }
  closeDetailDrawer() { this.showDetailDrawer = false; }
  saveMeeting() { this.closeScheduleModal(); }
}