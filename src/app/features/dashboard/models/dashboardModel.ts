export interface Data {
  totalClients: number;
  liveClients: number;
  implPending: number;
  trainingPending: number;
  meeting: number;
connect: number;
}

export interface DashboardCardCount {
  data: Data;
  status: boolean;
  msg: string;
}
export interface DashboardChartdata {
  data: ChartData;
  status: boolean;
  msg: string;
}


export interface ChartData {
    label: string;
    value: number;
}
