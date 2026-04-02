import { apiClient } from '@/src/lib/api/client';
import type { UserProfile } from '@/src/types/user';

export type UpdateMePayload = {
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  bio?: string | null;
  date_of_birth?: string | null;
};

export async function updateMe(payload: UpdateMePayload): Promise<UserProfile> {
  const response = await apiClient.put<UserProfile>('/users/me/', payload);
  return response.data;
}