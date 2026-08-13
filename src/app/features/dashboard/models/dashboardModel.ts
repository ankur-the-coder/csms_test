export interface Data {
  totalClients: number;
  liveClients: number;
  implPending: number;
  trainingPending: number;
  meeting: number;
}

export interface DashboardCardCount {
  data: Data;
  status: boolean;
  msg: string;
}
