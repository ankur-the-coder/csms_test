export interface LoginResponse {
  status: boolean;
  msg: string;
  data: Data;
}

export interface Data {
  password: string;
  userName: string;
  empId: string;
  designation: string
  orgId: string
  admisSts: number,
  email: string,
  phone: string
}
export interface ProfileDetail {
  designation: string;
  userName: string;

}
