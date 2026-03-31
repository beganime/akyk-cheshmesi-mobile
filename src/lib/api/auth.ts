import { apiClient } from '@/src/lib/api/client';
import type { LoginResponse, UserProfile } from '@/src/types/user';

export async function loginRequest(email: string, password: string): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/login/', {
    email: email.trim().toLowerCase(),
    password,
  });

  return response.data;
}

export async function fetchMe(): Promise<UserProfile> {
  const response = await apiClient.get<UserProfile>('/users/me/');
  return response.data;
}