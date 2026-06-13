import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  FlatList,
  Modal,
  PanResponder,
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

import { useTheme } from '@/src/theme/ThemeProvider';
import type { AppTheme } from '@/src/theme/themes';
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
import { blockUserLocal } from '@/src/lib/local/blockedUsers';
import { getLocalContacts, removeLocalContact } from '@/src/lib/local/localContacts';
import { patchChatListPreference } from '@/src/lib/local/chatListPreferences';

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

type ContactUi = {
  bgPrimary: string;
  bgSecondary: string;
  bgHover: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  separator: string;
  badgeBg: string;
  shadow: string;
  overlay: string;
  danger: string;
  success: string;
  pageOuter: string;
};

type ContactRowProps = {
  item: ContactItem;
  ui: ContactUi;
  isBusy: boolean;
  onOpenProfile: (item: ContactItem) => void;
  onOpenChat: (item: ContactItem) => void;
  onOpenCallChooser: (item: ContactItem) => void;
  onOpenMenu: (item: ContactItem) => void;
};

const SWIPE_ACTION_WIDTH = 104;
const ONE_DAY = 24 * 60 * 60 * 1000;

function buildContactUi(theme: AppTheme): ContactUi {
  const colors = theme.colors;

  return {
    bgPrimary: colors.background,
    bgSecondary: colors.cardStrong,
    bgHover: colors.primarySoft,
    accent: colors.primary,
    textPrimary: colors.text,
    textSecondary: colors.muted,
    separator: colors.border,
    badgeBg: colors.primary,
    shadow: colors.shadow,
    overlay: theme.isDark ? 'rgba(0, 0, 0, 0.34)' : 'rgba(15, 23, 42, 0.16)',
    danger: colors.danger,
    success: colors.success,
    pageOuter: colors.background,
  };
}

