import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { DataTable } from '../../../../shared/components/Data-table/data-table';
import { CustomColumnDirective } from '../../../../shared/components/Data-table/custom-column.directive';
import {
  SmartColumn,
  SmartTableConfig,
} from '../../../../shared/components/Data-table/data-table.types';

export type TrainingStatus =
  | 'SCHEDULED'
  | 'PENDING'
  | 'IN-PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type TrainingView =
  | 'all'
  | 'upcoming'
  | 'today'
  | 'history'
  | 'pending';

export interface TrainingRecord {
  id: string;
  title: string;
  customer: string;
  trainer: string;
  trainingType: string;
  mode: 'Online' | 'Offline';
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  meetingLink?: string;
  description?: string;
  participants: string[];
  status: TrainingStatus;
  rating?: number;
}

interface TrainingFormModel {
  customer: string;
  title: string;
  trainingType: string;
  mode: 'Online' | 'Offline';
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  meetingLink: string;
  description: string;
  participants: string;
  status: TrainingStatus;
}

interface StatCard {
  label: string;
  value: number;
  icon: string;
  view: TrainingView;
  valueClass: string;
  iconClass: string;
}

const EMPTY_FORM: TrainingFormModel = {
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
  selector: 'app-training',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DataTable,
    CustomColumnDirective,
  ],
  templateUrl: './training.html',
  styleUrl: './training.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Training {

  constructor(private readonly router: Router) {}

  readonly todayIso = new Date().toISOString().slice(0, 10);

  // =========================
  // Dropdown Data
  // =========================

  readonly customerOptions = [
    'ABC Industries',
    'XYZ Pvt Ltd',
    'Global Tech Corp',
    'Sunrise Healthcare',
  ];

  readonly trainerOptions = [
    'Jane Doe',
    'John Smith',
    'Mia Chen',
    'Sarah Wilson',
  ];

  readonly trainingTypeOptions = [
    'Platform Onboarding',
    'Advanced Reporting',
    'Admin Configuration',
    'Payroll Setup',
    'Leave Management',
  ];

  readonly statusOptions: TrainingStatus[] = [
    'SCHEDULED',
    'PENDING',
    'IN-PROGRESS',
    'COMPLETED',
    'CANCELLED',
  ];

  // =========================
  // Signals
  // =========================



  readonly formModel = signal<TrainingFormModel>({
    ...EMPTY_FORM,
  });

  readonly selectedTraining = signal<TrainingRecord | null>(null);

  readonly editingId = signal<string | null>(null);

  readonly selectedMaterials = signal<File[]>([]);

  readonly isCreateModalOpen = signal(false);

  readonly isEditModalOpen = signal(false);

  readonly isViewModalOpen = signal(false);

  readonly selectedView = signal<TrainingView>('upcoming');

  readonly searchTerm = signal('');

  readonly statusFilter =
    signal<TrainingStatus | 'ALL'>('ALL');

  readonly sortBy = signal<
    'date-desc' |
    'date-asc' |
    'customer' |
    'status'
  >('date-desc');

  // =========================
  // Computed
  // =========================

  readonly totalTrainings = computed(
    () => this.trainings().length
  );



  readonly filteredTrainings = computed(() => {

    let rows = [...this.trainings()];

    if (this.statusFilter() !== 'ALL') {
      rows = rows.filter(
        x => x.status === this.statusFilter()
      );
    }

    const keyword = this.searchTerm()
      .trim()
      .toLowerCase();

    if (keyword) {

      rows = rows.filter(row =>

        [
          row.customer,
          row.title,
          row.trainer,
          row.trainingType,
          row.status,
          row.description ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(keyword)

      );

    }

    switch (this.sortBy()) {

      case 'customer':
        rows.sort((a, b) =>
          a.customer.localeCompare(b.customer));
        break;

      case 'status':
        rows.sort((a, b) =>
          a.status.localeCompare(b.status));
        break;

      case 'date-asc':
        rows.sort((a, b) =>
          a.startDate.localeCompare(b.startDate));
        break;

      default:
        rows.sort((a, b) =>
          b.startDate.localeCompare(a.startDate));

    }

    return rows;

  });

  readonly upcomingTrainings = computed(() =>
    this.filteredTrainings().filter(
      x =>
        x.startDate > this.todayIso &&
        (
          x.status === 'SCHEDULED' ||
          x.status === 'PENDING'
        )
    )
  );

  readonly todaysTrainings = computed(() =>
    this.filteredTrainings().filter(
      x => x.startDate === this.todayIso
    )
  );

  readonly completedTrainings = computed(() =>
    this.filteredTrainings().filter(
      x => x.status === 'COMPLETED'
    )
  );

  readonly pendingTrainings = computed(() =>
    this.filteredTrainings().filter(
      x => x.status === 'PENDING'
    )
  );

  readonly trainingHistory = computed(() =>
    this.filteredTrainings().filter(
      x =>
        x.status === 'COMPLETED' ||
        x.startDate < this.todayIso
    )
  );

  readonly currentTableRows = computed(() => {

    switch (this.selectedView()) {

      case 'all':
        return this.filteredTrainings();

      case 'today':
        return this.todaysTrainings();

      case 'history':
        return this.trainingHistory();

      case 'pending':
        return this.pendingTrainings();

      default:
        return this.upcomingTrainings();

    }

  });

  // ======================================================
// Data Table Configuration
// ======================================================

readonly currentTableConfig = computed<SmartTableConfig<TrainingRecord>>(() => {

  let columns: SmartColumn<TrainingRecord>[] = [];

  switch (this.selectedView()) {

    case 'today':
      columns = [
        { key: 'customer', label: 'Customer' },
        { key: 'startTime', label: 'Time' },
        { key: 'meetingLink', label: 'Meeting Link' },
        { key: 'status', label: 'Status' },
        { key: 'actions', label: 'Action', align: 'right' },
      ];
      break;

    case 'history':
      columns = [
        { key: 'customer', label: 'Customer', sortable: true },
        { key: 'trainingType', label: 'Training Type', sortable: true },
        { key: 'trainer', label: 'Trainer', sortable: true },
        { key: 'startDate', label: 'Date', sortable: true },
        { key: 'status', label: 'Status' },
        { key: 'rating', label: 'Rating' },
        { key: 'actions', label: 'Action', align: 'right' },
      ];
      break;

    default:
      columns = [
        { key: 'customer', label: 'Customer', sortable: true },
        { key: 'trainer', label: 'Trainer', sortable: true },
        { key: 'startDate', label: 'Date', sortable: true },
        { key: 'startTime', label: 'Time' },
        { key: 'status', label: 'Status' },
        { key: 'actions', label: 'Action', align: 'right' },
      ];
  }

  return {
    columns,
    staticData: this.currentTableRows(),
    rowIdKey: 'id',
    showSearch: true,
    showFooter: false,
    showPagination: false,
    hasLoaded: true,
    clickable: false,
    emptyMessage: 'No training records found.',
  };

});

// ======================================================
// Header Cards
// ======================================================

// readonly statCards = computed(() => [

//   {
//     label: 'All Trainings',
//     value: this.totalTrainings(),
//     icon: 'total',
//     view: 'all',
//     valueClass: 'text-text-primary',
//     iconClass: 'stat-icon-brand',
//   },

//   {
//     label: 'Upcoming',
//     value: this.upcomingTrainings().length,
//     icon: 'upcoming',
//     view: 'upcoming',
//     valueClass: 'text-info',
//     iconClass: 'stat-icon-neutral',
//   },

//   {
//     label: 'Today',
//     value: this.todaysTrainings().length,
//     icon: 'today',
//     view: 'today',
//     valueClass: 'text-warning',
//     iconClass: 'stat-icon-warning',
//   },

//   {
//     label: 'Completed',
//     value: this.completedTrainings().length,
//     icon: 'completed',
//     view: 'history',
//     valueClass: 'text-success',
//     iconClass: 'stat-icon-success',
//   },

//   {
//     label: 'Pending',
//     value: this.pendingTrainings().length,
//     icon: 'pending',
//     view: 'pending',
//     valueClass: 'text-danger',
//     iconClass: 'stat-icon-neutral',
//   },

// ]);

  readonly statCards = computed<StatCard[]>(() => [
  {
    label: 'All Trainings',
    value: this.totalTrainings(),
    icon: 'total',
    view: 'all',
    valueClass: 'text-text-primary',
    iconClass: 'stat-icon-brand',
  },
  {
    label: 'Upcoming',
    value: this.upcomingTrainings().length,
    icon: 'upcoming',
    view: 'upcoming',
    valueClass: 'text-info',
    iconClass: 'stat-icon-neutral',
  },
  {
    label: 'Today',
    value: this.todaysTrainings().length,
    icon: 'today',
    view: 'today',
    valueClass: 'text-warning',
    iconClass: 'stat-icon-warning',
  },
  {
    label: 'Completed',
    value: this.completedTrainings().length,
    icon: 'completed',
    view: 'history',
    valueClass: 'text-success',
    iconClass: 'stat-icon-success',
  },
  {
    label: 'Pending',
    value: this.pendingTrainings().length,
    icon: 'pending',
    view: 'pending',
    valueClass: 'text-danger',
    iconClass: 'stat-icon-neutral',
  },
]);

// ======================================================
// Navigation
// ======================================================

navigateToDashboard(): void {
  this.router.navigate(['/dashboard']);
}

navigateToMyTraining(): void {
  this.router.navigate(['/trainings/my-training']);
}

// ======================================================
// Helpers
// ======================================================

selectTableView(view: TrainingView): void {
  this.selectedView.set(view);
}

getViewLabel(view: TrainingView): string {

  switch (view) {

    case 'all':
      return 'All Trainings';

    case 'today':
      return "Today's Trainings";

    case 'history':
      return 'Training History';

    case 'pending':
      return 'Pending Trainings';

    default:
      return 'Upcoming Trainings';

  }

}

// ======================================================
// Form Reset
// ======================================================

private resetForm(): void {

  this.formModel.set({
    ...EMPTY_FORM,
  });

  this.selectedMaterials.set([]);

}

// ======================================================
// Create Modal
// ======================================================

openCreateModal(): void {

  this.resetForm();

  this.isCreateModalOpen.set(true);

}

closeCreateModal(): void {

  this.resetForm();

  this.isCreateModalOpen.set(false);

}

// ======================================================
// Edit Modal
// ======================================================

openEditModal(training: TrainingRecord): void {

  this.editingId.set(training.id);

  this.formModel.set({

    customer: training.customer,
    title: training.title,
    trainingType: training.trainingType,
    mode: training.mode,
    startDate: training.startDate,
    endDate: training.endDate,
    startTime: training.startTime,
    endTime: training.endTime,
    meetingLink: training.meetingLink ?? '',
    description: training.description ?? '',
    participants: training.participants.join(', '),
    status: training.status,

  });

  this.isEditModalOpen.set(true);

}

closeEditModal(): void {

  this.editingId.set(null);

  this.resetForm();

  this.isEditModalOpen.set(false);

}

// ======================================================
// View Modal
// ======================================================

openViewModal(training: TrainingRecord): void {

  this.selectedTraining.set(training);

  this.isViewModalOpen.set(true);

}

closeViewModal(): void {

  this.selectedTraining.set(null);

  this.isViewModalOpen.set(false);

}

// ======================================================
// File Upload
// ======================================================

onMaterialsSelected(event: Event): void {

  const input = event.target as HTMLInputElement;

  if (!input.files) return;

  this.selectedMaterials.set(Array.from(input.files));

}

// ======================================================
// Create Training
// ======================================================

createTraining(): void {

  const form = this.formModel();

  if (!this.isFormValid(form)) {
    return;
  }

  const record: TrainingRecord = {
    id: `TR${Date.now()}`,
    title: form.title.trim(),
    customer: form.customer,
    trainer: this.trainerOptions[0],
    trainingType: form.trainingType,
    mode: form.mode,
    startDate: form.startDate,
    endDate: form.endDate,
    startTime: form.startTime,
    endTime: form.endTime,
    meetingLink: form.meetingLink.trim() || undefined,
    description: form.description.trim() || undefined,
    participants: form.participants
      .split(',')
      .map(x => x.trim())
      .filter(Boolean),
    status: form.status,
  };

  this.trainings.update(list => [
    record,
    ...list,
  ]);

  this.closeCreateModal();

}

// ======================================================
// Save Edit
// ======================================================

saveEdit(): void {

  const id = this.editingId();

  if (!id) {
    return;
  }

  const form = this.formModel();

  if (!this.isFormValid(form)) {
    return;
  }

  this.trainings.update(list =>
    list.map(item =>
      item.id === id
        ? {
            ...item,
            title: form.title.trim(),
            customer: form.customer,
            trainingType: form.trainingType,
            mode: form.mode,
            startDate: form.startDate,
            endDate: form.endDate,
            startTime: form.startTime,
            endTime: form.endTime,
            meetingLink: form.meetingLink.trim() || undefined,
            description: form.description.trim() || undefined,
            participants: form.participants
              .split(',')
              .map(x => x.trim())
              .filter(Boolean),
            status: form.status,
          }
        : item
    )
  );

  this.closeEditModal();

}

// ======================================================
// Delete
// ======================================================

deleteTraining(id: string): void {

  if (!confirm('Delete this training?')) {
    return;
  }

  this.trainings.update(list =>
    list.filter(x => x.id !== id)
  );

}

// ======================================================
// Status
// ======================================================

updateTrainingStatus(
  id: string,
  status: TrainingStatus
): void {

  this.trainings.update(list =>
    list.map(item =>
      item.id === id
        ? {
            ...item,
            status,
          }
        : item
    )
  );

}

startTraining(training: TrainingRecord): void {

  this.updateTrainingStatus(
    training.id,
    'IN-PROGRESS'
  );

}

completeTraining(training: TrainingRecord): void {

  this.trainings.update(list =>
    list.map(item =>
      item.id === training.id
        ? {
            ...item,
            status: 'COMPLETED',
            rating: item.rating ?? 5,
          }
        : item
    )
  );

}

// ======================================================
// Meeting
// ======================================================

joinMeeting(training: TrainingRecord): void {

  if (!training.meetingLink) {
    return;
  }

  window.open(
    training.meetingLink,
    '_blank',
    'noopener,noreferrer'
  );

}

// ======================================================
// Form
// ======================================================

updateFormField<
  K extends keyof TrainingFormModel
>(
  field: K,
  value: TrainingFormModel[K]
): void {

  this.formModel.update(form => ({
    ...form,
    [field]: value,
  }));

}

isFormValid(
  form: TrainingFormModel
): boolean {

  return !!(

    form.customer &&
    form.title.trim() &&
    form.trainingType &&
    form.startDate &&
    form.endDate &&
    form.startTime &&
    form.endTime

  );

}

isCreateFormValid(): boolean {

  return this.isFormValid(
    this.formModel()
  );

}

isEditFormValid(): boolean {

  return this.isFormValid(
    this.formModel()
  );

}

// ======================================================
// Status Badge
// ======================================================

getStatusBadgeClass(
  status: TrainingStatus
): string {

  const badge = {

    SCHEDULED:
      'badge badge-info',

    COMPLETED:
      'badge badge-success',

    'IN-PROGRESS':
      'badge badge-warning',

    PENDING:
      'badge badge-neutral',

    CANCELLED:
      'badge badge-danger',

  };

  return badge[status];

}

getStatusLabel(
  status: TrainingStatus
): string {

  const labels = {

    SCHEDULED: 'Scheduled',

    COMPLETED: 'Completed',

    'IN-PROGRESS': 'In Progress',

    PENDING: 'Pending',

    CANCELLED: 'Cancelled',

  };

  return labels[status];

}

// ======================================================
// Date
// ======================================================

formatDate(date: string): string {

  return new Date(
    date + 'T00:00:00'
  ).toLocaleDateString(
    'en-IN',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }
  );

}

