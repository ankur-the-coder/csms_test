export interface RenewalTableResponse {
  status: boolean;
  msg: string;
  data: Data[];
  totalRecords: number;
}

export interface Data {

    id:       number;
    orgId:         number;
    client:        string;
    contactPerson: string;
    email:         string;
    phone:         string;
    countryCode:   string;
    renewDate:     string;
    endDate:       string;
    createdDate:   string;
    PremiumDate:   string;
    renewCount: number;
    country:  string;
    leadOwner:  string;
    supportOwner:  string;

}

// export enum ContactPerson {
//     Empty = "-",
//     LeaderAmjad = "leader amjad",
//     VishalGupta = "vishal gupta",
// }
