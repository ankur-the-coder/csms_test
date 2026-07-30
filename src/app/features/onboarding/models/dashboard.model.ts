
export interface OnboardingCardData {
  status: boolean;
  data: CardData;
}

export interface CardData {
  totalOnboarded: number;
  completed: number;
  inProgress: number;
  notStarted: number;
}


export interface DataTablePayload {
  start: number;
  length: number;
  search: string;
  sorting: string;
  filter: string;
  tabSts: number;
}






export interface Onboarding {
  status: boolean;
  data: Datum[];
  meta: Meta;
}

export interface Datum {
  orgId: number;
  organization: string;
  onboardedDate: Date;
  csLead: string;
  health: Health;
  overallProgress: OverallProgress;
  modules: Modules;
}

export enum Health {
  Risk = "Risk",
}

export interface Modules {
  employee: Attendance;
  attendance: Attendance;
  leave: Attendance;
  salary: Attendance;
  organization: Attendance;
  timesheet: Attendance;
  payroll: Attendance;
  performance: Attendance;
}

export interface Attendance {
  completed: number;
  total: number;
}

export interface OverallProgress {
  approved: number;
  total: number;
  percentage: number;
}

export interface Meta {
  total: number;
  first_page: number;
}

