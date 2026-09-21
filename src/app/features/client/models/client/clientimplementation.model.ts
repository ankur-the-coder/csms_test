export interface ClientImplementationResponse {
  data: ClientImplementationData;
  status: boolean;
  msg: string;
}

export interface ClientImplementationData {
  orgId: number;
  orgName: string;
  csLead?: string;
  supportOwner?: string;
  country?: string;
  rating?: number;
  onboardedDate?: string;
  health: string;
  overallProgress: ImplementationOverallProgress;
  modules: ImplementationModule[];
}

export interface ImplementationOverallProgress {
  approved: number;
  total: number;
  percentage: number;
}

export interface ImplementationModule {
  tabId: number;
  key: string;
  label: string;
  order: number;
  approvedCount: number;
  totalCount: number;
  tab_sts: number;
  completed: boolean;
  features: ImplementationFeature[];
}

export interface ImplementationFeature {
  mod_id: number;
  name: string;
  approval_status: number;
  remark: string | null;
  started_at: string | null;
  completed_at: string | null;
}

