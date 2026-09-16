export interface ClientDashboardAddonsResponse {
    data:   AddonItem[];
    status: boolean;
    msg:    string;
}

export interface AddonItem {
    tabId:    number;
    tabName:  string;
    modId:    number;
    name:     string;
    enabled:  boolean;
    status:   string;
}
