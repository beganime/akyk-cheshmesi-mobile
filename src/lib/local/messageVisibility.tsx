import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'chat_hidden_messages_v1_';

export type HiddenMessageMap = Record<string, true>;

function buildStorageKey(chatUuid: string) {
  return `${STORAGE_PREFIX}${chatUuid}`;
}

export async function loadHiddenMessageMap(chatUuid: string): Promise<HiddenMessageMap> {
  try {
    const raw = await AsyncStorage.getItem(buildStorageKey(chatUuid));

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return parsed as HiddenMessageMap;
  } catch (error) {
    console.error('loadHiddenMessageMap error:', error);
    return {};
  }
}

export async function saveHiddenMessageMap(chatUuid: string, map: HiddenMessageMap) {
  try {
    await AsyncStorage.setItem(buildStorageKey(chatUuid), JSON.stringify(map));
  } catch (error) {
    console.error('saveHiddenMessageMap error:', error);
  }
}

export async function hideMessageLocally(chatUuid: string, messageKey: string) {
  const current = await loadHiddenMessageMap(chatUuid);

  const next: HiddenMessageMap = {
    ...current,
    [messageKey]: true,
  };

  await saveHiddenMessageMap(chatUuid, next);
  return next;
}

export async function restoreMessageLocally(chatUuid: string, messageKey: string) {
  const current = await loadHiddenMessageMap(chatUuid);

  if (!current[messageKey]) {
    return current;
  }

  const next = { ...current };
  delete next[messageKey];

  await saveHiddenMessageMap(chatUuid, next);
  return next;
}

export function isMessageHidden(
  hiddenMap: HiddenMessageMap,
  messageKey?: string | null,
) {
  if (!messageKey) {
    return false;
  }

  return Boolean(hiddenMap[messageKey]);
}