import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

let dbPromise: Promise<SQLiteDatabase> | null = null;

async function createDatabase() {
  const db = await SQLite.openDatabaseAsync('akyl-cheshmesi.db');

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS chats (
      uuid TEXT PRIMARY KEY NOT NULL,
      display_title TEXT,
      avatar TEXT,
      last_message TEXT,
      last_message_at TEXT,
      unread_count INTEGER DEFAULT 0,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      uuid TEXT PRIMARY KEY NOT NULL,
      client_uuid TEXT,
      chat_uuid TEXT NOT NULL,
      sender_uuid TEXT,
      body TEXT,
      media_url TEXT,
      status TEXT DEFAULT 'sent',
      created_at TEXT,
      updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_messages_chat_uuid ON messages(chat_uuid);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
  `);

  return db;
}

export async function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = createDatabase();
  }

  return dbPromise;
}

export async function initializeDatabase(): Promise<void> {
  await getDb();
}