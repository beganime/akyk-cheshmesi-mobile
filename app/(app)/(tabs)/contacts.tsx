import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  FlatList,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';

import { GlassCard } from '@/src/components/GlassCard';
import { SearchInput } from '@/src/components/SearchInput';
import { useTheme } from '@/src/theme/ThemeProvider';
import { fetchChats, createDirectChat } from '@/src/lib/api/chats';
import {
  fetchContactDetail,
  fetchContacts,
  type UserContactApiItem,
  type UserShort,
} from '@/src/lib/api/contacts';
import { ensureCallPermissions } from '@/src/lib/calls/permissions';
import { useAuthStore } from '@/src/state/auth';
import { useCallStore } from '@/src/state/call';
import type { CallType } from '@/src/types/calls';
import type { ChatListItem, ChatMember } from '@/src/types/chat';

type ContactUser = {
  uuid: string;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  phone_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  avatar?: string | null;
  badge?: string | null;
  is_admin?: boolean | null;
  is_staff?: boolean | null;
};

type ContactItem = {
  key: string;
  contact_uuid?: string | null;
  user_uuid: string;
  chat_uuid: string | null;
  source_chat_uuid: string | null;
  source?: string | null;
  last_interaction_at?: string | null;
  is_favorite?: boolean | null;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  phone_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  avatar?: string | null;
  badge?: string | null;
  is_admin?: boolean | null;
  is_staff?: boolean | null;
};

type ContactRowProps = {
  item: ContactItem;
  theme: any;
  isExpanded: boolean;
  isBusy: boolean;
  onToggleExpand: (item: ContactItem) => void;
  onOpenProfile: (item: ContactItem) => void;
  onOpenChat: (item: ContactItem) => void;
  onOpenCallChooser: (item: ContactItem) => void;
};

const SWIPE_ACTION_WIDTH = 96;

function fullName(user?: Partial<ContactUser> | null, fallback?: string | null) {
  if (!user) return fallback || 'Без имени';

  return (
    user.full_name ||
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    user.username ||
    user.email ||
    fallback ||
    'Без имени'
  );
}

function getPhone(user?: Partial<ContactUser> | null) {
  return user?.phone_number || user?.phone || null;
}

function getContactSubtitle(item: ContactItem) {
  if (item.email) return item.email;
  if (getPhone(item)) return getPhone(item);
  if (item.username) return `@${item.username}`;
  return 'Данных пока нет';
}

