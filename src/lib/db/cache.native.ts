import { getDb } from '@/src/lib/db';
import type { ChatListItem } from '@/src/types/chat';
import type { MessageItem } from '@/src/types/message';

function chatSortTs(chat: ChatListItem) {
  return new Date(chat.last_message_at || chat.updated_at || chat.created_at || 0).getTime() || 0;
}

function messageSortTs(message: MessageItem) {
  return new Date(message.created_at || 0).getTime() || 0;
}

export async function loadCachedChats(): Promise<ChatListItem[]> {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<{ payload_json: string }>(
      'SELECT payload_json FROM chat_cache ORDER BY sort_ts DESC'
    );

    return rows.map((row) => JSON.parse(row.payload_json));
  } catch (error) {
    console.error('loadCachedChats error:', error);
    return [];
  }
}

export async function saveCachedChats(chats: ChatListItem[]) {
  try {
    const db = await getDb();
    await db.execAsync('BEGIN');

    try {
      await db.execAsync('DELETE FROM chat_cache');

      for (const chat of chats) {
        await db.runAsync(
          'INSERT OR REPLACE INTO chat_cache (uuid, sort_ts, payload_json) VALUES (?, ?, ?)',
          chat.uuid,
          chatSortTs(chat),
          JSON.stringify(chat)
        );
      }

      await db.execAsync('COMMIT');
    } catch (error) {
      await db.execAsync('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('saveCachedChats error:', error);
  }
}

export async function loadCachedChatDetail(chatUuid: string): Promise<ChatListItem | null> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ payload_json: string }>(
      'SELECT payload_json FROM chat_cache WHERE uuid = ? LIMIT 1',
      chatUuid
    );

    return row ? JSON.parse(row.payload_json) : null;
  } catch (error) {
    console.error('loadCachedChatDetail error:', error);
    return null;
  }
}

export async function saveCachedChatDetail(chatUuid: string, chat: ChatListItem) {
  try {
    const db = await getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO chat_cache (uuid, sort_ts, payload_json) VALUES (?, ?, ?)',
      chatUuid,
      chatSortTs(chat),
      JSON.stringify(chat)
    );
  } catch (error) {
    console.error('saveCachedChatDetail error:', error);
  }
}

export async function loadCachedChatMessages(chatUuid: string): Promise<MessageItem[]> {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<{ payload_json: string }>(
      'SELECT payload_json FROM message_cache WHERE chat_uuid = ? ORDER BY created_ts ASC',
      chatUuid
    );

    return rows.map((row) => JSON.parse(row.payload_json));
  } catch (error) {
    console.error('loadCachedChatMessages error:', error);
    return [];
  }
}

export async function saveCachedChatMessages(chatUuid: string, messages: MessageItem[]) {
  try {
    const db = await getDb();
    await db.execAsync('BEGIN');

    try {
      await db.runAsync('DELETE FROM message_cache WHERE chat_uuid = ?', chatUuid);

      for (const message of messages) {
        await db.runAsync(
          'INSERT OR REPLACE INTO message_cache (uuid, chat_uuid, client_uuid, created_ts, local_status, payload_json) VALUES (?, ?, ?, ?, ?, ?)',
          message.uuid,
          chatUuid,
          message.client_uuid ?? null,
          messageSortTs(message),
          message.local_status ?? 'sent',
          JSON.stringify(message)
        );
      }

      await db.execAsync('COMMIT');
    } catch (error) {
      await db.execAsync('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('saveCachedChatMessages error:', error);
  }
}