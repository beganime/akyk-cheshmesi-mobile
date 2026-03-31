export type ChatListItem = {
  uuid: string;
  chat_type: 'direct' | 'group';
  title?: string | null;
  description?: string | null;
  avatar?: string | null;
  display_title?: string | null;
  peer_user?: string | null;
  members_count?: number | null;
  last_message_at?: string | null;
  is_public?: boolean | null;
  members?: unknown;
  last_message?: string | null;
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