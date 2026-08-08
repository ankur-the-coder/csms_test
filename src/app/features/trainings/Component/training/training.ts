import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TrainingService } from '../../services/Training/training';
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
  organization: string;
  contactPerson: string;
  email: string;
  phone: string;
  supportOwner: string;
  leadOwner: string;
  stage: string;
  createdDate: string;
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
export class Training implements OnInit {

  private readonly trainingService = inject(TrainingService);

  constructor(
    private readonly router: Router
  ) { }

  ngOnInit(): void {
    this.loadTrainingData();
  }

  loadTrainingData(): void {

    const payload = {
      start: 0,
      length: 10,
      search: "",
      sorting: "",
      filter: "",
      tabSts: 0,
    };

    this.trainingService.trainingTable(payload).subscribe({

      next: (res) => {

        if (res.status) {

        this.trainings.set(
  res.data.map((item: any) => ({
    id: item.id.toString(),
    organization: item.organization,
    contactPerson: item.contactPerson,
    email: item.email,
    phone: item.phone,
    supportOwner: item.supportOwner,
    leadOwner: item.leadOwner,
    stage: item.stage,
    createdDate: item.createdDate,
  }))
);

        }

      },

      error: (err: any) => {

        console.error("Training API Error:", err);

      }

    });

  }



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

  const keyword = this.searchTerm()
    .trim()
    .toLowerCase();

  if (!keyword) {
    return this.trainings();
  }

  return this.trainings().filter(row =>

    [
      row.organization,
      row.contactPerson,
      row.email,
      row.phone,
      row.supportOwner,
      row.leadOwner,
      row.stage,
    ]
      .join(" ")
      .toLowerCase()
      .includes(keyword)

  );

});

  // readonly upcomingTrainings = computed(() =>
  //   this.filteredTrainings().filter(
  //     x =>
  //       x.startDate > this.todayIso &&
  //       (
  //         x.status === 'SCHEDULED' ||
  //         x.status === 'PENDING'
  //       )
  //   )
  // );

  // readonly todaysTrainings = computed(() =>
  //   this.filteredTrainings().filter(
  //     x => x.startDate === this.todayIso
  //   )
  // );

  // readonly completedTrainings = computed(() =>
  //   this.filteredTrainings().filter(
  //     x => x.status === 'COMPLETED'
  //   )
  // );

  // readonly pendingTrainings = computed(() =>
  //   this.filteredTrainings().filter(
  //     x => x.status === 'PENDING'
  //   )
  // );

  // readonly trainingHistory = computed(() =>
  //   this.filteredTrainings().filter(
  //     x =>
  //       x.status === 'COMPLETED' ||
  //       x.startDate < this.todayIso
  //   )
  // );

  // readonly currentTableRows = computed(() => {

  //   switch (this.selectedView()) {

  //     case 'all':
  //       return this.filteredTrainings();

  //     case 'today':
  //       return this.todaysTrainings();

  //     case 'history':
  //       return this.trainingHistory();

  //     case 'pending':
  //       return this.pendingTrainings();

  //     default:
  //       return this.upcomingTrainings();

  //   }

  // });

  // ======================================================
  // Data Table Configuration
  // ======================================================

 readonly currentTableConfig = computed<SmartTableConfig<TrainingRecord>>(() => {

  return {

    columns: [

      {
        key: 'organization',
        label: 'Organization Name',
        sortable: true,
      },

      {
        key: 'contactPerson',
        label: 'Contact Person',
        sortable: true,
      },

      {
        key: 'email',
        label: 'Email',
        sortable: true,
      },

      {
        key: 'phone',
        label: 'Phone',
      },

      {
        key: 'supportOwner',
        label: 'Support Owner',
        sortable: true,
      },

      {
        key: 'leadOwner',
        label: 'Lead Owner',
        sortable: true,
      },

      {
        key: 'stage',
        label: 'Stage',
        sortable: true,
      },

      {
        key: 'createdDate',
        label: 'Created Date',
        sortable: true,
      },

    ],

    staticData: this.trainings(),

    rowIdKey: 'id',

    showSearch: true,

    showPagination: true,

    showFooter: true,

    hasLoaded: true,

    clickable: false,

    emptyMessage: 'No organization found.',

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

  // readonly statCards = computed<StatCard[]>(() => [
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

  // ======================================================
  // Navigation
  // ======================================================

  navigateToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

 navigateToMyTraining(): void {
    this.router.navigate(['/trainings/materials']);
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


  readonly trainings = signal<TrainingRecord[]>([

  ]);

}