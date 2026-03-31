import { apiClient } from '@/src/lib/api/client';
import type { CursorPaginatedMessagesResponse, MessageItem } from '@/src/types/message';

type SendMessagePayload = {
  text: string;
  client_uuid: string;
  message_type?: 'text';
};

export async function fetchChatMessages(
  chatUuid: string,
  nextUrl?: string | null
): Promise<CursorPaginatedMessagesResponse> {
  const url = nextUrl || `/chats/${chatUuid}/messages/`;

  const response = await apiClient.get<CursorPaginatedMessagesResponse>(url);

  return response.data;
}

export async function sendChatMessage(
  chatUuid: string,
  payload: SendMessagePayload
): Promise<MessageItem> {
  const response = await apiClient.post<MessageItem>(`/chats/${chatUuid}/messages/`, {
    message_type: payload.message_type ?? 'text',
    text: payload.text,
    client_uuid: payload.client_uuid,
  });

  return response.data;
}

export async function markChatRead(chatUuid: string, messageUuid?: string) {
  const response = await apiClient.post(`/chats/${chatUuid}/read/`, {
    ...(messageUuid ? { message_uuid: messageUuid } : {}),
  });

  return response.data;
}