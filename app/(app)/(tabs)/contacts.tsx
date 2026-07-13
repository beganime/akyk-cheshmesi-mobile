import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import * as Contacts from 'expo-contacts';

import { createDirectChat } from '@/src/lib/api/chats';
import { fetchContacts, searchUsers, type UserShort } from '@/src/lib/api/contacts';
import { ensureCallPermissions } from '@/src/lib/calls/permissions';
import { addLocalContact, getLocalContacts, removeLocalContact } from '@/src/lib/local/localContacts';
import { useCallStore } from '@/src/state/call';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { CallType } from '@/src/types/calls';
import { getApiErrorMessage } from '@/src/utils/apiErrors';

type TabName = 'app' | 'phone';

function displayName(user: UserShort) {
  return (
    user.full_name ||
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    user.username ||
    user.email ||
    'Без имени'
  );
}

function userSubtitle(user: UserShort) {
  if (user.username) return `@${user.username}`;
  return user.phone_number || user.phone || user.email || 'Пользователь Akyl Çeşmesi';
}

function devicePhone(contact: Contacts.ExistingContact) {
  return contact.phoneNumbers?.find((item) => item.isPrimary)?.number ||
    contact.phoneNumbers?.[0]?.number ||
    '';
}

function avatarInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || 'A';
}

