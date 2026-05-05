import { apiClient } from '@/src/lib/api/client';

export type UserShort = {
  uuid: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  phone_number?: string | null;
  avatar?: string | null;
  badge?: string | null;
  is_admin?: boolean | null;
  is_staff?: boolean | null;
};

export type UserContactApiItem = {
  uuid: string;
  source?: string | null;
  last_interaction_at?: string | null;
  is_favorite?: boolean | null;
  user?: UserShort | null;
};

type PaginatedContactsResponse = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: UserContactApiItem[];
};

function normalizeContactsResponse(
  data: UserContactApiItem[] | PaginatedContactsResponse | null | undefined,
): UserContactApiItem[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && Array.isArray(data.results)) {
    return data.results;
  }

  return [];
}

export async function searchUsers(query: string): Promise<UserShort[]> {
  const q = query.trim();

  if (q.length < 2) {
    return [];
  }

  const response = await apiClient.get<UserShort[]>(`/users/search/?q=${encodeURIComponent(q)}`);
  return response.data ?? [];
}

export async function fetchContacts(): Promise<UserContactApiItem[]> {
  const response = await apiClient.get<UserContactApiItem[] | PaginatedContactsResponse>(
    '/users/contacts/',
  );

  return normalizeContactsResponse(response.data);
}

export async function fetchContactDetail(userUuid: string): Promise<UserContactApiItem> {
  const response = await apiClient.get<UserContactApiItem>(
    `/users/contacts/${userUuid}/`,
  );

  return response.data;
}