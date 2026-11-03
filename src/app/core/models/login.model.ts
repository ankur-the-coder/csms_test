export interface LoginResponse {
  status: boolean;
  msg: string;
  data: Data;
  code?: string;
  activeCount?: number;
  devices?: SessionDevice[];
  retryAfterSeconds?: number;
}

export interface SessionDevice {
  label: string;
  lastUsedAt: string;
}

export interface LoginConflictResponse {
  status: false;
  code: 'SESSION_LIMIT';
  activeCount: number;
  devices: SessionDevice[];
  msg: string;
}

export interface LoginRateLimitResponse {
  status: false;
  code: 'RATE_LIMITED';
  retryAfterSeconds?: number;
  msg: string;
}

export interface Data {
  token?: string;
  password?: string;
  userName: string;
  empId: string | null;
  designation: string;
  orgId: string | null;
  adminSts: number;
  email: string | null;
  phone: string | null;
  usermasterEmpId: string ;
  /** Employee profile picture URL (EmployeeMaster.ImageName), null when none */
  profileImage?: string | null;
  profile?: string;
  /** 'agent' = support_agents login, 'client' = UserMaster (customer) login */
  userType?: 'agent' | 'client';
}

export interface ProfileDetail {
  designation: string;
  userName: string;
}