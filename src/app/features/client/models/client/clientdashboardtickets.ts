export interface ClientDashboardTicketsResponse {
    data:   TicketItem[];
    status: boolean;
    msg:    string;
}

export interface TicketItem {
    ticketUid: string;
    subject:   string;
    status:    string;
    createdAt: string;
}
