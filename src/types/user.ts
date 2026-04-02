export type UserProfile = {
  uuid: string;
  email: string;
  username: string | null;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  avatar: string | null;
  bio: string | null;
  is_email_verified: boolean;
  registration_completed: boolean;
};

export type AuthTokens = {
  refresh: string;
  access: string;
};

export type LoginResponse = {
  detail: string;
  tokens: AuthTokens;
  user: UserProfile;
};

export type RegisterResponse = {
  detail: string;
  email: string;
  expires_in_seconds: number;
};

export type VerifyEmailResponse = {
  detail: string;
  verification_token: string;
};

export type SetPasswordRequestPayload = {
  verificationToken: string;
  username: string;
  password: string;
  passwordConfirm: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
};

export type UserShort = {
  uuid: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  avatar?: string | null;
  bio?: string | null;
};