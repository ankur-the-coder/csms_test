import { Component, signal, computed, ViewChild, ElementRef } from '@angular/core';
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
  user: string;
  icon: string;
  iconBg: string;
  iconText: string;
}

interface AgendaItem {
  id: number;
  text: string;
  completed: boolean;
}

@Component({
  selector: 'app-meetings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './meetings.html',
  styles: [`
    .modal-overlay {
      backdrop-filter: blur(4px);
      animation: fadeIn 0.2s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slide-up {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .animate-slide-up {
      animation: slide-up 0.3s ease-out;
    }
    .chart-bar {
      transition: height 0.8s cubic-bezier(0.22, 1, 0.36, 1);
    }
  `]
})
export class MeetingsComponent {
  // ============ UI State ============
  activeView = 'table';
  timeRange = 'Week';
  searchTerm = '';
  showScheduleModal = false;
  showDetailDrawer = false;
  showFilters = false;
  showToast = false;
  toastMessage = '';
  refreshing = false;

  // Filter state
  filterType = '';
  filterPriority = '';
  filterStatus = '';
  activeFilters = 0;

  // Pagination
  currentPage = 1;
  pageSize = 6;

  // Sort state
  sortField = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Selection state
  selectedMeetings: Meeting[] = [];

  // Selected meeting for detail drawer
  selectedMeeting: Meeting | null = null;

