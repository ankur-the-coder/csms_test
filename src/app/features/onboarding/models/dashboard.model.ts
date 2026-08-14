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
    country:      string;
    module:         string;
    leadOwner:      string;
    supportOwner:   string;
    // implementation: Implementation;
    // stage:          Stage;
}

export interface CardData {
  totalCount: number;
  completed: number;
  inProgress: number;
  pendingCount: number;
}
export interface OnboardingCardData {
  status: boolean;
  data: CardData;
}
