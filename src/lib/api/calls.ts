import { apiClient } from '@/src/lib/api/client';
import type {
  CallActionPayload,
  CallCreatePayload,
  CallSession,
} from '@/src/types/calls';

export async function createChatCall(
  chatUuid: string,
  payload: CallCreatePayload,
): Promise<CallSession> {
  const response = await apiClient.post<CallSession>(
    `/chats/${chatUuid}/calls/`,
    payload,
  );

  return response.data;
}

export async function fetchCalls(params?: {
  chatUuid?: string;
  status?: string;
}): Promise<CallSession[]> {
  const search = new URLSearchParams();

  if (params?.chatUuid) {
    search.set('chat_uuid', params.chatUuid);
  }

  if (params?.status) {
    search.set('status', params.status);
  }

  const suffix = search.toString() ? `?${search.toString()}` : '';
  const response = await apiClient.get<CallSession[]>(`/calls/${suffix}`);
  return response.data;
}

export async function fetchCallDetail(callUuid: string): Promise<CallSession> {
  const response = await apiClient.get<CallSession>(`/calls/${callUuid}/`);
  return response.data;
}

export async function acceptCall(
  callUuid: string,
  payload: CallActionPayload = {},
): Promise<CallSession> {
  const response = await apiClient.post<CallSession>(
    `/calls/${callUuid}/accept/`,
    payload,
  );

  return response.data;
}

export async function rejectCall(
  callUuid: string,
  payload: CallActionPayload = {},
): Promise<CallSession> {
  const response = await apiClient.post<CallSession>(
    `/calls/${callUuid}/reject/`,
    payload,
  );

  return response.data;
}

export async function cancelCall(
  callUuid: string,
  payload: CallActionPayload = {},
): Promise<CallSession> {
  const response = await apiClient.post<CallSession>(
    `/calls/${callUuid}/cancel/`,
    payload,
  );

  return response.data;
}

export async function endCall(
  callUuid: string,
  payload: CallActionPayload = {},
): Promise<CallSession> {
  const response = await apiClient.post<CallSession>(
    `/calls/${callUuid}/end/`,
    payload,
  );

  return response.data;
}