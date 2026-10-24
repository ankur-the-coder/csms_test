export interface pendingRenewalTableResponse {
  status: boolean;
  msg: string;
  data: Data[];
  totalRecords: number;
}

export interface Data {
  id: number;
  orgId: number;
  client: string;
  contactPerson: string;
  email: string;
  phone: string;
  countryCode: string;
  renewDate: string;
  startDate: string;
  endDate: string;
  createdDate: string;
modules: string;
  country: string;
  leadOwner: string;
  supportOwner: string;
  PremiumDate: string;
}

// export enum ContactPerson {
//     Empty = "-",
//     LeaderAmjad = "leader amjad",
//     VishalGupta = "vishal gupta",
// }