function formatSource(source?: string | null) {
  if (!source) return 'Не указан';
  if (source === 'chat') return 'Из переписки';
  return source;
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Не указано';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Не указано';
  }

  return `${date.toLocaleDateString([], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })} ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function normalizeUserFromApi(user?: UserShort | null): ContactUser | null {
  if (!user?.uuid) return null;

  return {
    uuid: user.uuid,
    username: user.username ?? null,
    email: user.email ?? null,
    phone: user.phone ?? null,
    phone_number: user.phone_number ?? null,
    first_name: user.first_name ?? null,
    last_name: user.last_name ?? null,
    full_name: user.full_name ?? null,
    avatar: user.avatar ?? null,
    badge: user.badge ?? null,
    is_admin: Boolean(user.is_admin),
    is_staff: Boolean(user.is_staff || user.badge === 'staff'),
  };
}

function normalizeContactFromApi(item: UserContactApiItem): ContactItem | null {
  const user = normalizeUserFromApi(item.user);

  if (!user?.uuid) {
    return null;
  }

  return {
    key: user.uuid,
    contact_uuid: item.uuid,
    user_uuid: user.uuid,
    chat_uuid: null,
    source_chat_uuid: null,
    source: item.source ?? null,
    last_interaction_at: item.last_interaction_at ?? null,
    is_favorite: Boolean(item.is_favorite),
    username: user.username ?? null,
    email: user.email ?? null,
    phone: user.phone ?? null,
    phone_number: user.phone_number ?? null,
    first_name: user.first_name ?? null,
    last_name: user.last_name ?? null,
    full_name: user.full_name ?? null,
    avatar: user.avatar ?? null,
    badge: user.badge ?? null,
    is_admin: Boolean(user.is_admin),
    is_staff: Boolean(user.is_staff || user.badge === 'staff'),
  };
}

function normalizeMemberUser(member?: ChatMember | null): ContactUser | null {
  const user: any = member?.user;

  if (!user?.uuid) {
    return null;
  }

  return {
    uuid: user.uuid,
    username: user.username ?? null,
    email: user.email ?? null,
    phone: user.phone ?? null,
    phone_number: user.phone_number ?? null,
    first_name: user.first_name ?? null,
    last_name: user.last_name ?? null,
    full_name: user.full_name ?? null,
    avatar: user.avatar ?? null,
    badge: user.badge ?? null,
    is_admin: Boolean(user.is_admin),
    is_staff: Boolean(user.is_staff || user.badge === 'staff'),
  };
}

function buildContactsFromChats(chats: ChatListItem[], currentUserUuid?: string | null): ContactItem[] {
  const map = new Map<string, ContactItem>();

  const upsert = (
    user: ContactUser,
    options: { chatUuid?: string | null; sourceChatUuid?: string | null },
  ) => {
    if (!user?.uuid || user.uuid === currentUserUuid) {
      return;
    }

    const existing = map.get(user.uuid);

    const nextValue: ContactItem = {
      key: user.uuid,
      user_uuid: user.uuid,
      contact_uuid: existing?.contact_uuid ?? null,
      chat_uuid: existing?.chat_uuid || options.chatUuid || null,
      source_chat_uuid: existing?.source_chat_uuid || options.sourceChatUuid || null,
      source: existing?.source || 'chat',
      last_interaction_at: existing?.last_interaction_at ?? null,
      is_favorite: Boolean(existing?.is_favorite),
      username: user.username ?? existing?.username ?? null,
      email: user.email ?? existing?.email ?? null,
      phone: user.phone ?? existing?.phone ?? null,
      phone_number: user.phone_number ?? existing?.phone_number ?? null,
      first_name: user.first_name ?? existing?.first_name ?? null,
      last_name: user.last_name ?? existing?.last_name ?? null,
      full_name: user.full_name ?? existing?.full_name ?? null,
      avatar: user.avatar ?? existing?.avatar ?? null,
      badge: user.badge ?? existing?.badge ?? null,
      is_admin: Boolean(user.is_admin || existing?.is_admin),
      is_staff: Boolean(user.is_staff || existing?.is_staff || user.badge === 'staff'),
    };

    if (!nextValue.chat_uuid && options.chatUuid) {
      nextValue.chat_uuid = options.chatUuid;
    }

    map.set(user.uuid, nextValue);
  };

  chats.forEach((chat) => {
    const directPeer: any = chat.peer_user;

    if (directPeer?.uuid && directPeer.uuid !== currentUserUuid) {
      upsert(
        {
          uuid: directPeer.uuid,
          username: directPeer.username ?? null,
          email: directPeer.email ?? null,
          phone: directPeer.phone ?? null,
          phone_number: directPeer.phone_number ?? null,
          first_name: directPeer.first_name ?? null,
          last_name: directPeer.last_name ?? null,
          full_name: directPeer.full_name ?? null,
          avatar: directPeer.avatar ?? null,
          badge: directPeer.badge ?? null,
          is_admin: Boolean(directPeer.is_admin),
          is_staff: Boolean(directPeer.is_staff || directPeer.badge === 'staff'),
        },
        { chatUuid: chat.uuid, sourceChatUuid: chat.uuid },
      );
    }

    if (Array.isArray(chat.members)) {
      chat.members.forEach((member) => {
        const normalized = normalizeMemberUser(member);

        if (!normalized || normalized.uuid === currentUserUuid) {
          return;
        }

        upsert(normalized, {
          chatUuid: chat.chat_type === 'direct' ? chat.uuid : null,
          sourceChatUuid: chat.uuid,
        });
      });
    }
  });

  return [...map.values()].sort((a, b) =>
    fullName(a).localeCompare(fullName(b), 'ru'),
  );
}

function mergeContactItems(primary: ContactItem[], fallback: ContactItem[]): ContactItem[] {
  const map = new Map<string, ContactItem>();

  fallback.forEach((item) => {
    map.set(item.user_uuid, item);
  });

  primary.forEach((item) => {
    const existing = map.get(item.user_uuid);

    map.set(item.user_uuid, {
      ...(existing || item),
      ...item,
      chat_uuid: existing?.chat_uuid || item.chat_uuid || null,
      source_chat_uuid: existing?.source_chat_uuid || item.source_chat_uuid || null,
      email: item.email ?? existing?.email ?? null,
      phone: item.phone ?? existing?.phone ?? null,
      phone_number: item.phone_number ?? existing?.phone_number ?? null,
      first_name: item.first_name ?? existing?.first_name ?? null,
      last_name: item.last_name ?? existing?.last_name ?? null,
      full_name: item.full_name ?? existing?.full_name ?? null,
      avatar: item.avatar ?? existing?.avatar ?? null,
      username: item.username ?? existing?.username ?? null,
      badge: item.badge ?? existing?.badge ?? null,
    });
  });

  return [...map.values()].sort((a, b) =>
    fullName(a).localeCompare(fullName(b), 'ru'),
  );
}

async function loadServerContactsWithDetails(): Promise<ContactItem[]> {
  const contacts = await fetchContacts();

  const details = await Promise.allSettled(
    contacts.map(async (contact) => {
      const userUuid = contact.user?.uuid;

      if (!userUuid) {
        return contact;
      }

      try {
        return await fetchContactDetail(userUuid);
      } catch {
        return contact;
      }
    }),
  );

  return details
    .map((result, index) => {
      const value = result.status === 'fulfilled' ? result.value : contacts[index];
      return normalizeContactFromApi(value);
    })
    .filter(Boolean) as ContactItem[];
}

function ContactRow({
  item,
  theme,
  isExpanded,
  isBusy,
  onToggleExpand,
  onOpenProfile,
  onOpenChat,
  onOpenCallChooser,
}: ContactRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [opened, setOpened] = useState(false);

  const name = fullName(item);
  const phone = getPhone(item);
  const isStaff = Boolean(item.is_admin || item.is_staff || item.badge === 'staff');

  const openSwipe = useCallback(() => {
    Animated.spring(translateX, {
      toValue: -SWIPE_ACTION_WIDTH,
      useNativeDriver: true,
      speed: 18,
      bounciness: 4,
    }).start(() => setOpened(true));
  }, [translateX]);

  const closeSwipe = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 4,
    }).start(() => setOpened(false));
  }, [translateX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => {
          return Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy);
        },
        onPanResponderMove: (_, gesture) => {
          const base = opened ? -SWIPE_ACTION_WIDTH : 0;
          const nextValue = Math.max(-SWIPE_ACTION_WIDTH, Math.min(0, base + gesture.dx));
          translateX.setValue(nextValue);
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx < -36 || (opened && gesture.dx < 28)) {
            openSwipe();
          } else {
            closeSwipe();
          }
        },
        onPanResponderTerminate: () => {
          closeSwipe();
        },
      }),
    [closeSwipe, openSwipe, opened, translateX],
  );

  const handleCallPress = () => {
    closeSwipe();
    onOpenCallChooser(item);
  };

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.hiddenActionWrap}>
        <Pressable
          onPress={handleCallPress}
          style={({ pressed }) => [
            styles.hiddenCallButton,
            {
              backgroundColor: theme.colors.primary,
              opacity: pressed ? 0.78 : 1,
            },
          ]}
        >
          <Ionicons name="call" size={20} color="#FFFFFF" />
          <Text style={styles.hiddenCallText}>Позвонить</Text>
        </Pressable>
      </View>

      <Animated.View
        style={[
          styles.swipeForeground,
          {
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <Pressable onPress={() => onToggleExpand(item)}>
          <GlassCard>
            <View style={styles.row}>
              {item.avatar ? (
                <ExpoImage source={{ uri: item.avatar }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
                </View>
              )}

              <View style={styles.content}>
                <View style={styles.titleRow}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
                      {name}
                    </Text>

                    {isStaff ? <Ionicons name="star" size={14} color="#3B82F6" /> : null}
                    {item.is_favorite ? <Ionicons name="heart" size={14} color="#EF4444" /> : null}
                  </View>

                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={theme.colors.muted}
                  />
                </View>

                <Text style={[styles.username, { color: theme.colors.muted }]} numberOfLines={1}>
                  {getContactSubtitle(item)}
                </Text>

                <View style={styles.quickInfoRow}>
                  {item.email ? (
                    <View style={[styles.infoChip, { backgroundColor: theme.colors.card }]}>
                      <Ionicons name="mail-outline" size={12} color={theme.colors.muted} />
                      <Text style={[styles.infoChipText, { color: theme.colors.muted }]} numberOfLines={1}>
                        {item.email}
                      </Text>
                    </View>
                  ) : null}

                  {phone ? (
                    <View style={[styles.infoChip, { backgroundColor: theme.colors.card }]}>
                      <Ionicons name="call-outline" size={12} color={theme.colors.muted} />
                      <Text style={[styles.infoChipText, { color: theme.colors.muted }]} numberOfLines={1}>
                        {phone}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {isExpanded ? (
                  <View style={styles.details}>
                    <Text style={[styles.detailText, { color: theme.colors.text }]}>
                      ФИО: {name}
                    </Text>
                    <Text style={[styles.detailText, { color: theme.colors.text }]}>
                      Имя: {item.first_name || 'Не указано'}
                    </Text>
                    <Text style={[styles.detailText, { color: theme.colors.text }]}>
                      Фамилия: {item.last_name || 'Не указана'}
                    </Text>
                    <Text style={[styles.detailText, { color: theme.colors.text }]}>
                      Username: {item.username ? `@${item.username}` : 'Не указан'}
                    </Text>
                    <Text style={[styles.detailText, { color: theme.colors.text }]}>
                      Почта: {item.email || 'Не указана'}
                    </Text>
                    <Text style={[styles.detailText, { color: theme.colors.text }]}>
                      Телефон: {phone || 'Не указан'}
                    </Text>
                    <Text style={[styles.detailText, { color: theme.colors.text }]}>
                      Источник: {formatSource(item.source)}
                    </Text>
                    <Text style={[styles.detailText, { color: theme.colors.text }]}>
                      Последний контакт: {formatDateTime(item.last_interaction_at)}
                    </Text>
                    <Text style={[styles.detailText, { color: theme.colors.text }]}>
                      Статус: {isStaff ? 'Персонал' : 'Пользователь'}
                    </Text>

                    <View style={styles.actionsGrid}>
                      <Pressable
                        onPress={() => onOpenProfile(item)}
                        disabled={isBusy}
                        style={[styles.secondaryButton, { backgroundColor: theme.colors.card }]}
                      >
                        <Ionicons name="person-outline" size={16} color={theme.colors.text} />
                        <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>
                          Профиль
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => onOpenChat(item)}
                        disabled={isBusy}
                        style={[styles.secondaryButton, { backgroundColor: theme.colors.card }]}
                      >
                        <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.colors.text} />
                        <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>
                          Чат
                        </Text>
                      </Pressable>
                    </View>

                    <Text style={[styles.swipeHint, { color: theme.colors.muted }]}>
                      Свайпни контакт влево, чтобы открыть кнопку звонка.
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </GlassCard>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export default function ContactsScreen() {
  const { theme } = useTheme();
  const currentUserUuid = useAuthStore((s) => s.user?.uuid);
  const startOutgoing = useCallStore((s) => s.startOutgoing);

  const [items, setItems] = useState<ContactItem[]>([]);
  const [expandedUuid, setExpandedUuid] = useState<string | null>(null);
  const [actionUuid, setActionUuid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [callChooserContact, setCallChooserContact] = useState<ContactItem | null>(null);

  const loadContacts = useCallback(async () => {
    try {
      const [serverContacts, chatsResponse] = await Promise.allSettled([
        loadServerContactsWithDetails(),
        fetchChats(1, 100),
      ]);

      const fromServer =
        serverContacts.status === 'fulfilled'
          ? serverContacts.value
          : [];

      const chats =
        chatsResponse.status === 'fulfilled' && Array.isArray(chatsResponse.value?.results)
          ? chatsResponse.value.results
          : [];

      const fromChats = buildContactsFromChats(chats, currentUserUuid);
      const merged = mergeContactItems(fromServer, fromChats);

      setItems(merged);
    } catch (error) {
      console.error('loadContacts error:', error);

      try {
        const response = await fetchChats(1, 100);
        const chats = Array.isArray(response?.results) ? response.results : [];
        setItems(buildContactsFromChats(chats, currentUserUuid));
      } catch (fallbackError) {
        console.error('loadContacts fallback error:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  }, [currentUserUuid]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  useFocusEffect(
    useCallback(() => {
      void loadContacts();
    }, [loadContacts]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void loadContacts();
      }
    });

    return () => subscription.remove();
  }, [loadContacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return items;

    return items.filter((item) => {
      const name = fullName(item).toLowerCase();
      const username = String(item.username || '').toLowerCase();
      const email = String(item.email || '').toLowerCase();
      const phone = String(getPhone(item) || '').toLowerCase();
      const source = String(item.source || '').toLowerCase();

      return (
        name.includes(q) ||
        username.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        source.includes(q)
      );
    });
  }, [items, search]);

  const ensureDirectChat = async (item: ContactItem) => {
    if (item.chat_uuid) {
      return item.chat_uuid;
    }

    const createdChat = await createDirectChat(item.user_uuid);

    if (!createdChat?.uuid) {
      throw new Error('Не удалось создать direct chat');
    }

    setItems((prev) =>
      prev.map((entry) =>
        entry.user_uuid === item.user_uuid
          ? {
              ...entry,
              chat_uuid: createdChat.uuid,
            }
          : entry,
      ),
    );

    return createdChat.uuid;
  };

  const openContactChat = async (item: ContactItem) => {
    try {
      setActionUuid(item.user_uuid);

      const chatUuid = await ensureDirectChat(item);

      router.push({
        pathname: '/(app)/chat/[chatUuid]',
        params: { chatUuid },
      });
    } catch (error) {
      console.error('openContactChat error:', error);
      Alert.alert('Ошибка', 'Не удалось открыть чат');
    } finally {
      setActionUuid(null);
    }
  };

  const openContactProfile = async (item: ContactItem) => {
    try {
      setActionUuid(item.user_uuid);

      const chatUuid = await ensureDirectChat(item);

      router.push({
        pathname: '/(app)/chat-user/[userUuid]',
        params: {
          userUuid: item.user_uuid,
          chatUuid,
          fullName: fullName(item),
          username: item.username || '',
          bio: '',
        },
      });
    } catch (error) {
      console.error('openContactProfile error:', error);
      Alert.alert('Ошибка', 'Не удалось открыть профиль');
    } finally {
      setActionUuid(null);
    }
  };

  const startContactCall = async (item: ContactItem, callType: CallType) => {
    try {
      setActionUuid(item.user_uuid);

      const allowed = await ensureCallPermissions(callType);
      if (!allowed) {
        return;
      }

      const chatUuid = await ensureDirectChat(item);
      const created = await startOutgoing(chatUuid, callType);

      setCallChooserContact(null);

      router.push({
        pathname: '/(app)/call/[callUuid]',
        params: { callUuid: created.uuid },
      });
    } catch (error: any) {
      console.error('startContactCall error:', error);
      Alert.alert(
        'Звонок не запущен',
        error?.message || 'Не удалось начать звонок',
      );
    } finally {
      setActionUuid(null);
    }
  };

  const openCallChooser = (item: ContactItem) => {
    setCallChooserContact(item);
  };

  const toggleExpanded = (item: ContactItem) => {
    setExpandedUuid((current) => (current === item.user_uuid ? null : item.user_uuid));
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.screenTitle, { color: theme.colors.text }]}>Контакты</Text>

        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Поиск по ФИО, почте, телефону"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <GlassCard>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              Контактов пока нет
            </Text>
            <Text style={[styles.emptySub, { color: theme.colors.muted }]}>
              Здесь автоматически появятся пользователи, которые встретились в твоих чатах.
            </Text>
          </GlassCard>
        }
        renderItem={({ item }) => (
          <ContactRow
            item={item}
            theme={theme}
            isExpanded={expandedUuid === item.user_uuid}
            isBusy={actionUuid === item.user_uuid}
            onToggleExpand={toggleExpanded}
            onOpenProfile={(contact) => void openContactProfile(contact)}
            onOpenChat={(contact) => void openContactChat(contact)}
            onOpenCallChooser={openCallChooser}
          />
        )}
      />

      <Modal
        visible={Boolean(callChooserContact)}
        transparent
        animationType="fade"
        onRequestClose={() => setCallChooserContact(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCallChooserContact(null)} />

          <View style={styles.bottomSheetWrap}>
            <GlassCard>
              <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>
                Позвонить
              </Text>

              <Text style={[styles.sheetSub, { color: theme.colors.muted }]}>
                {callChooserContact ? fullName(callChooserContact) : ''}
              </Text>

              <Pressable
                onPress={() =>
                  callChooserContact
                    ? void startContactCall(callChooserContact, 'audio')
                    : undefined
                }
                disabled={!callChooserContact || actionUuid === callChooserContact.user_uuid}
                style={({ pressed }) => [
                  styles.callChoice,
                  {
                    backgroundColor: '#10B981',
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Ionicons name="call" size={20} color="#FFFFFF" />
                <Text style={styles.callChoiceText}>
                  {actionUuid === callChooserContact?.user_uuid ? 'Запускаю...' : 'Аудио звонок'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  callChooserContact
                    ? void startContactCall(callChooserContact, 'video')
                    : undefined
                }
                disabled={!callChooserContact || actionUuid === callChooserContact.user_uuid}
                style={({ pressed }) => [
                  styles.callChoice,
                  {
                    backgroundColor: '#3B82F6',
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Ionicons name="videocam" size={20} color="#FFFFFF" />
                <Text style={styles.callChoiceText}>
                  {actionUuid === callChooserContact?.user_uuid ? 'Запускаю...' : 'Видео звонок'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setCallChooserContact(null)}
                style={[styles.cancelChoice, { backgroundColor: theme.colors.card }]}
              >
                <Text style={[styles.cancelChoiceText, { color: theme.colors.text }]}>
                  Отмена
                </Text>
              </Pressable>
            </GlassCard>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 10,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 10,
  },
  swipeContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
  },
  hiddenActionWrap: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: SWIPE_ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenCallButton: {
    width: 86,
    minHeight: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  hiddenCallText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  swipeForeground: {
    borderRadius: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E5E7EB',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  username: {
    fontSize: 13,
  },
  quickInfoRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  infoChip: {
    maxWidth: '100%',
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoChipText: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
  details: {
    marginTop: 12,
    gap: 6,
  },
  detailText: {
    fontSize: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 14,
  },
  actionsGrid: {
    marginTop: 12,
    gap: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  secondaryButton: {
    height: 40,
    borderRadius: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  swipeHint: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.34)',
    justifyContent: 'flex-end',
  },
  bottomSheetWrap: {
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  sheetTitle: {
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 4,
  },
  sheetSub: {
    fontSize: 14,
    marginBottom: 14,
  },
  callChoice: {
    minHeight: 54,
    borderRadius: 18,
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  callChoiceText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  cancelChoice: {
    minHeight: 50,
    borderRadius: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cancelChoiceText: {
    fontSize: 15,
    fontWeight: '800',
  },
});