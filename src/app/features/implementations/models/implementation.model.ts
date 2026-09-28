
export interface ImplementationCardData {
  status: boolean;
  data: CardData;
}

export interface ImpCardPayload {
  fromDate?: string;
  toDate?: string;
   orgId?: string;
   empId?:string;
   adminSts?: number;
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
  orgId?: string;
  userId?: string;
  adminSts?: number;
}






// export interface Implementation {
//     status: boolean;
//     data:   Datum[];
//     meta:   Meta;
// }

// export interface Datum {
//      orgId:           number;
//     organization:    string;
//     onboardedDate:   Date;
//     csLead:          null | string;
//     supportOwner:    null | string;
//     health:          string;
//     country:          string;
//     overallProgress: OverallProgress;
//     modules:         Modules;
// }



// export interface Modules {
//     employee:     Attendance;
//     attendance:   Attendance;
//     leave:        Attendance;
//     salary:       Attendance;
//     organization: Attendance;
//     timesheet:    Attendance;
//     payroll:      Attendance;
// }

// export interface Attendance {
//     completed: number;
//     total:     number;
// }

// export interface OverallProgress {
//     approved:   number;
//     total:      number;
//     percentage: number;
// }

// export interface Meta {
//     total:      number;
//     first_page: number;
// }






export interface ImplementationData {
  status: boolean;
  data:   Datum[];
  meta:   Meta;
}

export interface ApiFeature {
  mod_id:          number;
  name:            string;
  approval_status: number;
  remark:          string | null;
  started_at:      Date | string | null;
  completed_at:    Date | string | null;
}

export interface ApiModule {
  label:    string;
  tabOrder: number;
  features: ApiFeature[];
}

export interface Datum {
  orgId:              number;
  organization:       string;
  onboardedDate:      Date | string;
  csLead:             string | null;
  supportOwner:       string | null;
  country:            string | null;
  rating:             number | null;
  licenceStartDate:   Date | string | null;
  licenceEndDate:     Date | string | null;
  health:             string;
  overallProgress:    OverallProgress;
  modules:            Record<string, ApiModule>;
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







