import { apiClient } from '@/src/lib/api/client';
import type { ChatListItem, PaginatedChatsResponse } from '@/src/types/chat';

export async function fetchChats(page = 1, pageSize = 30): Promise<PaginatedChatsResponse> {
  const response = await apiClient.get<PaginatedChatsResponse>(
    `/chats/?page=${page}&page_size=${pageSize}`
  );

  return response.data;
}

export async function fetchChatDetail(chatUuid: string): Promise<ChatListItem> {
  const response = await apiClient.get<ChatListItem>(`/chats/${chatUuid}/`);
  return response.data;
}

export async function createDirectChat(peerUuid: string) {
  const response = await apiClient.post('/chats/direct/', {
    peer_uuid: peerUuid,
  });

  return response.data;
}

export async function setChatMuted(chatUuid: string, isMuted: boolean) {
  const response = await apiClient.post(`/chats/${chatUuid}/mute/`, {
    is_muted: isMuted,
  });

  return response.data;
}

export async function setChatPinned(chatUuid: string, isPinned: boolean) {
  const response = await apiClient.post(`/chats/${chatUuid}/pin/`, {
    is_pinned: isPinned,
  });

  return response.data;
}

export async function setChatArchived(chatUuid: string, isArchived: boolean) {
  const response = await apiClient.post(`/chats/${chatUuid}/archive/`, {
    is_archived: isArchived,
  });

  return response.data;
}