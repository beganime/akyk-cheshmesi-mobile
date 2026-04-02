import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ChatListItem } from '@/src/types/chat';

const STORAGE_KEY = 'chat_local_preferences_v1';

export type ChatLocalPreference = {
  archivedLocally?: boolean;
  archivedAt?: number | null;
  pinnedLocally?: boolean;
  pinnedAt?: number | null;
  label?: string | null;
  labelColor?: string | null;
};

export type ChatLocalPreferenceMap = Record<string, ChatLocalPreference>;

export type ChatListItemWithLocal = ChatListItem & {
  local_archived?: boolean;
  local_archived_at?: number | null;
  local_pinned?: boolean;
  local_pinned_at?: number | null;
  local_label?: string | null;
  local_label_color?: string | null;
};

async function readMap(): Promise<ChatLocalPreferenceMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return parsed as ChatLocalPreferenceMap;
  } catch (error) {
    console.error('readMap chatPreferences error:', error);
    return {};
  }
}

async function writeMap(nextMap: ChatLocalPreferenceMap) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextMap));
  } catch (error) {
    console.error('writeMap chatPreferences error:', error);
  }
}

export async function getAllChatLocalPreferences(): Promise<ChatLocalPreferenceMap> {
  return readMap();
}

export async function getChatLocalPreference(chatUuid: string): Promise<ChatLocalPreference> {
  const map = await readMap();
  return map[chatUuid] ?? {};
}

export async function updateChatLocalPreference(
  chatUuid: string,
  patch: Partial<ChatLocalPreference>,
): Promise<ChatLocalPreferenceMap> {
  const current = await readMap();

  const next: ChatLocalPreferenceMap = {
    ...current,
    [chatUuid]: {
      ...(current[chatUuid] ?? {}),
      ...patch,
    },
  };

  await writeMap(next);
  return next;
}

export async function setChatArchivedLocally(chatUuid: string, archivedLocally: boolean) {
  return updateChatLocalPreference(chatUuid, {
    archivedLocally,
    archivedAt: archivedLocally ? Date.now() : null,
  });
}

export async function setChatPinnedLocally(chatUuid: string, pinnedLocally: boolean) {
  return updateChatLocalPreference(chatUuid, {
    pinnedLocally,
    pinnedAt: pinnedLocally ? Date.now() : null,
  });
}

export async function setChatLabelLocally(
  chatUuid: string,
  label: string | null,
  labelColor?: string | null,
) {
  return updateChatLocalPreference(chatUuid, {
    label: label?.trim() ? label.trim() : null,
    labelColor: label ? labelColor ?? '#6D84FF' : null,
  });
}

export function applyChatLocalPreferences(
  chats: ChatListItem[],
  preferencesMap: ChatLocalPreferenceMap,
): ChatListItemWithLocal[] {
  return chats.map((chat) => {
    const local = preferencesMap[chat.uuid] ?? {};

    return {
      ...chat,
      local_archived: Boolean(local.archivedLocally),
      local_archived_at: local.archivedAt ?? null,
      local_pinned: Boolean(local.pinnedLocally),
      local_pinned_at: local.pinnedAt ?? null,
      local_label: local.label ?? null,
      local_label_color: local.labelColor ?? null,
    };
  });
}

function getSortTimestamp(chat: ChatListItemWithLocal) {
  return new Date(chat.last_message_at || chat.updated_at || chat.created_at || 0).getTime() || 0;
}

export function sortChatsWithLocalState(chats: ChatListItemWithLocal[]) {
  return [...chats].sort((a, b) => {
    const aPinned = Boolean(a.local_pinned || a.is_pinned);
    const bPinned = Boolean(b.local_pinned || b.is_pinned);

    if (aPinned !== bPinned) {
      return aPinned ? -1 : 1;
    }

    const aPinnedAt = Number(a.local_pinned_at ?? 0);
    const bPinnedAt = Number(b.local_pinned_at ?? 0);

    if (aPinned && bPinned && aPinnedAt !== bPinnedAt) {
      return bPinnedAt - aPinnedAt;
    }

    return getSortTimestamp(b) - getSortTimestamp(a);
  });
}