export interface ClientDashboardTrackerResponse {
    data:   TrackerItem[];
    status: boolean;
    msg:    string;
}

export interface TrackerItem {
    tabId:     number;
    label:     string;
    order:     number;
    tab_sts:   number;
    completed: boolean;
}
