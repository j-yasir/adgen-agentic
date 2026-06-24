export type User = {
  id: string;
  name: string;
  email: string;
  created_at: string;
};

export type SignupRequest = {
  name: string;
  email: string;
  password: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type SignupResponse = {
  user: User;
  access_token: string;
  refresh_token: string;
  token_type: string;
};
