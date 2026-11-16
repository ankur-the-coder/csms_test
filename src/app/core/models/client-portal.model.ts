export interface PortalDashboardResponse {
  status: boolean;
  msg: string;
  data: PortalDashboardData;
}

export interface PortalDashboardData {
  orgName: string;
  orgLogo?: string | null;
  plan: PortalPlan | null;
  implementation: { percentage: number; completed: number; total: number; health: 'Good' | 'Neutral' | 'Risk'; started: boolean };
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
  steps: PortalTrackerStep[];
}

export interface PortalTrackerStep { name: string; done: boolean; date: string | null; }

export interface PortalAddon {
  key: string;
  name: string;
  type: 'module' | 'addon';
  description: string;
  /** ubitechsolutions.com page opened by "Explore" */
  url: string;
}

export interface PortalTicket {
  ticketUid: string;
  subject: string;
  status: string;
  createdAt: string;
  rating?: number | null;
  canRate?: boolean;
}

export interface PortalMeeting {
  title: string;
  startTime: string;
  host: string;
  status: number;
  link: string | null;
  type?: string | null;
  endTime?: string | null;
  duration?: number | null;
  summary?: string | null;
  actionItems?: string[];
  recordingUrl?: string | null;
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
  rating?: number | null;
  can_rate?: boolean;
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

export interface PortalPlanItem {
  key: string;
  name: string;
  type: 'module' | 'addon';
  description: string;
  url: string;
}

export interface PortalPlanInfo {
  state: 'trial' | 'active' | 'expiring' | 'expired' | 'unknown';
  isTrial: boolean;
  edition: string | null;
  startDate: string | null;
  endDate: string | null;
  daysLeft: number | null;
  termPercent: number;
  userLimit: number;
  registeredEmployees: number;
  seatsLeft: number;
  seatPercent: number;
  overLimit: boolean;
  exceedUsers: number;
  dueAmount: number;
  currencySymbol: string;
  memberSince: string | null;
  premiumSince: string | null;
}

export interface PortalPlanData {
  orgName: string;
  product: string;
  plan: PortalPlanInfo;
  modules: PortalPlanItem[];
  addons: PortalPlanItem[];
  attendanceFeatures: string[];
  extras: string[];
}

export interface PortalPlanResponse {
  status: boolean;
  msg?: string;
  data: PortalPlanData;
}

/* ---------------- Usage Analytics ---------------- */
export interface PortalUsageCard {
  key: 'employee' | 'attendance' | 'leave';
  label: string;
  percent: number;
  level: 'high' | 'medium' | 'low' | 'neutral';
  value: number;
  total: number;
  caption: string;
  delta: number | null;
}

/** day = current month per day (plan < 1 month) · week = since plan month per week (2-5 months) · month = last 6 months */
export type PortalTrendGranularity = 'day' | 'week' | 'month';

export interface PortalTrendMetric {
  key: string;
  label: string;
  unit: 'pct' | 'count';
  /** true = drawn as a line on the chart; false = table column only */
  plot: boolean;
}

export interface PortalTrendPoint { 
  key: string;
  label: string;
  start: string;
  end: string;
  current: boolean;
  /** raw number per metric (employees / records) */
  values: Record<string, number>;
  /** % of active employees, only for metrics with unit 'pct' */
  pcts: Record<string, number>;
  tickets: number;
}

export interface PortalTrend {
  key: string;
  label: string;
  description: string;
  granularity: PortalTrendGranularity;
  months: number;
  from: string;
  to: string;
  unit: 'pct' | 'count';
  metrics: PortalTrendMetric[];
  points: PortalTrendPoint[];
}

export interface PortalUsageTab { key: string; label: string; icon: string; }

export interface PortalUsageData {
  orgName: string;
  product: string;
  asOf: string;
  planStart: string | null;
  modules: { hasAttendance: boolean; hasLeave: boolean };
  range: { granularity: PortalTrendGranularity; months: number; from: string; to: string };
  tabs: PortalUsageTab[];
  defaultTab: string | null;
  /** trends the server already built (Attendance + Leave); other tabs are fetched on demand */
  trends: Record<string, PortalTrend>;
  summary: {
    activeEmployees: number; userLimit: number; seatPercent: number; seatsLeft: number; overLimit: boolean;
    avgDailyPresent: number; active30: number; inactive30: number; ticketsThisMonth: number;
  };
  cards: PortalUsageCard[];
  daily: Array<{ date: string; dow: number; present: number; pct: number }>;
  weekday: Array<{ day: string; avg: number; pct: number; days: number }>;
  monthly: Array<{
    month: string; label: string; current: boolean;
    attendanceEmployees: number; attendancePct: number;
    leaveEmployees: number; leavePct: number; leaveDays: number; tickets: number;
  }>;
  insights: Array<{ tone: 'good' | 'info' | 'warn' | 'danger'; title: string; text: string }>;
}

export interface PortalUsageResponse {
  status: boolean;
  msg?: string;
  data: PortalUsageData;
}

export interface PortalTrendResponse {
  status: boolean;
  msg?: string;
  data: PortalTrend;
}


/* ---------------- Implementation ---------------- */
export interface PortalImplStep { name: string; done: boolean; startedAt: string | null; completedAt: string | null; }
export interface PortalImplModule {
  tabId: number; label: string; status: 'completed' | 'in_progress' | 'pending';
  approved: number; total: number; percent: number; lastActivity: string | null; steps: PortalImplStep[];
}
export interface PortalImplementationData {
  orgName: string;
  overall: {
    percentage: number; completed: number; total: number; started: boolean;
    health: string; healthLabel: string; modulesDone: number; modulesTotal: number; lastActivity: string | null;
  };
  owner: { name: string | null; role: string };
  modules: PortalImplModule[];
  upNext: Array<{ module: string; step: string }>;
}
export interface PortalImplementationResponse { status: boolean; msg?: string; data: PortalImplementationData; }


/* ---------------- Add-ons page ---------------- */
export type PortalAddonStatus = 'active' | 'trial' | 'expired' | 'available';

export interface PortalAddonContent {
  tagline: string;
  headline: string;
  intro: string;
  benefits: Array<{ title: string; text: string }>;
  steps: Array<{ title: string; text: string }>;
  features: string[];
  industries: string[];
}

export interface PortalAddonPurchase {
  startDate: string | null;
  endDate: string | null;
  /** true = no own expiry, valid until the plan ends */
  endsWithPlan: boolean;
  daysLeft: number | null;
  expiringSoon: boolean;
  users: number | null;
  amount: number | null;
  currency: string | null;
  isTrial: boolean;
}

export interface PortalAddonCard {
  key: string;
  name: string;
  status: PortalAddonStatus;
  iconUrl: string | null;
  shortDescription: string;
  description: string;
  learnMoreUrl: string | null;
  price: { perUserPerYear: number; estimatedYearly: number | null } | null;
  purchase: PortalAddonPurchase | null;
  canTrial: boolean;
  trialDays: number;
  content: PortalAddonContent | null;
}

export interface PortalAddonsSummary {
  total: number; active: number; trial: number; expired: number; available: number;
  currency: 'INR' | 'USD'; symbol: string; band: string | null; users: number;
  trialEnabled: boolean; trialsUsed: number; trialsMax: number;
}

export interface PortalAddonsData { summary: PortalAddonsSummary; addons: PortalAddonCard[]; }
export interface PortalAddonsResponse { status: boolean; msg?: string; data: PortalAddonsData; }
/* ---------------- Invoices & Payments page ---------------- */
export type PortalInvoiceStatus = 'paid' | 'free' | 'pending' | 'failed' | 'other';

export interface PortalInvoiceItem { label: string; amount: number; }

export interface PortalInvoice {
  key: string;
  kind: 'paid' | 'incomplete';
  invoiceNumber: string | null;
  date: string | null;
  status: PortalInvoiceStatus;
  statusLabel: string;
  type: string;
  currency: string;
  symbol: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  method: string;
  reference: string;
  orderRef: string;
  promo: string;
  items: PortalInvoiceItem[];
  dues: number;
  notes: string[];
  billedTo: { name: string; gstin: string; city: string };
}

export interface PortalInvoicesSummary {
  paidCount: number;
  incompleteCount: number;
  totals: Array<{ currency: string; symbol: string; amount: number }>;
  last: { date: string | null; total: number; symbol: string } | null;
  planEnd: string | null;
  daysLeft: number | null;
}

export interface PortalInvoicesData { summary: PortalInvoicesSummary; invoices: PortalInvoice[]; }
export interface PortalInvoicesResponse { status: boolean; msg?: string; data: PortalInvoicesData; }

/* ---------------- Support page ---------------- */
export interface PortalSupportStats {
  open: number;
  closed: number;
  total: number;
  raisedThisMonth: number;
  waitingForYou: number;
  awaitingRating: number;
  avgResolutionHours: number | null;
  resolvedSampled: number;
  avgRating: number | null;
  ratedCount: number;
  openByPriority: { high: number; medium: number; low: number };
}
export interface PortalSupportData {
  stats: PortalSupportStats;
  recent: PortalTicketItem[];
  contacts: { email: string; phoneIndia: string; phoneUae: string };
}
export interface PortalSupportResponse { status: boolean; msg?: string; data: PortalSupportData; }