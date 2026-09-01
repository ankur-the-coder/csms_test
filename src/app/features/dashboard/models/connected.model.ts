export interface ConnectedDataTableResponse {
  data: Data[];
  status: boolean;
  msg: string;
  totalRecords: number;
}

export interface Data {
orgId:string
  id: string,
  client: string,
  createdDate: string,
  contactPerson: string,
  email: string,
  phone: string,
  ticketCount: Number,
  connectSts: string,
}
