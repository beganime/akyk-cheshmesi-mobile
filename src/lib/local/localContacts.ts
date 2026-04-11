import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'local_contacts_v1';

async function readContacts(): Promise<Set<string>> {
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

export async function addLocalContact(userUuid: string) {
  const current = await readContacts();
  current.add(userUuid);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...current]));
}

export async function isLocalContact(userUuid?: string | null): Promise<boolean> {
  if (!userUuid) return false;
  const current = await readContacts();
  return current.has(userUuid);
}
