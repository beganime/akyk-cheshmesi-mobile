import { apiClient } from '@/src/lib/api/client';
import type { CursorPaginatedMessagesResponse, MessageItem } from '@/src/types/message';

type SendMessagePayload = {
  text?: string;
  client_uuid: string;
  message_type?: 'text' | 'sticker' | 'image' | 'video' | 'file' | 'audio' | 'system';
  reply_to_uuid?: string;
  attachment_uuids?: string[];
  metadata?: Record<string, unknown>;
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
    text: payload.text ?? '',
    client_uuid: payload.client_uuid,
    ...(payload.reply_to_uuid ? { reply_to_uuid: payload.reply_to_uuid } : {}),
    ...(payload.attachment_uuids?.length ? { attachment_uuids: payload.attachment_uuids } : {}),
    ...(payload.metadata ? { metadata: payload.metadata } : {}),
  });

  return response.data;
}

export async function markChatRead(chatUuid: string, messageUuid?: string) {
  const response = await apiClient.post(`/chats/${chatUuid}/read/`, {
    ...(messageUuid ? { message_uuid: messageUuid } : {}),
  });

  return response.data;
}