  // ============ Mock Data ============
  meetings: Meeting[] = [
    { id: 1, title: 'Kickoff Meeting', subtitle: 'Project Introduction', customer: 'TechNova Solutions', customerInitial: 'T', customerColor: 'bg-indigo-500', type: 'Kickoff', date: '2025-05-20', time: '10:00 AM', owner: 'Rohit S.', ownerInitial: 'RS', priority: 'High', status: 'Scheduled' },
    { id: 2, title: 'Implementation Review', subtitle: 'Phase 1 Progress', customer: 'BrightWave LLC', customerInitial: 'B', customerColor: 'bg-amber-500', type: 'Review', date: '2025-05-20', time: '02:00 PM', owner: 'Anita P.', ownerInitial: 'AP', priority: 'Medium', status: 'InProgress' },
    { id: 3, title: 'Training Planning', subtitle: 'User Training Session', customer: 'GreenLeaf Corp', customerInitial: 'G', customerColor: 'bg-emerald-500', type: 'Training', date: '2025-05-21', time: '11:00 AM', owner: 'Neha K.', ownerInitial: 'NK', priority: 'Medium', status: 'Scheduled' },
    { id: 4, title: 'QBR Meeting', subtitle: 'Quarterly Business Review', customer: 'InnoSoft Systems', customerInitial: 'I', customerColor: 'bg-purple-500', type: 'QBR', date: '2025-05-22', time: '10:30 AM', owner: 'Rohit S.', ownerInitial: 'RS', priority: 'High', status: 'InProgress' },
    { id: 5, title: 'Go Live Readiness', subtitle: 'Final Deployment Check', customer: 'Alpha Digital', customerInitial: 'A', customerColor: 'bg-blue-500', type: 'Go Live', date: '2025-05-23', time: '03:00 PM', owner: 'Anita P.', ownerInitial: 'AP', priority: 'High', status: 'Scheduled' },
    { id: 6, title: 'Renewal Discussion', subtitle: 'Contract Renewal', customer: 'DataCore Inc.', customerInitial: 'D', customerColor: 'bg-rose-500', type: 'Renewal', date: '2025-05-26', time: '11:30 AM', owner: 'Rohit S.', ownerInitial: 'RS', priority: 'Medium', status: 'Pending' },
    { id: 7, title: 'Product Demo', subtitle: 'New Feature Showcase', customer: 'TechNova Solutions', customerInitial: 'T', customerColor: 'bg-indigo-500', type: 'Training', date: '2025-05-27', time: '01:00 PM', owner: 'Vikram S.', ownerInitial: 'VS', priority: 'Low', status: 'Scheduled' },
    { id: 8, title: 'Performance Review', subtitle: 'Project Performance', customer: 'BrightWave LLC', customerInitial: 'B', customerColor: 'bg-amber-500', type: 'Review', date: '2025-05-28', time: '09:00 AM', owner: 'Anita P.', ownerInitial: 'AP', priority: 'Medium', status: 'Scheduled' },
    { id: 9, title: 'Strategy Meeting', subtitle: 'Q3 Planning', customer: 'InnoSoft Systems', customerInitial: 'I', customerColor: 'bg-purple-500', type: 'Kickoff', date: '2025-05-29', time: '02:30 PM', owner: 'Rohit S.', ownerInitial: 'RS', priority: 'High', status: 'Pending' },
    { id: 10, title: 'Customer Workshop', subtitle: 'Hands-on Training', customer: 'GreenLeaf Corp', customerInitial: 'G', customerColor: 'bg-emerald-500', type: 'Training', date: '2025-05-30', time: '10:00 AM', owner: 'Neha K.', ownerInitial: 'NK', priority: 'Medium', status: 'Scheduled' },
    { id: 11, title: 'QBR Follow-up', subtitle: 'Action Items Review', customer: 'Alpha Digital', customerInitial: 'A', customerColor: 'bg-blue-500', type: 'Review', date: '2025-06-01', time: '11:00 AM', owner: 'Anita P.', ownerInitial: 'AP', priority: 'Low', status: 'Scheduled' },
    { id: 12, title: 'Renewal Negotiation', subtitle: 'Contract Terms', customer: 'DataCore Inc.', customerInitial: 'D', customerColor: 'bg-rose-500', type: 'Renewal', date: '2025-06-02', time: '03:30 PM', owner: 'Vikram S.', ownerInitial: 'VS', priority: 'High', status: 'Scheduled' },
    { id: 13, title: 'Implementation Kickoff', subtitle: 'Phase 2 Start', customer: 'TechNova Solutions', customerInitial: 'T', customerColor: 'bg-indigo-500', type: 'Kickoff', date: '2025-06-03', time: '09:30 AM', owner: 'Rohit S.', ownerInitial: 'RS', priority: 'High', status: 'Scheduled' },
    { id: 14, title: 'Progress Review', subtitle: 'Sprint Review', customer: 'BrightWave LLC', customerInitial: 'B', customerColor: 'bg-amber-500', type: 'Review', date: '2025-06-04', time: '01:00 PM', owner: 'Anita P.', ownerInitial: 'AP', priority: 'Medium', status: 'Completed' },
    { id: 15, title: 'Team Training', subtitle: 'New Tools Training', customer: 'GreenLeaf Corp', customerInitial: 'G', customerColor: 'bg-emerald-500', type: 'Training', date: '2025-06-05', time: '10:30 AM', owner: 'Neha K.', ownerInitial: 'NK', priority: 'Low', status: 'Scheduled' },
    { id: 16, title: 'Quarterly Review', subtitle: 'Q2 Performance', customer: 'InnoSoft Systems', customerInitial: 'I', customerColor: 'bg-purple-500', type: 'QBR', date: '2025-06-06', time: '02:00 PM', owner: 'Rohit S.', ownerInitial: 'RS', priority: 'High', status: 'Scheduled' },
    { id: 17, title: 'Go Live Support', subtitle: 'Post-deployment', customer: 'Alpha Digital', customerInitial: 'A', customerColor: 'bg-blue-500', type: 'Go Live', date: '2025-06-07', time: '09:00 AM', owner: 'Vikram S.', ownerInitial: 'VS', priority: 'Medium', status: 'Scheduled' },
    { id: 18, title: 'Renewal Planning', subtitle: 'Strategy Session', customer: 'DataCore Inc.', customerInitial: 'D', customerColor: 'bg-rose-500', type: 'Renewal', date: '2025-06-08', time: '11:30 AM', owner: 'Anita P.', ownerInitial: 'AP', priority: 'Medium', status: 'Pending' }
  ];

