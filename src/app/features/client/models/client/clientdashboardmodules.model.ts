export interface ClientDashboardModulesResponse {
  data?: FeatureItem[];
  totalEmployees?: number;
  status: boolean;
  msg: string;
}

export interface FeatureItem {
  name: string;
  type: 'module' | 'addon';
  flag: boolean; // true = enabled but no activity in the date range
  count: number | null;
  unit: 'employees' | 'records' | null;
  error?: boolean;
}