formatTime(
  time: string
): string {

  if (!time) {
    return '';
  }

  const [h, m] =
    time.split(':').map(Number);

  const hour =
    h % 12 || 12;

  const period =
    h >= 12 ? 'PM' : 'AM';

  return `${hour}:${String(m).padStart(2, '0')} ${period}`;

}

readonly trainings = signal<TrainingRecord[]>([
  {
    id: 'TR001',
    title: 'Platform Onboarding',
    customer: 'ABC Industries',
    trainer: 'Jane Doe',
    trainingType: 'Platform Onboarding',
    mode: 'Online',
    startDate: '2026-08-05',
    endDate: '2026-08-05',
    startTime: '10:00',
    endTime: '11:30',
    meetingLink: 'https://meet.google.com/abc-001',
    description: 'Introduction to the platform.',
    participants: ['Rahul', 'Amit'],
    status: 'SCHEDULED',
    rating: 5,
  },
  {
    id: 'TR002',
    title: 'Admin Configuration',
    customer: 'XYZ Pvt Ltd',
    trainer: 'John Smith',
    trainingType: 'Admin Configuration',
    mode: 'Offline',
    startDate: '2026-08-06',
    endDate: '2026-08-06',
    startTime: '14:00',
    endTime: '15:30',
    meetingLink: '',
    description: 'Admin roles & permissions.',
    participants: ['Rohit', 'Vikas'],
    status: 'PENDING',
  },
  {
    id: 'TR003',
    title: 'Payroll Training',
    customer: 'Global Tech Corp',
    trainer: 'Mia Chen',
    trainingType: 'Payroll Setup',
    mode: 'Online',
    startDate: '2026-08-07',
    endDate: '2026-08-07',
    startTime: '11:00',
    endTime: '12:30',
    meetingLink: 'https://meet.google.com/pay-003',
    description: 'Payroll configuration.',
    participants: ['Neha', 'Priya'],
    status: 'IN-PROGRESS',
    rating: 4,
  },
  {
    id: 'TR004',
    title: 'Attendance Module',
    customer: 'Sunrise Healthcare',
    trainer: 'Sarah Wilson',
    trainingType: 'Advanced Reporting',
    mode: 'Offline',
    startDate: '2026-08-08',
    endDate: '2026-08-08',
    startTime: '09:30',
    endTime: '11:00',
    meetingLink: '',
    description: 'Attendance workflow.',
    participants: ['Deepak', 'Karan'],
    status: 'COMPLETED',
    rating: 5,
  },
  {
    id: 'TR005',
    title: 'Leave Management',
    customer: 'ABC Industries',
    trainer: 'Jane Doe',
    trainingType: 'Leave Management',
    mode: 'Online',
    startDate: '2026-08-10',
    endDate: '2026-08-10',
    startTime: '15:00',
    endTime: '16:00',
    meetingLink: 'https://meet.google.com/lv005',
    description: 'Leave approval workflow.',
    participants: ['Ankit', 'Suresh'],
    status: 'SCHEDULED',
  },
  {
    id: 'TR006',
    title: 'Employee Self Service',
    customer: 'XYZ Pvt Ltd',
    trainer: 'John Smith',
    trainingType: 'Platform Onboarding',
    mode: 'Online',
    startDate: '2026-08-11',
    endDate: '2026-08-11',
    startTime: '10:30',
    endTime: '12:00',
    meetingLink: 'https://meet.google.com/ess006',
    description: 'ESS portal training.',
    participants: ['Aakash', 'Riya'],
    status: 'PENDING',
  },
  {
    id: 'TR007',
    title: 'HR Workflow',
    customer: 'Global Tech Corp',
    trainer: 'Mia Chen',
    trainingType: 'Admin Configuration',
    mode: 'Offline',
    startDate: '2026-08-12',
    endDate: '2026-08-12',
    startTime: '13:00',
    endTime: '15:00',
    meetingLink: '',
    description: 'HR workflow setup.',
    participants: ['Mohit', 'Rakesh'],
    status: 'COMPLETED',
    rating: 4,
  },
  {
    id: 'TR008',
    title: 'Recruitment Module',
    customer: 'Sunrise Healthcare',
    trainer: 'Sarah Wilson',
    trainingType: 'Platform Onboarding',
    mode: 'Online',
    startDate: '2026-08-13',
    endDate: '2026-08-13',
    startTime: '16:00',
    endTime: '17:00',
    meetingLink: 'https://meet.google.com/rec008',
    description: 'Recruitment process.',
    participants: ['Kunal', 'Ajay'],
    status: 'IN-PROGRESS',
    rating: 3,
  },
  {
    id: 'TR009',
    title: 'Performance Review',
    customer: 'ABC Industries',
    trainer: 'Jane Doe',
    trainingType: 'Advanced Reporting',
    mode: 'Offline',
    startDate: '2026-08-14',
    endDate: '2026-08-14',
    startTime: '09:00',
    endTime: '10:30',
    meetingLink: '',
    description: 'Performance review module.',
    participants: ['Sanjay', 'Mukesh'],
    status: 'SCHEDULED',
  },
  {
    id: 'TR010',
    title: 'Final Assessment',
    customer: 'XYZ Pvt Ltd',
    trainer: 'John Smith',
    trainingType: 'Leave Management',
    mode: 'Online',
    startDate: '2026-08-15',
    endDate: '2026-08-15',
    startTime: '11:00',
    endTime: '12:00',
    meetingLink: 'https://meet.google.com/final010',
    description: 'Training assessment.',
    participants: ['Aman', 'Rohan'],
    status: 'COMPLETED',
    rating: 5,
  },
]);

}