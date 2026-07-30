export interface ImplementationCardData {
    status: boolean;
    data:   Data;
}

export interface Data {
    totalAccounts: number;
    completed:     number;
    inProgress:    number;
    notStarted:    number;
}

