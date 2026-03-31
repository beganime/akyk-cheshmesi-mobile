import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

let dbPromise: Promise<SQLiteDatabase> | null = null;

async function createDatabase() {
  const db = await SQLite.openDatabaseAsync('akyl-cheshmesi.db');

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS chat_cache (
      uuid TEXT PRIMARY KEY NOT NULL,
      sort_ts INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chat_cache_sort_ts
      ON chat_cache(sort_ts DESC);

    CREATE TABLE IF NOT EXISTS message_cache (
      uuid TEXT PRIMARY KEY NOT NULL,
      chat_uuid TEXT NOT NULL,
      client_uuid TEXT,
      created_ts INTEGER NOT NULL DEFAULT 0,
      local_status TEXT DEFAULT 'sent',
      payload_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_message_cache_chat_uuid_created_ts
      ON message_cache(chat_uuid, created_ts DESC);

    CREATE INDEX IF NOT EXISTS idx_message_cache_chat_uuid_client_uuid
      ON message_cache(chat_uuid, client_uuid);
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