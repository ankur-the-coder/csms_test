export interface Data {
  totalClients: number;
  liveClients: number;
  implPending: number;
  trainingPending: number;
  meeting: number;
  connect: number;
}

export interface DashboardCardCount {
  data: Data;
  status: boolean;
  msg: string;
}
export interface DashboardChartdata {
  data: ChartData[];
  status: boolean;
  msg: string;
  total?: ChartTotal;
}


export interface ChartData {
  label: string;
  value: number;
}
export interface ChartTotal {
  line1: number;
  line2: string;
  line3: string;
}

// ── Calendar API ─────────────────────────────────────────────────────────────
export interface CalendarMeeting {
  Id: number;
  OrgId: number;
  OrgName: string;
  EmpId: number;
  Title: string;
  Purpose: string;
  MeetingType: string;
  StartTime: string;  // "HH:MM" (time)
  EndTime: string;    // "YYYY-MM-DD" (date — API quirk)
  Duration: string;   // "HH:MM:SS.ffffff"
  Status: number;
  WasHeld: boolean | null;
}

export interface PendingTraining {
  id: number;
  user_id: number;
  Name: string;
  course_id: number;
  status: number;
  progress_percent: number;
  enrolled_at: string;
  courseName: string;
  OrgName: string;
  last_accessed_at: string;
}

/** Inner payload nested under `data` in the API response. */
export interface CalendarData {
  meetings: CalendarMeeting[];
  meetingCount: number;
  pendingTraining: PendingTraining[];
  pendingTrainingCount: number;
}

/** Top-level API response wrapper for /fetchDashBoardCalendar. */
export interface CalendarApiResponse {
  data: CalendarData;
  status: boolean;
  msg: string;
}

//*************************//
export interface DashboardUsageChartdata {
    status:              boolean;
    modules:             Modules;
    organizationDetails: OrganizationDetails;
    overall:             Overall;
}

export interface Modules {
    employee:     Overall;
    attendance:   Overall;
    leave:        Overall;
    salary:       Overall;
    organization: Overall;
    performance:  Overall;
    timesheet:    Overall;
    payroll:      Overall;
}

export interface Overall {
    activelyUsages:           number;
    lowuUsages:               number;
    nonUsages:                number;
    activelyUsagesPercentage: number;
    lowuUsagesPercentage:     number;
    nonUsagesPercentage:      number;
}

export interface OrganizationDetails {
    employee:     Attendance[];
    attendance:   Attendance[];
    leave:        Attendance[];
    salary:       any[];
    organization: Attendance[];
    performance:  any[];
    timesheet:    any[];
    payroll:      any[];
}

export interface Attendance {
    orgId:            number;
    organizationName: string;
    activityCount:    number;
    usageStatus:      string;
}





