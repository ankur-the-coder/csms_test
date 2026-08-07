export interface LoginRequest {
  userName: string;
  password: string;
}

export interface LoginResponseData {
  Id: number;
  empId: number;
  userName: string;
}

export interface LoginResponse {
  status: boolean;
  message: string;
  data: LoginResponseData;
}
