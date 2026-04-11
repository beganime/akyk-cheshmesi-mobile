import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'notification_prefs_v1';

type NotificationPrefs = {
  pushEnabled: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  pushEnabled: true,
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
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function setPushEnabled(value: boolean): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      pushEnabled: value,
    }),
  );
}