  activities: Activity[] = [
    { id: 1, title: 'Marketing Automation Discussion with TechNova Solutions completed', time: 'May 19, 2025 · 02:30 PM', user: 'Rohit Sharma', icon: 'fa-check', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600' },
    { id: 2, title: 'Implementation Review with BrightWave LLC rescheduled to May 22', time: 'May 19, 2025 · 11:15 AM', user: 'Anita Patil', icon: 'fa-undo-alt', iconBg: 'bg-amber-100', iconText: 'text-amber-600' },
    { id: 3, title: 'Training Planning with GreenLeaf Corp completed successfully', time: 'May 18, 2025 · 04:00 PM', user: 'Neha Kapoor', icon: 'fa-check', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600' },
    { id: 4, title: 'QBR Meeting agenda updated with 5 new discussion items', time: 'May 18, 2025 · 10:20 AM', user: 'Rohit Sharma', icon: 'fa-edit', iconBg: 'bg-blue-100', iconText: 'text-blue-600' },
    { id: 5, title: 'Vikram Singh added to Kickoff Meeting attendee list', time: 'May 17, 2025 · 03:45 PM', user: 'Rohit Sharma', icon: 'fa-user-plus', iconBg: 'bg-purple-100', iconText: 'text-purple-600' },
    { id: 6, title: 'New meeting scheduled: Product Demo with TechNova', time: 'May 17, 2025 · 01:30 PM', user: 'Vikram Singh', icon: 'fa-calendar-plus', iconBg: 'bg-indigo-100', iconText: 'text-indigo-600' },
    { id: 7, title: 'Renewal Discussion notes uploaded for DataCore Inc.', time: 'May 16, 2025 · 04:20 PM', user: 'Anita Patil', icon: 'fa-file-upload', iconBg: 'bg-amber-100', iconText: 'text-amber-600' }
  ];

  meetingTypes = [
    { name: 'Kickoff', percentage: 28, color: 'bg-indigo-500' },
    { name: 'Review', percentage: 22, color: 'bg-purple-500' },
    { name: 'Training', percentage: 18, color: 'bg-emerald-500' },
    { name: 'QBR', percentage: 12, color: 'bg-amber-500' },
    { name: 'Renewal', percentage: 20, color: 'bg-rose-500' }
  ];

  // Chart data
  chartData = [
    { height: 130 },
    { height: 100 },
    { height: 150 },
    { height: 70 },
    { height: 110 },
    { height: 40 },
    { height: 90 },
    { height: 130 }
  ];

  weekLabels = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];

  // Agenda items for detail drawer
  agendaItems: AgendaItem[] = [
    { id: 1, text: 'Welcome and introductions', completed: true },
    { id: 2, text: 'Project overview and goals', completed: true },
    { id: 3, text: 'Timeline and milestones', completed: true },
    { id: 4, text: 'Roles and responsibilities', completed: false },
    { id: 5, text: 'Next steps and Q&A session', completed: false }
  ];

  // Form Model
  newMeeting = {
    title: '',
    customer: '',
    type: '',
    date: '',
    time: '',
    duration: '1 hour',
    priority: 'Medium' as 'Low' | 'Medium' | 'High',
    host: '',
    link: '',
    description: ''
  };

  // Dropdown options
  customers = ['TechNova Solutions', 'BrightWave LLC', 'GreenLeaf Corp', 'InnoSoft Systems', 'Alpha Digital', 'DataCore Inc.', 'CloudSphere', 'DataVault'];
  meetingTypesList = ['Kickoff', 'Review', 'Training', 'QBR', 'Renewal', 'Go Live'];
  hosts = ['Rohit S.', 'Anita P.', 'Neha K.', 'Vikram S.', 'Priya M.', 'Amit R.'];

  // ============ Computed Properties ============

  getFilteredMeetings(): Meeting[] {
    let filtered = [...this.meetings];

    // Apply search
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(m =>
        m.title.toLowerCase().includes(term) ||
        m.customer.toLowerCase().includes(term) ||
        m.subtitle.toLowerCase().includes(term)
      );
    }

    // Apply filters
    if (this.filterType) {
      filtered = filtered.filter(m => m.type === this.filterType);
    }
    if (this.filterPriority) {
      filtered = filtered.filter(m => m.priority === this.filterPriority);
    }
    if (this.filterStatus) {
      filtered = filtered.filter(m => m.status === this.filterStatus);
    }

    // Apply sort
    if (this.sortField) {
      filtered.sort((a, b) => {
        let valA = a[this.sortField as keyof Meeting];
        let valB = b[this.sortField as keyof Meeting];

        if (typeof valA === 'string' && typeof valB === 'string') {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }

        if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Apply pagination
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return filtered.slice(start, end);
  }

  getTotalPages(): number {
    const total = this.meetings.length;
    return Math.ceil(total / this.pageSize);
  }

  getPageNumbers(): number[] {
    const total = this.getTotalPages();
    return Array.from({ length: Math.min(total, 5) }, (_, i) => i + 1);
  }

  // ============ Chart Helper Methods ============

  getLinePoints(): string {
    return this.chartData.map((data, i) =>
      `${65 + (i * 75)},${180 - data.height}`
    ).join(' ');
  }

  getChartPoints(): { x: number, y: number }[] {
    return this.chartData.map((data, i) => ({
      x: 65 + (i * 75),
      y: 180 - data.height
    }));
  }

  // ============ KPI Helper Methods ============

  getTodayMeetings(): number {
    const today = new Date().toISOString().split('T')[0];
    return this.meetings.filter(m => m.date === today && m.status !== 'Completed').length;
  }

  getYesterdayMeetings(): number {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    return this.meetings.filter(m => m.date === dateStr).length;
  }

  getTodayTrend(): number {
    const today = this.getTodayMeetings();
    const yesterday = this.getYesterdayMeetings();
    return yesterday === 0 ? 0 : Math.round(((today - yesterday) / yesterday) * 100);
  }

  getUpcomingMeetings(): number {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const todayStr = today.toISOString().split('T')[0];
    const nextWeekStr = nextWeek.toISOString().split('T')[0];
    return this.meetings.filter(m =>
      m.date >= todayStr && m.date <= nextWeekStr && m.status !== 'Completed'
    ).length;
  }

  getUpcomingTrend(): number {
    return 8;
  }

  getThisWeekMeetings(): number {
    const today = new Date();
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + 7 - today.getDay());
    const todayStr = today.toISOString().split('T')[0];
    const endStr = endOfWeek.toISOString().split('T')[0];
    return this.meetings.filter(m =>
      m.date >= todayStr && m.date <= endStr && m.status !== 'Completed'
    ).length;
  }

  getCompletedCount(): number {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split('T')[0];
    return this.meetings.filter(m =>
      m.date >= monthStartStr && m.status === 'Completed'
    ).length;
  }

  getCompletionRate(): number {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split('T')[0];
    const monthMeetings = this.meetings.filter(m => m.date >= monthStartStr);
    const completed = monthMeetings.filter(m => m.status === 'Completed').length;
    return monthMeetings.length === 0 ? 0 : Math.round((completed / monthMeetings.length) * 100);
  }

  getCompletionTrend(): number {
    return 24;
  }

  getPendingFollowUps(): number {
    return this.meetings.filter(m => m.status === 'Pending').length;
  }

  getFollowUpTrend(): number {
    return -3;
  }

  getOverdueCount(): number {
    const today = new Date().toISOString().split('T')[0];
    return this.meetings.filter(m =>
      m.date < today && m.status === 'Pending'
    ).length;
  }

  getTotalMeetings(): number {
    return this.meetings.length;
  }

  getWeeklyGrowth(): number {
    return 12;
  }

  // ============ Table Helper Methods ============

  getStatusDisplay(status: string): string {
    const map: { [key: string]: string } = {
      'InProgress': 'In Progress',
      'Scheduled': 'Scheduled',
      'Pending': 'Pending',
      'Completed': 'Completed'
    };
    return map[status] || status;
  }

  getTypeBadgeClass(type: string): string {
    const map: { [key: string]: string } = {
      'Kickoff': 'bg-indigo-50 text-indigo-700',
      'Review': 'bg-purple-50 text-purple-700',
      'Training': 'bg-emerald-50 text-emerald-700',
      'QBR': 'bg-amber-50 text-amber-700',
      'Go Live': 'bg-blue-50 text-blue-700',
      'Renewal': 'bg-rose-50 text-rose-700'
    };
    return map[type] || 'bg-slate-50 text-slate-700';
  }

  getPriorityBadgeClass(priority: string): string {
    const map: { [key: string]: string } = {
      'High': 'bg-red-50 text-red-700',
      'Medium': 'bg-amber-50 text-amber-700',
      'Low': 'bg-emerald-50 text-emerald-700'
    };
    return map[priority] || 'bg-slate-50 text-slate-700';
  }

  getStatusBadgeClass(status: string): string {
    const map: { [key: string]: string } = {
      'Scheduled': 'bg-blue-100 text-blue-700',
      'InProgress': 'bg-purple-100 text-purple-700',
      'Pending': 'bg-amber-100 text-amber-700',
      'Completed': 'bg-emerald-100 text-emerald-700'
    };
    return map[status] || 'bg-slate-100 text-slate-700';
  }

  getMeetingsByStatus(status: string): Meeting[] {
    return this.meetings.filter(m => m.status === status);
  }

  // ============ Calendar Helper Methods ============

  getCalendarDays(): { date: string, isToday: boolean }[] {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const days: { date: string, isToday: boolean }[] = [];

    // Add padding days from previous month
    const startPadding = firstDay.getDay();
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth, -i);
      days.push({ date: date.toISOString().split('T')[0], isToday: false });
    }

    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(currentYear, currentMonth, i);
      const dateStr = date.toISOString().split('T')[0];
      const isToday = dateStr === today.toISOString().split('T')[0];
      days.push({ date: dateStr, isToday });
    }

