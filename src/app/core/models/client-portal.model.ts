export interface PortalDashboardResponse {
  status: boolean;
  msg: string;
  data: PortalDashboardData;
}

export interface PortalDashboardData {
  orgName: string;
  orgLogo?: string | null;
  plan: PortalPlan | null;
  implementation: { percentage: number; completed: number; total: number };
  tracker: PortalTrackerItem[];
  support: { openCases: number; recentTickets: PortalTicket[] };
  addons: { enabledCount: number; suggested: PortalAddon[] };
  meetings: PortalMeeting[];
  accountManager: { name: string | null; role: string };

  // ---- trainings (MeetingTable) & notifications ----
  trainingProgress: { completed: number; total: number };
  upcomingTrainings: PortalTraining[];
  notifications: { unread: number };
  dummySections: string[];
}

export interface PortalPlan {
  stage: string;
  expiresOn: string | null;
  registeredEmployees: number;
  userLimit: number;
  label: string;
}

export interface PortalTrackerItem {
  tabId: number;
  label: string;
  status: 'completed' | 'in_progress' | 'pending';
  approved: number;
  total: number;
  date: string | null;
}

export interface PortalAddon { name: string; description: string; }

export interface PortalTicket {
  ticketUid: string;
  subject: string;
  status: string;
  createdAt: string;
}

export interface PortalMeeting {
  title: string;
  startTime: string;
  host: string;
  status: number;
  link: string | null;
}

export interface PortalTraining {
  title: string;
  startTime: string;
  trainer: string;
  status: string;
  canJoin: boolean;
  link?: string | null;
}

export interface PortalTicketItem {
  ticket_uid: string;
  subject: string;
  status: string;
  priority?: string;
  source?: string;
  customer_name?: string;
  customer_email?: string;
  sender_org_name?: string;
  assigned_agent_name?: string;
  created_at: string;
  last_message_at?: string;
  closed_at?: string;
  due_date?: string;
  rating?: number;
  rating_liked_most?: string;
  rating_improve_feedback?: string;
  reopen_count?: number;
  resolution_code?: string;
}

export interface PortalTicketAttachment {
  id: number;
  file_name: string;
  content_type: string;
  size: number;
  url: string;
}

export interface PortalTicketMessage {
  id: number;
  sender: 'customer' | 'agent';
  type: string;
  message: string;
  sender_name?: string;
  to_recipients?: string;
  cc_recipients?: string;
  channel?: string;
  created_at: string;
  attachments?: PortalTicketAttachment[];
}

export interface PortalTicketAssignmentHistory {
  agent_name: string;
  created_at: string;
}

export interface PortalTicketDetail extends PortalTicketItem {
  assignmentHistory?: PortalTicketAssignmentHistory[];
  messages: PortalTicketMessage[];
}

export interface PortalTicketListResponse {
  status: boolean;
  data: {
    tickets: PortalTicketItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface PortalTicketDetailResponse {
  status: boolean;
  data: PortalTicketDetail;
}