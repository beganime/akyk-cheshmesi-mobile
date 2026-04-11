import AsyncStorage from '@react-native-async-storage/async-storage';

export type LocalChatPreference = {
  isPinned?: boolean;
  isArchived?: boolean;
  updatedAt?: string;
};

export type LocalChatPreferencesMap = Record<string, LocalChatPreference>;

const STORAGE_KEY = 'chat_list_preferences_v1';

export async function loadChatListPreferences(): Promise<LocalChatPreferencesMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return parsed as LocalChatPreferencesMap;
  } catch (error) {
    console.error('loadChatListPreferences error:', error);
    return {};
  }
}

export async function saveChatListPreferences(value: LocalChatPreferencesMap): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    console.error('saveChatListPreferences error:', error);
  }
}

export async function patchChatListPreference(
  chatUuid: string,
  patch: Partial<LocalChatPreference>,
): Promise<LocalChatPreferencesMap> {
  const current = await loadChatListPreferences();

  const next: LocalChatPreferencesMap = {
    ...current,
    [chatUuid]: {
      ...(current[chatUuid] || {}),
      ...patch,
      updatedAt: new Date().toISOString(),
    },
  };

  await saveChatListPreferences(next);
  return next;
}

export function getLocalChatPreference(
  map: LocalChatPreferencesMap,
  chatUuid?: string | null,
): LocalChatPreference {
  if (!chatUuid) {
    return {};
  }

  return map[chatUuid] || {};
}