    // Add padding days from next month
    const endPadding = 42 - days.length; // 6 rows of 7
    for (let i = 1; i <= endPadding; i++) {
      const date = new Date(currentYear, currentMonth + 1, i);
      days.push({ date: date.toISOString().split('T')[0], isToday: false });
    }

    return days;
  }

  getMeetingsForDay(dateStr: string): Meeting[] {
    return this.meetings.filter(m => m.date === dateStr);
  }

  getEndTime(startTime: string): string {
    // Simple: add 1 hour
    const [hour, period] = startTime.split(' ');
    let [h, m] = hour.split(':').map(Number);
    h = (h % 12) + 1;
    return `${h}:${String(m).padStart(2, '0')} ${period}`;
  }

  getAttendees(): string[] {
    if (!this.selectedMeeting) return [];
    const base = [this.selectedMeeting.owner, this.selectedMeeting.customer];
    const others = ['Priya M.', 'Amit R.', 'Sneha K.'];
    return [...base, ...others.slice(0, 2)];
  }

  getDefaultAttendees(): string[] {
    return ['Rohit S.', 'Anita P.', 'Neha K.'];
  }

  // ============ Meeting Operations ============

  viewMeeting(meeting: Meeting): void {
    this.selectedMeeting = meeting;
    this.showDetailDrawer = true;
  }

  editMeeting(meeting: Meeting): void {
    this.showToastMessage(`Editing "${meeting.title}"...`);
    // Here you would open an edit modal
  }

  deleteMeeting(meeting: Meeting): void {
    if (confirm(`Are you sure you want to delete "${meeting.title}"?`)) {
      const index = this.meetings.indexOf(meeting);
      if (index > -1) {
        this.meetings.splice(index, 1);
        this.showToastMessage(`"${meeting.title}" deleted successfully`);
        if (this.showDetailDrawer) {
          this.closeDetailDrawer();
        }
      }
    }
  }

  // ============ Search and Filter ============

  applyFilters(): void {
    this.currentPage = 1;
    this.activeFilters = 0;
    if (this.filterType) this.activeFilters++;
    if (this.filterPriority) this.activeFilters++;
    if (this.filterStatus) this.activeFilters++;
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilters();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  clearFilters(): void {
    this.filterType = '';
    this.filterPriority = '';
    this.filterStatus = '';
    this.activeFilters = 0;
    this.applyFilters();
  }

  // ============ Sort ============

  sortBy(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    // Reset to first page when sorting
    this.currentPage = 1;
  }

  toggleSort(): void {
    if (!this.sortField) {
      this.sortField = 'date';
    } else {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    }
    this.currentPage = 1;
  }

  // ============ Pagination ============

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.getTotalPages()) {
      this.currentPage++;
    }
  }

  goToPage(page: number): void {
    this.currentPage = page;
  }

  // ============ View Toggles ============

  setActiveView(view: string): void {
    this.activeView = view;
    this.showToastMessage(`Switched to ${view} view`);
  }

  setTimeRange(range: string): void {
    this.timeRange = range;
    this.showToastMessage(`Viewing ${range} data`);
    // Update chart data based on range
    this.updateChartData(range);
  }

  updateChartData(range: string): void {
    // Simulate different data for different ranges
    if (range === 'Week') {
      this.chartData = [
        { height: 130 }, { height: 100 }, { height: 150 },
        { height: 70 }, { height: 110 }, { height: 40 },
        { height: 90 }, { height: 130 }
      ];
    } else if (range === 'Month') {
      this.chartData = [
        { height: 160 }, { height: 120 }, { height: 140 },
        { height: 90 }, { height: 130 }, { height: 60 },
        { height: 110 }, { height: 150 }
      ];
    } else {
      this.chartData = [
        { height: 180 }, { height: 140 }, { height: 160 },
        { height: 100 }, { height: 150 }, { height: 80 },
        { height: 130 }, { height: 170 }
      ];
    }
  }

  // ============ Selection ============

  isSelected(meeting: Meeting): boolean {
    return this.selectedMeetings.some(m => m.id === meeting.id);
  }

  toggleMeetingSelection(meeting: Meeting, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.checked) {
      this.selectedMeetings.push(meeting);
    } else {
      const index = this.selectedMeetings.indexOf(meeting);
      if (index > -1) {
        this.selectedMeetings.splice(index, 1);
      }
    }
  }

  toggleAllMeetings(event: Event): void {
    const input = event.target as HTMLInputElement;
    const currentPageMeetings = this.getFilteredMeetings();
    if (input.checked) {
      this.selectedMeetings = [...currentPageMeetings];
    } else {
      this.selectedMeetings = [];
    }
  }

  // ============ Modal Operations ============

  openScheduleModal(): void {
    this.showScheduleModal = true;
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    if (!this.newMeeting.date) {
      this.newMeeting.date = today;
    }
    // Set default host
    if (!this.newMeeting.host) {
      this.newMeeting.host = this.hosts[0];
    }
  }

  closeScheduleModal(): void {
    this.showScheduleModal = false;
    this.resetForm();
  }

  resetForm(): void {
    this.newMeeting = {
      title: '',
      customer: '',
      type: '',
      date: '',
      time: '',
      duration: '1 hour',
      priority: 'Medium',
      host: '',
      link: '',
      description: ''
    };
  }

  isFormValid(): boolean {
    return !!(this.newMeeting.title &&
      this.newMeeting.customer &&
      this.newMeeting.type &&
      this.newMeeting.date &&
      this.newMeeting.time &&
      this.newMeeting.host);
  }

  saveMeeting(): void {
    if (!this.isFormValid()) {
      this.showToastMessage('Please fill in all required fields');
      return;
    }

    const newId = Math.max(...this.meetings.map(m => m.id)) + 1;
    const customerInitial = this.newMeeting.customer[0].toUpperCase();
    const colorMap: { [key: string]: string } = {
      'TechNova Solutions': 'bg-indigo-500',
      'BrightWave LLC': 'bg-amber-500',
      'GreenLeaf Corp': 'bg-emerald-500',
      'InnoSoft Systems': 'bg-purple-500',
      'Alpha Digital': 'bg-blue-500',
      'DataCore Inc.': 'bg-rose-500'
    };
    const customerColor = colorMap[this.newMeeting.customer] || 'bg-slate-500';

    const newMeeting: Meeting = {
      id: newId,
      title: this.newMeeting.title,
      subtitle: this.newMeeting.description || 'New meeting',
      customer: this.newMeeting.customer,
      customerInitial: customerInitial,
      customerColor: customerColor,
      type: this.newMeeting.type,
      date: this.newMeeting.date,
      time: this.newMeeting.time,
      owner: this.newMeeting.host,
      ownerInitial: this.newMeeting.host.split(' ').map(n => n[0]).join(''),
      priority: this.newMeeting.priority,
      status: 'Scheduled'
    };

    // Add to meetings list
    this.meetings.push(newMeeting);

    // Add to activity log
    this.activities.unshift({
      id: Date.now(),
      title: `New meeting scheduled: "${this.newMeeting.title}" with ${this.newMeeting.customer}`,
      time: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      user: this.newMeeting.host,
      icon: 'fa-calendar-plus',
      iconBg: 'bg-indigo-100',
      iconText: 'text-indigo-600'
    });

    // Log to console
    console.log('📅 New Meeting Scheduled:');
    console.table({
      Title: this.newMeeting.title,
      Customer: this.newMeeting.customer,
      Type: this.newMeeting.type,
      Date: this.newMeeting.date,
      Time: this.newMeeting.time,
      Duration: this.newMeeting.duration,
      Priority: this.newMeeting.priority,
      Host: this.newMeeting.host,
      Link: this.newMeeting.link || 'Not provided',
      Description: this.newMeeting.description || 'None'
    });
    console.log('📋 Full meeting object:', newMeeting);

    this.showToastMessage(`✅ Meeting "${this.newMeeting.title}" scheduled successfully!`);
    this.closeScheduleModal();

    // Update meeting types distribution
    this.updateMeetingTypes();
  }

  saveAsDraft(): void {
    this.showToastMessage('Meeting saved as draft');
    this.closeScheduleModal();
  }

  updateMeetingTypes(): void {
    const total = this.meetings.length;
    const typeCount: { [key: string]: number } = {};
    this.meetings.forEach(m => {
      typeCount[m.type] = (typeCount[m.type] || 0) + 1;
    });
    this.meetingTypes = Object.keys(typeCount).map(key => ({
      name: key,
      percentage: Math.round((typeCount[key] / total) * 100),
      color: this.getMeetingTypeColor(key)
    }));
  }

  getMeetingTypeColor(type: string): string {
    const map: { [key: string]: string } = {
      'Kickoff': 'bg-indigo-500',
      'Review': 'bg-purple-500',
      'Training': 'bg-emerald-500',
      'QBR': 'bg-amber-500',
      'Renewal': 'bg-rose-500',
      'Go Live': 'bg-blue-500'
    };
    return map[type] || 'bg-slate-500';
  }

  // ============ Drawer Operations ============

  closeDetailDrawer(): void {
    this.showDetailDrawer = false;
    this.selectedMeeting = null;
  }

  toggleAgendaItem(item: AgendaItem): void {
    item.completed = !item.completed;
    const status = item.completed ? 'completed' : 'uncompleted';
    this.showToastMessage(`Agenda item "${item.text}" ${status}`);
  }

  // ============ Quick Actions ============

  inviteAttendees(): void {
    this.showToastMessage('Opening invite attendees dialog...');
  }

  createAgenda(): void {
    this.showToastMessage('Creating new agenda template...');
  }

  uploadNotes(): void {
    this.showToastMessage('Opening notes upload dialog...');
  }

  createFollowUp(): void {
    this.showToastMessage('Creating follow-up task...');
  }

  sendReminder(): void {
    this.showToastMessage('Sending reminders to participants...');
  }

  viewTodaySchedule(): void {
    this.showToastMessage('Loading today\'s schedule...');
  }

  viewUpcoming(): void {
    this.showToastMessage('Loading upcoming meetings...');
  }

  viewReport(): void {
    this.showToastMessage('Generating report...');
  }

  viewFollowUps(): void {
    this.showToastMessage('Loading follow-up items...');
  }

  viewAllActivities(): void {
    this.showToastMessage('Loading all activities...');
  }

  refreshData(): void {
    this.refreshing = true;
    this.showToastMessage('Refreshing data...');
    setTimeout(() => {
      this.refreshing = false;
      this.showToastMessage('Data refreshed successfully');
    }, 1000);
  }

  exportData(): void {
    this.showToastMessage('Exporting data...');
    // Simulate export
    const data = JSON.stringify(this.meetings, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meetings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
    this.showToastMessage('Data exported successfully');
  }

  shareDashboard(): void {
    this.showToastMessage('Sharing dashboard...');
  }

  // ============ Toast Notifications ============

  showToastMessage(message: string): void {
    this.toastMessage = message;
    this.showToast = true;
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.hideToast();
    }, 3000);
  }

  hideToast(): void {
    this.showToast = false;
  }

  private toastTimeout: any;
}