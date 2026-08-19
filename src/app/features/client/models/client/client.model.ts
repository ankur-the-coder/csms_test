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
    userLimit:      number;
    module:         Module;
    leadOwner:      string;
    supportOwner:   SupportOwner;
    implementation: Implementation;
    stage:          Stage;
    progress:        number;
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
