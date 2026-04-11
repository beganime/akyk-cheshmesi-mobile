import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'blocked_users_v1';

async function readBlockedSet(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.map((value) => String(value)).filter(Boolean));
  } catch {
    return new Set<string>();
  }
}

async function writeBlockedSet(value: Set<string>) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...value]));
}

export async function getBlockedUsers(): Promise<string[]> {
  return [...(await readBlockedSet())];
}

export async function isUserBlocked(userUuid?: string | null): Promise<boolean> {
  if (!userUuid) return false;
  const blocked = await readBlockedSet();
  return blocked.has(userUuid);
}

export async function blockUserLocal(userUuid: string) {
  const blocked = await readBlockedSet();
  blocked.add(userUuid);
  await writeBlockedSet(blocked);
}

export async function unblockUserLocal(userUuid: string) {
  const blocked = await readBlockedSet();
  blocked.delete(userUuid);
  await writeBlockedSet(blocked);
}
