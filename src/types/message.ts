import type { UserShort } from '@/src/types/user';

export type MessageAttachment = {
  uuid: string;
  file_url?: string | null;
  content_type?: string | null;
  original_name?: string | null;
  media_kind?: string | null;
};

export type ReplyMessageShort = {
  uuid: string;
  text?: string | null;
  message_type?: string | null;
  sender?: UserShort | null;
  created_at?: string | null;
};

export type MessageItem = {
  uuid: string;
  client_uuid?: string | null;
  message_type: 'text' | 'system' | 'sticker' | 'image' | 'video' | 'file' | 'audio';
  text?: string | null;
  reply_to?: ReplyMessageShort | null;
  metadata?: Record<string, unknown> | null;
  is_edited?: boolean;
  edited_at?: string | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
  sender?: UserShort | null;
  is_own_message?: boolean;
  delivered_to_count?: number;
  read_by_count?: number;
  delivery_status?: 'sent' | 'delivered' | 'read' | null;
  attachments?: MessageAttachment[];
  created_at?: string | null;
  updated_at?: string | null;

  local_status?: 'pending' | 'sent' | 'failed';
};

export type CursorPaginatedMessagesResponse = {
  next: string | null;
  previous: string | null;
  results: MessageItem[];
};