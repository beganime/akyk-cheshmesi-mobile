export type BotScope =
  | 'send_message'
  | 'read_messages'
  | 'manage_chat'
  | 'webhook'
  | string;

export type BotItem = {
  uuid: string;
  username: string;
  title: string;
  description?: string | null;
  scopes?: BotScope[];
  webhook_url?: string | null;
  token?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PaginatedBotsResponse = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: BotItem[];
};

export type BotCreatePayload = {
  username: string;
  title: string;
  description?: string;
  scopes?: BotScope[];
  webhook_url?: string;
};

export type BotUpdatePayload = Partial<BotCreatePayload>;

export type ChatBotMembership = {
  uuid?: string;
  bot?: BotItem | null;
  bot_uuid?: string | null;
  username?: string | null;
  title?: string | null;
  added_at?: string | null;
};

export type BotSendMessagePayload = {
  chat_uuid: string;
  text: string;
  message_type?: 'text';
  metadata?: Record<string, unknown>;
};

export type BotSendMessageResponse = {
  uuid?: string;
  chat_uuid?: string;
  text?: string | null;
};
