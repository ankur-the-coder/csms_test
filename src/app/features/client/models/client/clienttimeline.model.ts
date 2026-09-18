export interface ClientTimelineResponse {
    data:   ClientTimelineData;
    status: boolean;
    msg:    string;
}

export interface ClientTimelineData {
    welcomeEmailSent: boolean;
    kickoffMeeting:   boolean;
    setup:            boolean;
    goLive:           boolean;
}
