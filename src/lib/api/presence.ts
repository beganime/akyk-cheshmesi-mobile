import { apiClient } from '@/src/lib/api/client';
import type { PresenceDetail } from '@/src/types/presence';

export async function fetchPresence(userUuid: string): Promise<PresenceDetail> {
  const response = await apiClient.get<PresenceDetail>(`/presence/${userUuid}/`);
  return response.data;
}