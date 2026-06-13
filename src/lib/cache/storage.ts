import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';

const CACHE_PREFIXES = [
  'cache_',
  'akyl_cache_',
  'chat_appearance_',
  'chat_list_preferences_',
  'local_contacts_',
  'blocked_users_',
  'notification_prefs_',
];

export type CacheStats = {
  keys: number;
  bytes: number;
};

function isCacheKey(key: string) {
  return CACHE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function bytesToText(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatCacheSize(bytes: number) {
  return bytesToText(bytes);
}

export async function getLocalCacheStats(): Promise<CacheStats> {
  const keys = (await AsyncStorage.getAllKeys()).filter(isCacheKey);
  const entries = await AsyncStorage.multiGet(keys);
  const bytes = entries.reduce((total, [key, value]) => {
    return total + key.length + (value?.length || 0);
  }, 0);

  return { keys: keys.length, bytes };
}

export async function clearLocalJsonCache(): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys()).filter(isCacheKey);
  if (keys.length) {
    await AsyncStorage.multiRemove(keys);
  }
}

export async function clearImageMemoryCache(): Promise<void> {
  await (ExpoImage as any).clearMemoryCache?.();
}

export async function clearImageDiskCache(): Promise<void> {
  await (ExpoImage as any).clearDiskCache?.();
}

export async function clearAllAppCaches(): Promise<void> {
  await Promise.allSettled([
    clearLocalJsonCache(),
    clearImageMemoryCache(),
    clearImageDiskCache(),
  ]);
}
