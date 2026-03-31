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

export type LoginResponse = {
  detail: string;
  tokens: {
    refresh: string;
    access: string;
  };
  user: UserProfile;
};

export type UserShort = {
  uuid: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  avatar?: string | null;
};