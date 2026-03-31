import type { UserShort } from '@/src/types/user';

export type ChatLastMessageObject = {
  uuid: string;
  text?: string | null;
  preview?: string | null;
  message_type?: string | null;
  created_at?: string | null;
};

export type ChatLastMessage = string | ChatLastMessageObject | null;

export type ChatMember = {
  uuid: string;
  role?: string;
  is_active?: boolean;
  is_muted?: boolean;
  is_pinned?: boolean;
  pinned_at?: string | null;
  is_archived?: boolean;
  archived_at?: string | null;
  can_send_messages?: boolean;
  last_read_at?: string | null;
  joined_at?: string | null;
  user?: UserShort | null;
};

export type ChatListItem = {
  uuid: string;
  chat_type: 'direct' | 'group';
  title?: string | null;
  description?: string | null;
  avatar?: string | null;
  display_title?: string | null;
  peer_user?: UserShort | null;
  members_count?: number | null;
  last_message_at?: string | null;
  is_public?: boolean | null;
  members?: ChatMember[] | null;
  last_message?: ChatLastMessage;
  unread_count?: number | string | null;
  has_unread?: boolean | string | null;
  is_pinned?: boolean | string | null;
  pinned_at?: string | null;
  is_archived?: boolean | string | null;
  is_muted?: boolean | string | null;
  last_read_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PaginatedChatsResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: ChatListItem[];
};