const AVATAR_COLORS = ['#5288c1', '#e6683c', '#dc2743', '#cc2366', '#7f91a4', '#10B981'];

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
  if (item.username) return `@${item.username}`;
  if (getPhone(item)) return getPhone(item);
  if (item.email) return item.email;
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

  return `${date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })} ${date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function startOfDay(time: Date) {
  return new Date(time.getFullYear(), time.getMonth(), time.getDate()).getTime();
}

function formatContactTime(value?: string | null) {
  if (!value) return '';

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';

  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((startOfDay(now) - startOfDay(date)) / ONE_DAY);

  if (diffDays <= 0) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  if (diffDays === 1) return 'Вчера';
  if (diffDays < 7) return ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][date.getDay()];

  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function getAvatarColor(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
  }

  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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
    options: { chatUuid?: string | null; sourceChatUuid?: string | null; lastInteractionAt?: string | null },
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
      last_interaction_at: existing?.last_interaction_at || options.lastInteractionAt || null,
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

    map.set(user.uuid, nextValue);
  };

  chats.forEach((chat) => {
    const directPeer: any = chat.peer_user;
    const lastInteractionAt = chat.last_message_at || chat.updated_at || chat.created_at || null;

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
        { chatUuid: chat.uuid, sourceChatUuid: chat.uuid, lastInteractionAt },
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
          lastInteractionAt,
        });
      });
    }
  });

  return [...map.values()].sort((a, b) => fullName(a).localeCompare(fullName(b), 'ru'));
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
      last_interaction_at: item.last_interaction_at ?? existing?.last_interaction_at ?? null,
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

  return [...map.values()].sort((a, b) => fullName(a).localeCompare(fullName(b), 'ru'));
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

function SearchBar({
  value,
  onChangeText,
  placeholder,
  ui,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  ui: ContactUi;
}) {
  return (
    <View style={[styles.searchBox, { backgroundColor: ui.bgSecondary }]}> 
      <Ionicons name="search" size={18} color={ui.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={ui.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.searchInput, { color: ui.textPrimary }]}
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={10}>
          <Ionicons name="close-circle" size={18} color={ui.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

function RoundAvatar({
  title,
  uri,
  color,
  size = 54,
  ui,
}: {
  title: string;
  uri?: string | null;
  color?: string;
  size?: number;
  ui: ContactUi;
}) {
  const frameStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (uri) {
    return (
      <ExpoImage
        source={{ uri }}
        style={[styles.avatarImage, frameStyle]}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    );
  }

  return (
    <View style={[styles.avatar, frameStyle, { backgroundColor: color || getAvatarColor(title) }]}> 
      <Text style={[styles.avatarText, { fontSize: Math.round(size * 0.36) }]}> 
        {title.slice(0, 1).toUpperCase() || 'A'}
      </Text>
      <View style={[styles.avatarInnerGlow, { borderColor: ui.separator }]} />
    </View>
  );
}

function ContactRow({
  item,
  ui,
  isBusy,
  onOpenProfile,
  onOpenChat,
  onOpenCallChooser,
  onOpenMenu,
}: ContactRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [opened, setOpened] = useState(false);

  const name = fullName(item);
  const subtitle = getContactSubtitle(item);
  const isStaff = Boolean(item.is_admin || item.is_staff || item.badge === 'staff');
  const time = formatContactTime(item.last_interaction_at);

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

  const handleOpenChat = () => {
    if (opened) {
      closeSwipe();
      return;
    }

    onOpenChat(item);
  };

  const handleCallPress = () => {
    closeSwipe();
    onOpenCallChooser(item);
  };

  return (
    <View style={[styles.swipeContainer, { backgroundColor: ui.bgPrimary }]}> 
      <View style={[styles.hiddenActionWrap, { backgroundColor: ui.bgPrimary }]}> 
        <Pressable
          onPress={handleCallPress}
          disabled={isBusy}
          style={({ pressed }) => [
            styles.hiddenCallButton,
            {
              backgroundColor: ui.accent,
              opacity: isBusy ? 0.56 : pressed ? 0.78 : 1,
            },
          ]}
        >
          {isBusy ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="call" size={20} color="#FFFFFF" />
          )}
          <Text style={styles.hiddenCallText}>{isBusy ? 'Ждём...' : 'Позвонить'}</Text>
        </Pressable>
      </View>

      <Animated.View
        style={[
          styles.swipeForeground,
          {
            backgroundColor: ui.bgPrimary,
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <Pressable
          onPress={handleOpenChat}
          onLongPress={() => onOpenMenu(item)}
          style={({ pressed }) => [
            styles.contactItem,
            { backgroundColor: pressed ? ui.bgHover : ui.bgPrimary },
          ]}
        >
          <RoundAvatar title={name} uri={item.avatar} color={getAvatarColor(name)} ui={ui} />

          <View style={styles.contactContent}>
            <View style={styles.nameLine}>
              <Text style={[styles.contactName, { color: ui.textPrimary }]} numberOfLines={1}>
                {name}
              </Text>
              {isStaff ? <Ionicons name="star" size={13} color={ui.accent} /> : null}
              {item.is_favorite ? <Ionicons name="heart" size={13} color={ui.danger} /> : null}
            </View>
            <Text style={[styles.contactSubtitle, { color: ui.textSecondary }]} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>

          <View style={styles.contactMeta}>
            <Text style={[styles.contactTime, { color: ui.textSecondary }]}>{time}</Text>
            <View style={styles.contactMetaBottom}>
              {item.chat_uuid ? <Ionicons name="chatbubble-ellipses" size={15} color={ui.textSecondary} /> : null}
              <Pressable
                onPress={() => onOpenProfile(item)}
                hitSlop={10}
                disabled={isBusy}
                style={({ pressed }) => [styles.profileMiniButton, pressed && { backgroundColor: ui.bgHover }]}
              >
                {isBusy ? (
                  <ActivityIndicator size="small" color={ui.accent} />
                ) : (
                  <Ionicons name="person-circle-outline" size={20} color={ui.textSecondary} />
                )}
              </Pressable>
            </View>
          </View>

          <View style={[styles.contactSeparator, { backgroundColor: ui.separator }]} />
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
  const [actionUuid, setActionUuid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [callChooserContact, setCallChooserContact] = useState<ContactItem | null>(null);
  const [selectedContact, setSelectedContact] = useState<ContactItem | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);

  const ui = useMemo(() => buildContactUi(theme), [theme]);

  const loadContacts = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);

    try {
      if (!silent) {
        setRefreshing(true);
      }

      const [serverContacts, chatsResponse, localContactUuids] = await Promise.allSettled([
        loadServerContactsWithDetails(),
        fetchChats(1, 100),
        getLocalContacts(),
      ]);

      const fromServer = serverContacts.status === 'fulfilled' ? serverContacts.value : [];
      const localSet = new Set(
        localContactUuids.status === 'fulfilled' ? localContactUuids.value : [],
      );
      const chats =
        chatsResponse.status === 'fulfilled' && Array.isArray(chatsResponse.value?.results)
          ? chatsResponse.value.results
          : [];

      const fromChats = buildContactsFromChats(chats, currentUserUuid).filter((item) =>
        localSet.has(item.user_uuid),
      );
      const merged = mergeContactItems(fromServer, fromChats);

      setItems(merged);
    } catch (error) {
      console.error('loadContacts error:', error);

      try {
        const response = await fetchChats(1, 100);
        const chats = Array.isArray(response?.results) ? response.results : [];
        const localSet = new Set(await getLocalContacts());
        setItems(
          buildContactsFromChats(chats, currentUserUuid).filter((item) =>
            localSet.has(item.user_uuid),
          ),
        );
      } catch (fallbackError) {
        console.error('loadContacts fallback error:', fallbackError);
      }
    } finally {
      setLoading(false);
      if (!silent) {
        setRefreshing(false);
      }
    }
  }, [currentUserUuid]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  useFocusEffect(
    useCallback(() => {
      void loadContacts({ silent: true });
    }, [loadContacts]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void loadContacts({ silent: true });
      }
    });

    return () => subscription.remove();
  }, [loadContacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const sorted = [...items].sort((a, b) => {
      const aFav = Boolean(a.is_favorite);
      const bFav = Boolean(b.is_favorite);

      if (aFav !== bFav) return aFav ? -1 : 1;

      return fullName(a).localeCompare(fullName(b), 'ru');
    });

    if (!q) return sorted;

    return sorted.filter((item) => {
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
      setMenuVisible(false);

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
      setMenuVisible(false);

      router.push({
        pathname: '/(app)/call/[callUuid]',
        params: {
          callUuid: created.uuid,
        },
      });
    } catch (error: any) {
      console.error('startContactCall error:', error);
      Alert.alert(
        'Звонок не запущен',
        error?.message || 'Не удалось начать звонок. Проверь Android/iOS build и WebSocket.',
      );
    } finally {
      setActionUuid(null);
    }
  };

  const openCallChooser = (item: ContactItem) => {
    setCallChooserContact(item);
  };

  const openContactMenu = (item: ContactItem) => {
    setSelectedContact(item);
    setMenuVisible(true);
  };

  const removeSelectedContact = async () => {
    if (!selectedContact) return;

    try {
      setActionUuid(selectedContact.user_uuid);
      await removeLocalContact(selectedContact.user_uuid);
      setItems((current) =>
        current.filter((item) => item.user_uuid !== selectedContact.user_uuid),
      );
      setMenuVisible(false);
    } catch {
      Alert.alert('Контакт', 'Не удалось убрать контакт.');
    } finally {
      setActionUuid(null);
    }
  };

  const muteSelectedContact = async () => {
    if (!selectedContact) return;

    try {
      setActionUuid(selectedContact.user_uuid);
      const chatUuid = selectedContact.chat_uuid || (await ensureDirectChat(selectedContact));
      await patchChatListPreference(chatUuid, { isMuted: true });
      setMenuVisible(false);
    } catch {
      Alert.alert('Контакт', 'Не удалось включить беззвучный режим.');
    } finally {
      setActionUuid(null);
    }
  };

  const hideAndBlockSelectedContact = async () => {
    if (!selectedContact) return;

    try {
      setActionUuid(selectedContact.user_uuid);
      await blockUserLocal(selectedContact.user_uuid);
      await removeLocalContact(selectedContact.user_uuid);
      const chatUuid = selectedContact.chat_uuid || selectedContact.source_chat_uuid;

      if (chatUuid) {
        await patchChatListPreference(chatUuid, { isHidden: true, isMuted: true });
      }

      setItems((current) =>
        current.filter((item) => item.user_uuid !== selectedContact.user_uuid),
      );
      setMenuVisible(false);
    } catch {
      Alert.alert('Контакт', 'Не удалось скрыть контакт.');
    } finally {
      setActionUuid(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeRoot, { backgroundColor: ui.bgPrimary }]}> 
        <View style={styles.centered}>
          <ActivityIndicator color={ui.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeRoot, { backgroundColor: ui.pageOuter }]} edges={['top', 'left', 'right']}>
      <View style={[styles.appFrame, { backgroundColor: ui.bgPrimary }]}> 
        <View style={[styles.header, { backgroundColor: ui.bgSecondary }]}> 
          <Text style={[styles.headerTitle, { color: ui.textPrimary }]}>Контакты</Text>
          <Pressable
            onPress={() => void loadContacts()}
            accessibilityLabel="Обновить контакты"
            style={({ pressed }) => [styles.menuTrigger, pressed && { backgroundColor: ui.bgHover }]}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={ui.accent} />
            ) : (
              <Ionicons name="refresh" size={20} color={ui.textSecondary} />
            )}
          </Pressable>
        </View>

        <View style={[styles.searchContainer, { backgroundColor: ui.bgPrimary }]}> 
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Поиск контактов"
            ui={ui}
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.key}
          initialNumToRender={16}
          maxToRenderPerBatch={12}
          updateCellsBatchingPeriod={50}
          windowSize={8}
          removeClippedSubviews={Platform.OS !== 'web'}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadContacts()}
              tintColor={ui.accent}
              colors={[ui.accent]}
            />
          }
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            filtered.length > 0 ? (
              <Text style={[styles.sectionTitle, { color: ui.textSecondary }]}> 
                {search.trim() ? `Найдено: ${filtered.length}` : `Всего контактов: ${filtered.length}`}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyTitle, { color: ui.textPrimary }]}> 
                {search.trim() ? 'Контакты не найдены' : 'Контактов пока нет'}
              </Text>
              <Text style={[styles.emptySub, { color: ui.textSecondary }]}> 
                {search.trim()
                  ? 'Попробуй искать по имени, @username, почте или телефону.'
                  : 'Здесь автоматически появятся пользователи, которые встретились в твоих чатах.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ContactRow
              item={item}
              ui={ui}
              isBusy={actionUuid === item.user_uuid}
              onOpenProfile={(contact) => void openContactProfile(contact)}
              onOpenChat={(contact) => void openContactChat(contact)}
              onOpenCallChooser={openCallChooser}
              onOpenMenu={openContactMenu}
            />
          )}
        />

        <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
          <View style={[styles.bottomModalRoot, { backgroundColor: ui.overlay }]}> 
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuVisible(false)} />
            <View style={styles.bottomSheetWrap}>
              <View style={[styles.sheet, { backgroundColor: ui.bgSecondary, shadowColor: ui.shadow }]}> 
                <Text style={[styles.sheetTitle, { color: ui.textPrimary }]}> 
                  {selectedContact ? fullName(selectedContact) : 'Контакт'}
                </Text>
                <Text style={[styles.sheetSub, { color: ui.textSecondary }]}> 
                  {selectedContact ? getContactSubtitle(selectedContact) : ''}
                </Text>

                <Pressable
                  onPress={() => selectedContact ? void openContactChat(selectedContact) : undefined}
                  disabled={!selectedContact || actionUuid === selectedContact.user_uuid}
                  style={({ pressed }) => [
                    styles.sheetItem,
                    { borderColor: ui.separator, backgroundColor: pressed ? ui.bgHover : 'transparent' },
                  ]}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color={ui.accent} />
                  <Text style={[styles.sheetItemText, { color: ui.textPrimary }]}>Открыть чат</Text>
                </Pressable>

                <Pressable
                  onPress={() => selectedContact ? void openContactProfile(selectedContact) : undefined}
                  disabled={!selectedContact || actionUuid === selectedContact.user_uuid}
                  style={({ pressed }) => [
                    styles.sheetItem,
                    { borderColor: ui.separator, backgroundColor: pressed ? ui.bgHover : 'transparent' },
                  ]}
                >
                  <Ionicons name="person-outline" size={20} color={ui.accent} />
                  <Text style={[styles.sheetItemText, { color: ui.textPrimary }]}>Профиль</Text>
                </Pressable>

                <Pressable
                  onPress={() => selectedContact ? openCallChooser(selectedContact) : undefined}
                  disabled={!selectedContact || actionUuid === selectedContact.user_uuid}
                  style={({ pressed }) => [
                    styles.sheetItem,
                    { borderColor: ui.separator, backgroundColor: pressed ? ui.bgHover : 'transparent' },
                  ]}
                >
                  <Ionicons name="call-outline" size={20} color={ui.accent} />
                  <Text style={[styles.sheetItemText, { color: ui.textPrimary }]}>Позвонить</Text>
                </Pressable>

                <Pressable
                  onPress={() => void muteSelectedContact()}
                  disabled={!selectedContact || actionUuid === selectedContact.user_uuid}
                  style={({ pressed }) => [
                    styles.sheetItem,
                    { borderColor: ui.separator, backgroundColor: pressed ? ui.bgHover : 'transparent' },
                  ]}
                >
                  <Ionicons name="volume-mute-outline" size={20} color={ui.accent} />
                  <Text style={[styles.sheetItemText, { color: ui.textPrimary }]}>Беззвучно</Text>
                </Pressable>

                <Pressable
                  onPress={() => void removeSelectedContact()}
                  disabled={!selectedContact || actionUuid === selectedContact.user_uuid}
                  style={({ pressed }) => [
                    styles.sheetItem,
                    { borderColor: ui.separator, backgroundColor: pressed ? ui.bgHover : 'transparent' },
                  ]}
                >
                  <Ionicons name="person-remove-outline" size={20} color={ui.accent} />
                  <Text style={[styles.sheetItemText, { color: ui.textPrimary }]}>Убрать из контактов</Text>
                </Pressable>

                <Pressable
                  onPress={() => void hideAndBlockSelectedContact()}
                  disabled={!selectedContact || actionUuid === selectedContact.user_uuid}
                  style={({ pressed }) => [
                    styles.sheetItem,
                    {
                      borderColor: 'rgba(239,68,68,0.32)',
                      backgroundColor: pressed ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.06)',
                    },
                  ]}
                >
                  <Ionicons name="ban-outline" size={20} color={ui.danger} />
                  <Text style={[styles.sheetItemText, { color: ui.danger }]}>Скрыть и заблокировать</Text>
                </Pressable>

                {selectedContact ? (
                  <View style={[styles.detailsBox, { borderColor: ui.separator }]}> 
                    <Text style={[styles.detailText, { color: ui.textSecondary }]}> 
                      Источник: {formatSource(selectedContact.source)}
                    </Text>
                    <Text style={[styles.detailText, { color: ui.textSecondary }]}> 
                      Последний контакт: {formatDateTime(selectedContact.last_interaction_at)}
                    </Text>
                    <Text style={[styles.detailText, { color: ui.textSecondary }]}> 
                      Телефон: {getPhone(selectedContact) || 'Не указан'}
                    </Text>
                    <Text style={[styles.detailText, { color: ui.textSecondary }]}> 
                      Почта: {selectedContact.email || 'Не указана'}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={Boolean(callChooserContact)}
          transparent
          animationType="fade"
          onRequestClose={() => setCallChooserContact(null)}
        >
          <View style={[styles.bottomModalRoot, { backgroundColor: ui.overlay }]}> 
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setCallChooserContact(null)} />
            <View style={styles.bottomSheetWrap}>
              <View style={[styles.sheet, { backgroundColor: ui.bgSecondary, shadowColor: ui.shadow }]}> 
                <Text style={[styles.sheetTitle, { color: ui.textPrimary }]}>Позвонить</Text>
                <Text style={[styles.sheetSub, { color: ui.textSecondary }]}> 
                  {callChooserContact ? fullName(callChooserContact) : ''}
                </Text>

                <Pressable
                  onPress={() => (callChooserContact ? void startContactCall(callChooserContact, 'audio') : undefined)}
                  disabled={!callChooserContact || actionUuid === callChooserContact.user_uuid}
                  style={({ pressed }) => [
                    styles.callChoice,
                    { backgroundColor: ui.success, opacity: pressed ? 0.8 : actionUuid ? 0.6 : 1 },
                  ]}
                >
                  <Ionicons name="call" size={20} color="#FFFFFF" />
                  <Text style={styles.callChoiceText}>
                    {actionUuid === callChooserContact?.user_uuid ? 'Запускаю...' : 'Аудио звонок'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => (callChooserContact ? void startContactCall(callChooserContact, 'video') : undefined)}
                  disabled={!callChooserContact || actionUuid === callChooserContact.user_uuid}
                  style={({ pressed }) => [
                    styles.callChoice,
                    { backgroundColor: ui.accent, opacity: pressed ? 0.8 : actionUuid ? 0.6 : 1 },
                  ]}
                >
                  <Ionicons name="videocam" size={20} color="#FFFFFF" />
                  <Text style={styles.callChoiceText}>
                    {actionUuid === callChooserContact?.user_uuid ? 'Запускаю...' : 'Видео звонок'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setCallChooserContact(null)}
                  style={({ pressed }) => [styles.cancelChoice, { backgroundColor: pressed ? ui.bgHover : ui.bgPrimary }]}
                >
                  <Text style={[styles.cancelChoiceText, { color: ui.textPrimary }]}>Отмена</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeRoot: {
    flex: 1,
    alignItems: 'center',
  },
  appFrame: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    overflow: 'hidden',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    minHeight: 64,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  menuTrigger: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBox: {
    minHeight: 42,
    borderRadius: 22,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    paddingVertical: 0,
    fontSize: 15,
    fontWeight: '400',
  },
  listContent: {
    paddingBottom: 126,
  },
  sectionTitle: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    backgroundColor: '#E5E7EB',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  avatarInnerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 1,
  },
  swipeContainer: {
    position: 'relative',
    overflow: 'hidden',
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
    width: 92,
    minHeight: 58,
    borderRadius: 18,
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
    overflow: 'hidden',
  },
  contactItem: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: 'relative',
  },
  contactContent: {
    flex: 1,
    minWidth: 0,
    height: 54,
    marginLeft: 14,
    justifyContent: 'center',
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  contactName: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  contactSubtitle: {
    fontSize: 14,
    fontWeight: '400',
  },
  contactMeta: {
    height: 54,
    minWidth: 42,
    marginLeft: 8,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  contactTime: {
    fontSize: 12,
    fontWeight: '400',
  },
  contactMetaBottom: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  profileMiniButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactSeparator: {
    position: 'absolute',
    left: 84,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
  emptyWrap: {
    paddingHorizontal: 24,
    paddingTop: 48,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  bottomModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bottomSheetWrap: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  sheet: {
    borderRadius: 20,
    padding: 16,
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 18,
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
  sheetItem: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  detailsBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 6,
    marginTop: 2,
  },
  detailText: {
    fontSize: 12,
    lineHeight: 17,
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
