import { Platform } from 'react-native';
import { getDb } from '@/src/lib/db';
import type { ChatListItem } from '@/src/types/chat';
import type { MessageListItem } from '@/src/types/message';

const WEB_CHATS_KEY = 'akyl_cache_chats_v1';
const WEB_MESSAGES_PREFIX = 'akyl_cache_messages_v1:';

function safeJsonParse<T>(value: string | null, fallback: T): T {
  try {
    if (!value) return fallback;
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function getChatSortTs(item: ChatListItem) {
  const source =
    item.last_message_at || item.updated_at || item.created_at || new Date().toISOString();
  return new Date(source).getTime() || Date.now();
}

function getMessageSortTs(item: MessageListItem) {
  return new Date(item.created_at).getTime() || Date.now();
}

function normalizeMessage(item: MessageListItem): MessageListItem {
  return {
    ...item,
    attachments: item.attachments ?? [],
    local_status: item.local_status ?? 'sent',
  };
}

function dedupeChats(items: ChatListItem[]) {
  const map = new Map<string, ChatListItem>();

  for (const item of items) {
    map.set(item.uuid, item);
  }

  return Array.from(map.values()).sort(
    (a, b) => getChatSortTs(b) - getChatSortTs(a)
  );
}

function dedupeMessages(items: MessageListItem[]) {
  const map = new Map<string, MessageListItem>();

  for (const item of items) {
    const key = item.uuid || item.client_uuid || `${item.created_at}-${item.text}`;
    map.set(key, normalizeMessage(item));
  }

  return Array.from(map.values()).sort(
    (a, b) => getMessageSortTs(b) - getMessageSortTs(a)
  );
}

function webMessagesKey(chatUuid: string) {
  return `${WEB_MESSAGES_PREFIX}${chatUuid}`;
}

export async function readCachedChats(): Promise<ChatListItem[]> {
  if (Platform.OS === 'web') {
    const raw = window.localStorage.getItem(WEB_CHATS_KEY);
    return dedupeChats(safeJsonParse<ChatListItem[]>(raw, []));
  }

  const db = await getDb();
  const rows = await db.getAllAsync<{ payload_json: string }>(
    `SELECT payload_json FROM chat_cache ORDER BY sort_ts DESC`
  );

  return dedupeChats(
    rows.map((row) => safeJsonParse<ChatListItem>(row.payload_json, {} as ChatListItem))
  );
}

export async function upsertChats(chats: ChatListItem[]): Promise<void> {
  if (!chats.length) return;

  if (Platform.OS === 'web') {
    const current = await readCachedChats();
    const merged = dedupeChats([...chats, ...current]);
    window.localStorage.setItem(WEB_CHATS_KEY, JSON.stringify(merged));
    return;
  }

  const db = await getDb();

  for (const chat of chats) {
    await db.runAsync(
      `
      INSERT INTO chat_cache (uuid, sort_ts, payload_json)
      VALUES (?, ?, ?)
      ON CONFLICT(uuid) DO UPDATE SET
        sort_ts = excluded.sort_ts,
        payload_json = excluded.payload_json
      `,
      chat.uuid,
      getChatSortTs(chat),
      JSON.stringify(chat)
    );
  }
}

export async function readCachedMessages(chatUuid: string): Promise<MessageListItem[]> {
  if (Platform.OS === 'web') {
    const raw = window.localStorage.getItem(webMessagesKey(chatUuid));
    return dedupeMessages(safeJsonParse<MessageListItem[]>(raw, []));
  }

  const db = await getDb();
  const rows = await db.getAllAsync<{ payload_json: string }>(
    `
    SELECT payload_json
    FROM message_cache
    WHERE chat_uuid = ?
    ORDER BY created_ts DESC
    `,
    chatUuid
  );

  return dedupeMessages(
    rows.map((row) =>
      safeJsonParse<MessageListItem>(row.payload_json, {} as MessageListItem)
    )
  );
}

export async function upsertMessages(
  chatUuid: string,
  messages: MessageListItem[]
): Promise<void> {
  if (!messages.length) return;

  const normalized = dedupeMessages(
    messages.map((item) => ({
      ...item,
      chat_uuid: chatUuid,
      local_status: item.local_status ?? 'sent',
    }))
  );

  if (Platform.OS === 'web') {
    const current = await readCachedMessages(chatUuid);
    const merged = dedupeMessages([...normalized, ...current]);
    window.localStorage.setItem(webMessagesKey(chatUuid), JSON.stringify(merged));
    return;
  }

  const db = await getDb();

  for (const message of normalized) {
    await db.runAsync(
      `
      INSERT INTO message_cache (
        uuid,
        chat_uuid,
        client_uuid,
        created_ts,
        local_status,
        payload_json
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(uuid) DO UPDATE SET
        chat_uuid = excluded.chat_uuid,
        client_uuid = excluded.client_uuid,
        created_ts = excluded.created_ts,
        local_status = excluded.local_status,
        payload_json = excluded.payload_json
      `,
      message.uuid,
      chatUuid,
      message.client_uuid ?? null,
      getMessageSortTs(message),
      message.local_status ?? 'sent',
      JSON.stringify(message)
    );
  }
}

export async function insertPendingMessage(
  chatUuid: string,
  message: MessageListItem
): Promise<void> {
  await upsertMessages(chatUuid, [
    {
      ...message,
      chat_uuid: chatUuid,
      local_status: 'pending',
    },
  ]);
}

export async function replacePendingMessage(
  chatUuid: string,
  clientUuid: string,
  serverMessage: MessageListItem
): Promise<void> {
  if (Platform.OS === 'web') {
    const current = await readCachedMessages(chatUuid);
    const filtered = current.filter((item) => item.client_uuid !== clientUuid);
    const merged = dedupeMessages([
      {
        ...serverMessage,
        chat_uuid: chatUuid,
        local_status: 'sent',
      },
      ...filtered,
    ]);

    window.localStorage.setItem(webMessagesKey(chatUuid), JSON.stringify(merged));
    return;
  }

  const db = await getDb();

  await db.runAsync(
    `DELETE FROM message_cache WHERE chat_uuid = ? AND client_uuid = ?`,
    chatUuid,
    clientUuid
  );

  await upsertMessages(chatUuid, [
    {
      ...serverMessage,
      chat_uuid: chatUuid,
      local_status: 'sent',
    },
  ]);
}

export async function markPendingMessageFailed(
  chatUuid: string,
  clientUuid: string
): Promise<void> {
  if (Platform.OS === 'web') {
    const current = await readCachedMessages(chatUuid);
    const next = current.map((item) =>
      item.client_uuid === clientUuid
        ? {
            ...item,
            local_status: 'failed' as const,
          }
        : item
    );

    window.localStorage.setItem(webMessagesKey(chatUuid), JSON.stringify(next));
    return;
  }

  const db = await getDb();
  const rows = await db.getAllAsync<{ uuid: string; payload_json: string }>(
    `
    SELECT uuid, payload_json
    FROM message_cache
    WHERE chat_uuid = ? AND client_uuid = ?
    `,
    chatUuid,
    clientUuid
  );

  for (const row of rows) {
    const parsed = safeJsonParse<MessageListItem>(row.payload_json, {} as MessageListItem);

    await db.runAsync(
      `
      UPDATE message_cache
      SET local_status = ?, payload_json = ?
      WHERE uuid = ?
      `,
      'failed',
      JSON.stringify({
        ...parsed,
        local_status: 'failed',
      }),
      row.uuid
    );
  }
}