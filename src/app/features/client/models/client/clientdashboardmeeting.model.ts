export interface ClientDashaboardMeetingResponse {
    data:   Datum[];
    status: boolean;
    msg:    string;
}

export interface Datum {
    meetingName: string;
    startTime:   string;
    organizer:   string;
    status:      number;
    meetingLink: string;
}