export default function ContactsScreen() {
  const { theme } = useTheme();
  const startOutgoing = useCallStore((state) => state.startOutgoing);
  const [tab, setTab] = useState<TabName>('app');
  const [savedUsers, setSavedUsers] = useState<UserShort[]>([]);
  const [deviceContacts, setDeviceContacts] = useState<Contacts.ExistingContact[]>([]);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserShort[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyUuid, setBusyUuid] = useState<string | null>(null);

  const loadAppContacts = useCallback(async () => {
    const [apiContacts, localUuids] = await Promise.all([fetchContacts(), getLocalContacts()]);
    const localSet = new Set(localUuids);
    const users = apiContacts
      .map((item) => item.user)
      .filter((user): user is UserShort => Boolean(user?.uuid && localSet.has(user.uuid)));

    setSavedUsers(users);
  }, []);

  const loadDeviceContacts = useCallback(async (requestPermission = false) => {
    if (Platform.OS === 'web') {
      setPermissionGranted(false);
      setDeviceContacts([]);
      return;
    }

    const permission = requestPermission
      ? await Contacts.requestPermissionsAsync()
      : await Contacts.getPermissionsAsync();
    const granted = permission.granted;
    setPermissionGranted(granted);

    if (!granted) {
      setDeviceContacts([]);
      return;
    }

    const response = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails, Contacts.Fields.Image],
      sort: Contacts.SortTypes.FirstName,
    });
    setDeviceContacts(response.data.filter((contact) => Boolean(devicePhone(contact))));
  }, []);

  const load = useCallback(async (requestPermission = false) => {
    try {
      setRefreshing(true);
      await Promise.all([loadAppContacts(), loadDeviceContacts(requestPermission)]);
    } catch (error) {
      Alert.alert('Контакты', getApiErrorMessage(error, 'Не удалось загрузить контакты'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadAppContacts, loadDeviceContacts]);

  useEffect(() => {
    void load(false);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void loadAppContacts().catch(() => undefined);
    }, [loadAppContacts]),
  );

  useEffect(() => {
    if (tab !== 'app' || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      searchUsers(query)
        .then((items) => {
          if (active) setSearchResults(items);
        })
        .catch(() => {
          if (active) setSearchResults([]);
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, tab]);

  const visibleAppUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const savedSet = new Set(savedUsers.map((item) => item.uuid));
    const combined = normalized.length >= 2
      ? [...savedUsers, ...searchResults.filter((item) => !savedSet.has(item.uuid))]
      : savedUsers;

    if (!normalized) return combined;
    return combined.filter((user) =>
      `${displayName(user)} ${userSubtitle(user)}`.toLowerCase().includes(normalized),
    );
  }, [query, savedUsers, searchResults]);

  const visibleDeviceContacts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return deviceContacts;
    return deviceContacts.filter((contact) =>
      `${contact.name} ${devicePhone(contact)}`.toLowerCase().includes(normalized),
    );
  }, [deviceContacts, query]);

  const savedSet = useMemo(() => new Set(savedUsers.map((item) => item.uuid)), [savedUsers]);

  const openChat = async (user: UserShort) => {
    try {
      setBusyUuid(user.uuid);
      const chat = await createDirectChat(user.uuid);
      if (!chat?.uuid) throw new Error('Сервер не вернул идентификатор чата');
      router.push({ pathname: '/(app)/chat/[chatUuid]', params: { chatUuid: chat.uuid } });
    } catch (error) {
      Alert.alert('Чат', getApiErrorMessage(error, 'Не удалось открыть чат'));
    } finally {
      setBusyUuid(null);
    }
  };

  const toggleSaved = async (user: UserShort) => {
    try {
      setBusyUuid(user.uuid);
      if (savedSet.has(user.uuid)) {
        await removeLocalContact(user.uuid);
      } else {
        await addLocalContact(user.uuid);
      }
      await loadAppContacts();
    } catch (error) {
      Alert.alert('Контакты', getApiErrorMessage(error, 'Не удалось изменить контакт'));
    } finally {
      setBusyUuid(null);
    }
  };

  const saveToPhone = async (user: UserShort) => {
    const phone = user.phone_number || user.phone;
    if (!phone) {
      Alert.alert('Телефонная книга', 'У пользователя не указан номер телефона');
      return;
    }

    const permission = await Contacts.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Телефонная книга', 'Разрешите доступ к контактам в настройках телефона');
      return;
    }

    await Contacts.addContactAsync({
      contactType: Contacts.ContactTypes.Person,
      name: displayName(user),
      firstName: user.first_name || displayName(user),
      lastName: user.last_name || undefined,
      phoneNumbers: [{ label: 'mobile', number: phone }],
      emails: user.email ? [{ label: 'email', email: user.email }] : undefined,
    });
    await loadDeviceContacts(false);
    Alert.alert('Готово', 'Контакт добавлен в телефонную книгу');
  };

  const startCall = async (user: UserShort, callType: CallType) => {
    try {
      setBusyUuid(user.uuid);
      if (!(await ensureCallPermissions(callType))) return;
      const chat = await createDirectChat(user.uuid);
      if (!chat?.uuid) throw new Error('Не удалось создать чат для звонка');
      const call = await startOutgoing(chat.uuid, callType);
      router.push({ pathname: '/(app)/call/[callUuid]', params: { callUuid: call.uuid } });
    } catch (error) {
      Alert.alert('Звонок не начат', getApiErrorMessage(error, 'Проверьте соединение и повторите'));
    } finally {
      setBusyUuid(null);
    }
  };

  const inviteDeviceContact = async (contact: Contacts.ExistingContact) => {
    const phone = devicePhone(contact);
    if (!phone) return;
    const url = `sms:${phone}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
  };

  const renderAppUser = ({ item }: { item: UserShort }) => {
    const saved = savedSet.has(item.uuid);
    const busy = busyUuid === item.uuid;
    return (
      <View style={[styles.row, { borderBottomColor: theme.colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.primarySoft }]}>
          {item.avatar ? (
            <ExpoImage source={{ uri: item.avatar }} style={styles.avatarImage} cachePolicy="memory-disk" />
          ) : (
            <Text style={[styles.avatarText, { color: theme.colors.primary }]}>{avatarInitial(displayName(item))}</Text>
          )}
        </View>
        <Pressable style={styles.rowText} onPress={() => void openChat(item)}>
          <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>{displayName(item)}</Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]} numberOfLines={1}>{userSubtitle(item)}</Text>
        </Pressable>
        {busy ? <ActivityIndicator color={theme.colors.primary} /> : (
          <View style={styles.actions}>
            <Pressable style={styles.iconButton} onPress={() => void startCall(item, 'audio')}>
              <Ionicons name="call-outline" size={19} color={theme.colors.muted} />
            </Pressable>
            <Pressable style={styles.iconButton} onPress={() => void toggleSaved(item)}>
              <Ionicons name={saved ? 'person-remove-outline' : 'person-add-outline'} size={20} color={theme.colors.primary} />
            </Pressable>
            {!saved && (item.phone_number || item.phone) ? (
              <Pressable style={styles.iconButton} onPress={() => void saveToPhone(item)}>
                <Ionicons name="phone-portrait-outline" size={19} color={theme.colors.muted} />
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
    );
  };

  const renderPhoneContact = ({ item }: { item: Contacts.ExistingContact }) => (
    <View style={[styles.row, { borderBottomColor: theme.colors.border }]}>
      <View style={[styles.avatar, { backgroundColor: theme.colors.backgroundTertiary }]}>
        {item.image?.uri ? (
          <ExpoImage source={{ uri: item.image.uri }} style={styles.avatarImage} cachePolicy="memory-disk" />
        ) : (
          <Text style={[styles.avatarText, { color: theme.colors.text }]}>{avatarInitial(item.name)}</Text>
        )}
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>{item.name || 'Без имени'}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.muted }]} numberOfLines={1}>{devicePhone(item)}</Text>
      </View>
      <Pressable style={[styles.inviteButton, { borderColor: theme.colors.borderStrong }]} onPress={() => void inviteDeviceContact(item)}>
        <Text style={[styles.inviteText, { color: theme.colors.primary }]}>Пригласить</Text>
      </Pressable>
    </View>
  );

  const listEmpty = tab === 'phone' && permissionGranted === false ? (
    <View style={styles.empty}>
      <Ionicons name="people-outline" size={34} color={theme.colors.muted} />
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Откройте телефонную книгу</Text>
      <Text style={[styles.emptyText, { color: theme.colors.muted }]}>Доступ нужен только для показа контактов на этом устройстве.</Text>
      {Platform.OS !== 'web' ? (
        <Pressable style={[styles.permissionButton, { backgroundColor: theme.colors.primary }]} onPress={() => void load(true)}>
          <Text style={{ color: theme.isDark ? '#181716' : '#ffffff', fontWeight: '700' }}>Разрешить доступ</Text>
        </Pressable>
      ) : null}
    </View>
  ) : (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>{query ? 'Ничего не найдено' : 'Контактов пока нет'}</Text>
      <Text style={[styles.emptyText, { color: theme.colors.muted }]}>
        {tab === 'app' ? 'Найдите пользователя и добавьте его вручную.' : 'В телефонной книге нет контактов с номером.'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Контакты</Text>
        <Text style={[styles.caption, { color: theme.colors.muted }]}>Люди, которых вы сохранили</Text>
      </View>

      <View style={[styles.segment, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        {([['app', 'В приложении'], ['phone', 'В телефоне']] as const).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => { setTab(value); setQuery(''); }}
            style={[styles.segmentItem, tab === value && { backgroundColor: theme.colors.primarySoft }]}
          >
            <Text style={[styles.segmentText, { color: tab === value ? theme.colors.primary : theme.colors.muted }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.search, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <Ionicons name="search" size={18} color={theme.colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={tab === 'app' ? 'Имя, username или email' : 'Поиск в телефоне'}
          placeholderTextColor={theme.colors.muted}
          style={[styles.searchInput, { color: theme.colors.text }]}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query ? <Pressable onPress={() => setQuery('')}><Ionicons name="close-circle" size={18} color={theme.colors.muted} /></Pressable> : null}
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={theme.colors.primary} /></View>
      ) : tab === 'app' ? (
        <FlatList<UserShort>
          data={visibleAppUsers}
          keyExtractor={(item) => item.uuid}
          renderItem={renderAppUser}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(false)} tintColor={theme.colors.primary} />}
          ListEmptyComponent={listEmpty}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <FlatList<Contacts.ExistingContact>
          data={visibleDeviceContacts}
          keyExtractor={(item) => item.id}
          renderItem={renderPhoneContact}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(false)} tintColor={theme.colors.primary} />}
          ListEmptyComponent={listEmpty}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14 },
  title: { fontSize: 30, fontWeight: '500', letterSpacing: 0 },
  caption: { marginTop: 3, fontSize: 13 },
  segment: { marginHorizontal: 16, borderWidth: 1, borderRadius: 10, padding: 3, flexDirection: 'row' },
  segmentItem: { flex: 1, minHeight: 38, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 13, fontWeight: '700' },
  search: { margin: 16, marginBottom: 6, minHeight: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 9 },
  listContent: { paddingHorizontal: 16, paddingBottom: 96 },
  row: { minHeight: 72, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontSize: 18, fontWeight: '700' },
  rowText: { flex: 1, minWidth: 0, paddingVertical: 12 },
  name: { fontSize: 16, fontWeight: '700' },
  subtitle: { marginTop: 3, fontSize: 13 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { width: 38, height: 40, alignItems: 'center', justifyContent: 'center' },
  inviteButton: { minHeight: 36, borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  inviteText: { fontSize: 12, fontWeight: '700' },
  empty: { paddingHorizontal: 34, paddingTop: 80, alignItems: 'center' },
  emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyText: { marginTop: 7, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  permissionButton: { marginTop: 18, minHeight: 44, borderRadius: 10, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
});
