
export interface ImplementationCardData {
  status: boolean;
  data: CardData;
}

export interface CardData {
  totalAccounts: number;
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
  fromDate?: string;
  toDate?: string;
}






export interface Implementation {
    status: boolean;
    data:   Datum[];
    meta:   Meta;
}

export interface Datum {
     orgId:           number;
    organization:    string;
    onboardedDate:   Date;
    csLead:          null | string;
    supportOwner:    null | string;
    health:          string;
    overallProgress: OverallProgress;
    modules:         Modules;
}



export interface Modules {
    employee:     Attendance;
    attendance:   Attendance;
    leave:        Attendance;
    salary:       Attendance;
    organization: Attendance;
    timesheet:    Attendance;
    payroll:      Attendance;
}

export interface Attendance {
    completed: number;
    total:     number;
}

export interface OverallProgress {
    approved:   number;
    total:      number;
    percentage: number;
}

export interface Meta {
    total:      number;
    first_page: number;
}













