import { apiClient } from '@/src/lib/api/client';
import type { CursorPaginatedMessagesResponse, MessageItem } from '@/src/types/message';

export type SendMessagePayload = {
  text?: string;
  client_uuid: string;
  message_type?: 'text' | 'sticker' | 'image' | 'video' | 'file' | 'audio' | 'system';
  reply_to_uuid?: string;
  attachment_uuids?: string[];
  metadata?: Record<string, unknown>;
};

type UpdateMessagePayload = {
  text?: string;
  metadata?: Record<string, unknown>;
};

type DeleteMessagePayload = {
  delete_for: 'me' | 'everyone';
};

type DeleteMessageResponse = {
  detail: string;
  delete_for: 'me' | 'everyone';
  message_uuid?: string;
  message?: MessageItem;
};

export async function fetchChatMessages(
  chatUuid: string,
  nextUrl?: string | null,
): Promise<CursorPaginatedMessagesResponse> {
  const url = nextUrl || `/chats/${chatUuid}/messages/`;
  const response = await apiClient.get(url);
  return response.data;
}

export async function fetchChatMessageDetail(
  chatUuid: string,
  messageUuid: string,
): Promise<MessageItem> {
  const response = await apiClient.get(`/chats/${chatUuid}/messages/${messageUuid}/`);
  return response.data;
}

export async function sendChatMessage(
  chatUuid: string,
  payload: SendMessagePayload,
): Promise<MessageItem> {
  const response = await apiClient.post(`/chats/${chatUuid}/messages/`, {
    message_type: payload.message_type ?? 'text',
    text: payload.text ?? '',
    client_uuid: payload.client_uuid,
    ...(payload.reply_to_uuid ? { reply_to_uuid: payload.reply_to_uuid } : {}),
    ...(payload.attachment_uuids?.length ? { attachment_uuids: payload.attachment_uuids } : {}),
    ...(payload.metadata ? { metadata: payload.metadata } : {}),
  });

  return response.data;
}

export async function editChatMessage(
  chatUuid: string,
  messageUuid: string,
  payload: UpdateMessagePayload,
): Promise<MessageItem> {
  const response = await apiClient.patch(
    `/chats/${chatUuid}/messages/${messageUuid}/`,
    {
      ...(typeof payload.text === 'string' ? { text: payload.text } : {}),
      ...(payload.metadata ? { metadata: payload.metadata } : {}),
    },
  );

  return response.data;
}

export async function deleteChatMessage(
  chatUuid: string,
  messageUuid: string,
  payload: DeleteMessagePayload,
): Promise<DeleteMessageResponse> {
  const response = await apiClient.delete(
    `/chats/${chatUuid}/messages/${messageUuid}/`,
    {
      data: payload,
    },
  );

  return response.data;
}

export async function markChatRead(chatUuid: string, messageUuid?: string) {
  const response = await apiClient.post(`/chats/${chatUuid}/read/`, {
    ...(messageUuid ? { message_uuid: messageUuid } : {}),
  });

  return response.data;
}