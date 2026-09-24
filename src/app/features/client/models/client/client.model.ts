export interface ClientDataTableResponse {
    data:         Datum[];
    status:       boolean;
    msg:          string;
    totalRecords: number;
}

export interface Datum {
    orgId:          number;
    client:         string;
    planStart:      Date;
    planEnd:        Date;
    premiumDate:     Date;
    userLimit:      number;
    module:         Module;
    leadOwner:      string;
    supportOwner:   SupportOwner;
    implementation: Implementation;
    stage:          Stage;
    progress:        number;
    trainingStatus: number;
    trainingProgress: number;
    contactPerson: string;
    email: string;
    phoneNumber: string;
    country: string;
}

export enum Implementation {
    Pending = "Pending",
}

export enum Module {
    EmployeeAttendanceLeaveOrganization = "Employee, Attendance, Leave, Organization",
    EmployeeAttendanceOrganization = "Employee, Attendance, Organization",
}

export enum Stage {
    Premium = "PREMIUM",
}

export enum SupportOwner {
    Empty = "-",
}
