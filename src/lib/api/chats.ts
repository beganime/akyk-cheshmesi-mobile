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
  const response = await apiClient.post('/chats/', {
    type: 'private',
    peer_uuid: peerUuid,
  }).catch(async () => {
    return await apiClient.post('/chats/direct/', {
      peer_uuid: peerUuid,
    });
  });

  return response.data;
}

export async function createGroupChat(payload: {
  title: string;
  description?: string;
  member_uuids: string[];
}) {
  const response = await apiClient.post('/chats/', {
    type: 'group',
    title: payload.title,
    description: payload.description || '',
    member_uuids: payload.member_uuids,
  }).catch(async () => {
    return await apiClient.post('/chats/group/', {
      title: payload.title,
      description: payload.description || '',
      member_uuids: payload.member_uuids,
    });
  });

  return response.data;
}

export async function updateGroupChat(
  chatUuid: string,
  payload: { title?: string; description?: string; avatar_uuid?: string },
) {
  const response = await apiClient.patch(`/chats/${chatUuid}/`, payload);
  return response.data;
}

export async function addGroupMembers(chatUuid: string, memberUuids: string[]) {
  const response = await apiClient.post(`/chats/${chatUuid}/members/`, {
    member_uuids: memberUuids,
  });
  return response.data;
}

export async function removeGroupMember(chatUuid: string, userUuid: string) {
  const response = await apiClient.delete(`/chats/${chatUuid}/members/${userUuid}/`);
  return response.data;
}

export async function promoteGroupAdmin(chatUuid: string, userUuid: string) {
  const response = await apiClient.post(`/chats/${chatUuid}/admins/`, {
    user_uuid: userUuid,
  });
  return response.data;
}

export async function leaveGroupChat(chatUuid: string) {
  const response = await apiClient.post(`/chats/${chatUuid}/leave/`);
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
