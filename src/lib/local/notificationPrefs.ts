import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'notification_prefs_v1';

type NotificationPrefs = {
  pushEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  previewEnabled: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  pushEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  previewEnabled: true,
};

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return {
      pushEnabled:
        typeof parsed?.pushEnabled === 'boolean'
          ? parsed.pushEnabled
          : DEFAULT_PREFS.pushEnabled,
      soundEnabled:
        typeof parsed?.soundEnabled === 'boolean'
          ? parsed.soundEnabled
          : DEFAULT_PREFS.soundEnabled,
      vibrationEnabled:
        typeof parsed?.vibrationEnabled === 'boolean'
          ? parsed.vibrationEnabled
          : DEFAULT_PREFS.vibrationEnabled,
      previewEnabled:
        typeof parsed?.previewEnabled === 'boolean'
          ? parsed.previewEnabled
          : DEFAULT_PREFS.previewEnabled,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function setPushEnabled(value: boolean): Promise<void> {
  const current = await getNotificationPrefs();
  await saveNotificationPrefs({
    ...current,
    pushEnabled: value,
  });
}

export async function saveNotificationPrefs(value: NotificationPrefs): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(value),
  );
}
