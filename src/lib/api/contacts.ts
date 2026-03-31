import { apiClient } from '@/src/lib/api/client';

export type UserShort = {
  uuid: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  avatar?: string | null;
};

export async function searchUsers(query: string): Promise<UserShort[]> {
  const q = query.trim();

  if (q.length < 2) {
    return [];
  }

  const response = await apiClient.get<UserShort[]>(`/users/search/?q=${encodeURIComponent(q)}`);
  return response.data ?? [];
}