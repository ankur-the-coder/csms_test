export interface OnboardingDataTableResponse {
    data:         Datum[];
    status:       boolean;
    msg:          string;
    totalRecords: number;
}

export interface Datum {
    orgId:          number;
    organization:         string;
    contactPerson:      string;
    phone:      string;
    createdDate:        Date;
    // userLimit:      number;
    module:         string;
    leadOwner:      string;
    supportOwner:   string;
    // implementation: Implementation;
    // stage:          Stage;
}

export interface CardData {
  totalAccounts: number;
  completed: number;
  inProgress: number;
  notTrack: number;
}
export interface OnboardingCardData {
  status: boolean;
  data: CardData;
}
