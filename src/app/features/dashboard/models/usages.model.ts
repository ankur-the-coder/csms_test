export interface UsagesDataTableResponse {
  data: Data[];
  status: boolean;
  msg: string;
  totalRecords: number;
}

export interface Data {
  orgId: string
  id: string,
  client: string,
  // createdDate: string,
  contactPerson: string,
  email: string,
  phone: string,
  module: string,
  useSts: string,
}
