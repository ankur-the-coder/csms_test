export interface ClientDashboardUsageResponse {
    data:   UsageData;
    status: boolean;
    msg:    string;
}

export interface UsageData {
    attendance:    number;
    employeeLeave: number;
    employee:      number;
}
