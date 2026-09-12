export interface ClientCard {
    data:   Data;
    status: boolean;
    msg:    string;
}

export interface Data {
    orgId:                  string;
    clientName:             string;
    premiumPlan:            PremiumPlan;
    implementationProgress: ImplementationProgress;
    supportCases:           SupportCases;
}

export interface ImplementationProgress {
    percentage: number;
    completed:  number;
    total:      number;
    label:      string;
}

export interface PremiumPlan {
    stage:               string;
    expiresOn:           string;
    registeredEmployees: number;
    userLimit:           number;
    label:               string;
}

export interface SupportCases {
    openCases: number;
}
