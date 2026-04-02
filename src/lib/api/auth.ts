import { apiClient } from '@/src/lib/api/client';
import type {
  LoginResponse,
  RegisterResponse,
  SetPasswordRequestPayload,
  UserProfile,
  VerifyEmailResponse,
} from '@/src/types/user';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function loginRequest(email: string, password: string): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/login/', {
    email: normalizeEmail(email),
    password,
  });

  return response.data;
}

export async function registerRequest(email: string): Promise<RegisterResponse> {
  const response = await apiClient.post<RegisterResponse>('/auth/register/', {
    email: normalizeEmail(email),
  });

  return response.data;
}

export async function verifyEmailRequest(
  email: string,
  code: string,
): Promise<VerifyEmailResponse> {
  const response = await apiClient.post<VerifyEmailResponse>('/auth/verify-email/', {
    email: normalizeEmail(email),
    code: code.trim(),
  });

  return response.data;
}

export async function setPasswordRequest(
  payload: SetPasswordRequestPayload,
): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/set-password/', {
    verification_token: payload.verificationToken,
    username: payload.username.trim(),
    password: payload.password,
    password_confirm: payload.passwordConfirm,
    first_name: payload.firstName?.trim() || undefined,
    last_name: payload.lastName?.trim() || undefined,
    date_of_birth: payload.dateOfBirth || undefined,
  });

  return response.data;
}

export async function fetchMe(): Promise<UserProfile> {
  const response = await apiClient.get<UserProfile>('/users/me/');
  return response.data;
}