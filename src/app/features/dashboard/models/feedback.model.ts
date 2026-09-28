export interface FeedbackDataTableResponse {
  status: boolean;
  msg: string;
  data: Datum[];
  totalRecords: number;
}

export interface Datum {
  orgId: string;
  id: string;
  client: string;
  contactPerson: string;
  phone: string;
  email: string;
  ticketId: number;
  ticketUid: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  subject: string;
  rating: number;
  ratingSubmittedAt: string;
  likedMost: string;
  improveFeedback: string;
  status: string;
  source: string;
  priority: string;
  assignedAgent: string;
  createdAt: string;
}
