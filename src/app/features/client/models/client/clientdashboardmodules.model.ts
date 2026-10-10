export interface ClientDashboardModulesResponse {
  data?: ModuleUsageItem[];
  status: boolean;
  msg: string;
}

export interface ModuleUsageItem {
  name: string;
  flag: boolean;
  activeCount: number | null;
  unit: 'employees' | 'records';
  totalEmployees: number;
}
