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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';

import { StoriesStrip } from '@/src/components/stories/StoriesStrip';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { AppTheme } from '@/src/theme/themes';
import { fetchChats, createDirectChat, createGroupChat } from '@/src/lib/api/chats';
import { searchUsers, type UserShort } from '@/src/lib/api/contacts';
import { realtimeClient } from '@/src/lib/realtime/socket';
import { isMessageEvent } from '@/src/lib/realtime/events';
import { ensureCallPermissions } from '@/src/lib/calls/permissions';
import { useCallStore } from '@/src/state/call';
import type { CallType } from '@/src/types/calls';
import type { ChatListItem } from '@/src/types/chat';
import {
  getLocalChatPreference,
  loadChatListPreferences,
  patchChatListPreference,
  type LocalChatPreferencesMap,
} from '@/src/lib/local/chatListPreferences';
import { addLocalContact, getLocalContacts, removeLocalContact } from '@/src/lib/local/localContacts';
import { loadCachedChats, saveCachedChats } from '@/src/lib/db/cache';

type ChatTab = 'all' | 'pinned' | 'archive';

type DecoratedChat = ChatListItem & {
  effectivePinned: boolean;
  effectiveArchived: boolean;
  effectiveHidden: boolean;
  effectiveMuted: boolean;
  localPinned: boolean;
  localArchived: boolean;
  localHidden: boolean;
  localMuted: boolean;
  localContact: boolean;
};

type ChatUi = {
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

type ChatRowProps = {
  item: DecoratedChat;
  ui: ChatUi;
  callingKey: string | null;
  onOpenChat: (item: ChatListItem) => void;
  onOpenMenu: (item: DecoratedChat) => void;
  onOpenCallChooser: (item: DecoratedChat) => void;
};

const SWIPE_ACTION_WIDTH = 104;
const ONE_DAY = 24 * 60 * 60 * 1000;

function buildChatUi(theme: AppTheme): ChatUi {
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

function normalizeBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function parseDateValue(value?: string | null): number {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function chatTitle(item: ChatListItem) {
  return item.display_title || item.title || item.peer_user?.full_name || 'Без названия';
}

function personName(item: UserShort) {
  return (
    item.full_name ||
    [item.first_name, item.last_name].filter(Boolean).join(' ') ||
    item.username ||
    item.email ||
    'Без имени'
  );
}

function buildPreview(item: ChatListItem) {
  const value: any = item.last_message;

  if (!value) {
    return 'Сообщений пока нет';
  }

  if (typeof value === 'string') {
    const text = value.trim();
    return text || 'Сообщений пока нет';
  }

  const preview = String(value.preview || value.text || '').trim();
  if (preview) {
    return preview;
  }

  const type = String(value.message_type || '').toLowerCase();

  if (type === 'image') return 'Фото';
  if (type === 'video') return 'Видео';
  if (type === 'video_note') return 'Видеокружок';
  if (type === 'audio') return 'Голосовое сообщение';
  if (type === 'file') return 'Файл';
  if (type === 'sticker') return 'Стикер';

  return 'Сообщение';
}

function getDecoratedChats(
  data: ChatListItem[],
  localPreferences: LocalChatPreferencesMap,
  localContactUuids: Set<string>,
): DecoratedChat[] {
  return data.map((item) => {
    const local = getLocalChatPreference(localPreferences, item.uuid);
    const serverPinned = normalizeBoolean(item.is_pinned);
    const serverArchived = normalizeBoolean(item.is_archived);

    return {
      ...item,
      localPinned: Boolean(local.isPinned),
      localArchived: Boolean(local.isArchived),
      localHidden: Boolean(local.isHidden),
      localMuted: Boolean(local.isMuted),
      localContact: Boolean(item.peer_user?.uuid && localContactUuids.has(item.peer_user.uuid)),
      effectivePinned: serverPinned || Boolean(local.isPinned),
      effectiveArchived: serverArchived || Boolean(local.isArchived),
      effectiveHidden: Boolean(local.isHidden),
      effectiveMuted: normalizeBoolean(item.is_muted) || Boolean(local.isMuted),
    };
  });
}

function sortChats(items: DecoratedChat[]) {
  return [...items].sort((a, b) => {
    if (a.effectivePinned !== b.effectivePinned) {
      return a.effectivePinned ? -1 : 1;
    }

    const aTime = Math.max(
      parseDateValue(a.last_message_at),
      parseDateValue(a.updated_at),
      parseDateValue(a.created_at),
    );
    const bTime = Math.max(
      parseDateValue(b.last_message_at),
      parseDateValue(b.updated_at),
      parseDateValue(b.created_at),
    );

    if (aTime !== bTime) {
      return bTime - aTime;
    }

    return chatTitle(a).localeCompare(chatTitle(b), 'ru');
  });
}

function getAvatarColor(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
  }

  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function startOfDay(time: Date) {
  return new Date(time.getFullYear(), time.getMonth(), time.getDate()).getTime();
}

function formatChatTime(item: ChatListItem) {
  const timestamp = Math.max(
    parseDateValue(item.last_message_at),
    parseDateValue(item.updated_at),
    parseDateValue(item.created_at),
  );

  if (!timestamp) {
    return '';
  }

  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((startOfDay(now) - startOfDay(date)) / ONE_DAY);

  if (diffDays <= 0) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  if (diffDays === 1) {
    return 'Вчера';
  }

  if (diffDays < 7) {
    return ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][date.getDay()];
  }

  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
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
  ui: ChatUi;
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
  icon,
}: {
  title: string;
  uri?: string | null;
  color?: string;
  size?: number;
  ui: ChatUi;
  icon?: keyof typeof Ionicons.glyphMap;
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
      {icon ? (
        <Ionicons name={icon} size={Math.round(size * 0.44)} color="#FFFFFF" />
      ) : (
        <Text style={[styles.avatarText, { fontSize: Math.round(size * 0.36) }]}> 
          {title.slice(0, 1).toUpperCase() || 'A'}
        </Text>
      )}
      <View style={[styles.avatarInnerGlow, { borderColor: ui.separator }]} />
    </View>
  );
}

function DropdownItem({
  icon,
  label,
  ui,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  ui: ChatUi;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.dropdownItem, pressed && { backgroundColor: ui.bgHover }]}
    >
      <Ionicons name={icon} size={22} color={ui.textSecondary} />
      <Text style={[styles.dropdownText, { color: ui.textPrimary }]}>{label}</Text>
    </Pressable>
  );
}

function ChatRow({
  item,
  ui,
  callingKey,
  onOpenChat,
  onOpenMenu,
  onOpenCallChooser,
}: ChatRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [opened, setOpened] = useState(false);

  const title = chatTitle(item);
  const unread = Number(item.unread_count ?? 0) || 0;
  const isCallingThisChat =
    callingKey === `${item.uuid}:audio` || callingKey === `${item.uuid}:video`;

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

  const handleOpenChat = () => {
    if (opened) {
      closeSwipe();
      return;
    }

    onOpenChat(item);
  };

  return (
    <View style={[styles.swipeContainer, { backgroundColor: ui.bgPrimary }]}> 
      <View style={[styles.hiddenActionWrap, { backgroundColor: ui.bgPrimary }]}> 
        <Pressable
          onPress={handleCallPress}
          disabled={Boolean(callingKey)}
          style={({ pressed }) => [
            styles.hiddenCallButton,
            {
              backgroundColor: ui.accent,
              opacity: callingKey && !isCallingThisChat ? 0.5 : pressed ? 0.78 : 1,
            },
          ]}
        >
          {isCallingThisChat ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="call" size={20} color="#FFFFFF" />
          )}
          <Text style={styles.hiddenCallText}>
            {isCallingThisChat ? 'Звоню...' : 'Позвонить'}
          </Text>
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
            styles.chatItem,
            { backgroundColor: pressed ? ui.bgHover : ui.bgPrimary },
          ]}
        >
          <RoundAvatar title={title} uri={item.peer_user?.avatar} color={getAvatarColor(title)} ui={ui} />

          <View style={styles.chatContent}>
            <Text style={[styles.chatName, { color: ui.textPrimary }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.chatMessage, { color: ui.textSecondary }]} numberOfLines={1}>
              {buildPreview(item)}
            </Text>
          </View>

          <View style={styles.chatMeta}>
            <Text style={[styles.chatTime, { color: ui.textSecondary }]}>{formatChatTime(item)}</Text>
            <View style={styles.chatMetaBottom}>
              {item.effectiveArchived ? (
                <Ionicons name="archive" size={14} color={ui.textSecondary} />
              ) : item.effectivePinned ? (
                <Ionicons name="pin" size={14} color={ui.textSecondary} style={styles.pinIcon} />
              ) : null}
              {item.effectiveMuted ? (
                <Ionicons name="volume-mute" size={14} color={ui.textSecondary} />
              ) : null}

              {unread > 0 ? (
                <View style={[styles.unreadBadge, { backgroundColor: ui.badgeBg }]}> 
                  <Text style={styles.unreadBadgeText}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={[styles.chatSeparator, { backgroundColor: ui.separator }]} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

export default function ChatsScreen() {
  const { theme, setThemeMode } = useTheme();
  const startOutgoing = useCallStore((state) => state.startOutgoing);

  const [data, setData] = useState<ChatListItem[]>([]);
  const [people, setPeople] = useState<UserShort[]>([]);
  const [localPreferences, setLocalPreferences] = useState<LocalChatPreferencesMap>({});
  const [localContactUuids, setLocalContactUuids] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchingPeople, setSearchingPeople] = useState(false);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [callingKey, setCallingKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ChatTab>('all');
  const [selectedChat, setSelectedChat] = useState<DecoratedChat | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [mainMenuVisible, setMainMenuVisible] = useState(false);
  const [callChooserChat, setCallChooserChat] = useState<DecoratedChat | null>(null);
  const [groupVisible, setGroupVisible] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [groupPeople, setGroupPeople] = useState<UserShort[]>([]);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [groupSearching, setGroupSearching] = useState(false);
  const [groupCreating, setGroupCreating] = useState(false);

  const ui = useMemo(() => buildChatUi(theme), [theme]);

  const hydrateLocalPreferences = useCallback(async () => {
    const [loadedPrefs, loadedContacts] = await Promise.all([
      loadChatListPreferences(),
      getLocalContacts(),
    ]);
    setLocalPreferences(loadedPrefs);
    setLocalContactUuids(new Set(loadedContacts));
  }, []);

  const hydrateCachedChats = useCallback(async () => {
    const cached = await loadCachedChats();
    if (cached.length > 0) {
      setData(cached);
      setLoading(false);
    }
  }, []);

  const loadChats = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);

    try {
      if (!silent) {
        setRefreshing(true);
      }

      const response = await fetchChats(1, 100);
      const results = Array.isArray(response?.results) ? response.results : [];
      setData(results);
      void saveCachedChats(results);
    } catch (error) {
      console.error('loadChats error:', error);
    } finally {
      if (!silent) {
        setRefreshing(false);
      }
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void hydrateLocalPreferences();
    void hydrateCachedChats();
    void loadChats();
  }, [hydrateCachedChats, hydrateLocalPreferences, loadChats]);

  useFocusEffect(
    useCallback(() => {
      void hydrateLocalPreferences();
      void loadChats({ silent: true });
    }, [hydrateLocalPreferences, loadChats]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void hydrateLocalPreferences();
        void loadChats({ silent: true });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [hydrateLocalPreferences, loadChats]);

  useEffect(() => {
    const unsubscribe = realtimeClient.subscribe((event) => {
      if (!isMessageEvent(event)) return;
      void loadChats({ silent: true });
    });

    return () => {
      unsubscribe();
    };
  }, [loadChats]);

  useEffect(() => {
    const q = search.trim();

    if (q.length < 2) {
      setPeople([]);
      setSearchingPeople(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearchingPeople(true);
        const results = await searchUsers(q);
        setPeople(Array.isArray(results) ? results : []);
      } catch (error) {
        console.error('searchUsers error:', error);
        setPeople([]);
      } finally {
        setSearchingPeople(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const q = groupSearch.trim();

    if (q.length < 2) {
      setGroupPeople([]);
      setGroupSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setGroupSearching(true);
        const results = await searchUsers(q);
        setGroupPeople(Array.isArray(results) ? results : []);
      } catch (error) {
        console.error('group searchUsers error:', error);
        setGroupPeople([]);
      } finally {
        setGroupSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [groupSearch]);

  const decoratedChats = useMemo(() => {
    return getDecoratedChats(data, localPreferences, localContactUuids);
  }, [data, localPreferences, localContactUuids]);

  const visibleDecoratedChats = useMemo(() => {
    return decoratedChats.filter((item) => !item.effectiveHidden);
  }, [decoratedChats]);

  const filteredChats = useMemo(() => {
    const q = search.trim().toLowerCase();

    const byTab = visibleDecoratedChats.filter((item) => {
      if (activeTab === 'pinned') {
        return item.effectivePinned && !item.effectiveArchived;
      }

      if (activeTab === 'archive') {
        return item.effectiveArchived;
      }

      return !item.effectiveArchived;
    });

    const bySearch = q
      ? byTab.filter((item) => {
          const title = chatTitle(item).toLowerCase();
          const lastMessage = buildPreview(item).toLowerCase();
          return title.includes(q) || lastMessage.includes(q);
        })
      : byTab;

    return sortChats(bySearch);
  }, [activeTab, visibleDecoratedChats, search]);

  const activeFilterLabel =
    activeTab === 'archive' ? 'Архив' : activeTab === 'pinned' ? 'Закреплённые' : '';

  const startDirectChat = async (user: UserShort) => {
    try {
      setCreatingFor(user.uuid);

      const createdChat = await createDirectChat(user.uuid);
      setSearch('');
      setPeople([]);

      await loadChats({ silent: true });

      if (createdChat?.uuid) {
        router.push({
          pathname: '/(app)/chat/[chatUuid]',
          params: { chatUuid: createdChat.uuid },
        });
      }
    } catch (error) {
      console.error('createDirectChat error:', error);
      Alert.alert('Ошибка', 'Не удалось создать чат');
    } finally {
      setCreatingFor(null);
    }
  };

  const openChat = (item: ChatListItem) => {
    router.push({
      pathname: '/(app)/chat/[chatUuid]',
      params: { chatUuid: item.uuid },
    });
  };

  const openCallChooser = (item: DecoratedChat) => {
    setCallChooserChat(item);
  };

  const switchDayNight = async () => {
    const nextMode = theme.isDark ? 'light' : 'dark';
    await setThemeMode(nextMode);
    setMainMenuVisible(false);
  };

  const openGroupCreator = () => {
    setMainMenuVisible(false);
    setGroupVisible(true);
  };

  const toggleGroupMember = (userUuid: string) => {
    setSelectedGroupMembers((current) =>
      current.includes(userUuid)
        ? current.filter((item) => item !== userUuid)
        : [...current, userUuid],
    );
  };

  const submitGroup = async () => {
    const title = groupTitle.trim();

    if (!title) {
      Alert.alert('Группа', 'Укажи название группы');
      return;
    }

    if (!selectedGroupMembers.length) {
      Alert.alert('Группа', 'Выбери хотя бы одного участника');
      return;
    }

    try {
      setGroupCreating(true);
      const created = await createGroupChat({
        title,
        member_uuids: selectedGroupMembers,
      });

      setGroupTitle('');
      setGroupSearch('');
      setGroupPeople([]);
      setSelectedGroupMembers([]);
      setGroupVisible(false);
      await loadChats({ silent: true });

      if (created?.uuid) {
        router.push({
          pathname: '/(app)/chat/[chatUuid]',
          params: { chatUuid: created.uuid },
        });
      }
    } catch (error: any) {
      console.error('submitGroup error:', error);
      Alert.alert(
        'Группа',
        error?.response?.data?.detail || error?.message || 'Не удалось создать группу',
      );
    } finally {
      setGroupCreating(false);
    }
  };

  const startCall = async (item: ChatListItem, callType: CallType) => {
    if (!item.uuid) {
      return;
    }

    const nextCallingKey = `${item.uuid}:${callType}`;

    try {
      setCallingKey(nextCallingKey);

      const allowed = await ensureCallPermissions(callType);
      if (!allowed) {
        return;
      }

      const call = await startOutgoing(item.uuid, callType);
      setCallChooserChat(null);

      if (call?.uuid) {
        router.push({
          pathname: '/(app)/call/[callUuid]',
          params: { callUuid: call.uuid },
        });
      }
    } catch (error: any) {
      console.error('startCall error:', error);
      Alert.alert(
        'Звонок не запущен',
        error?.message || 'Не удалось начать звонок. Проверь Android/iOS build и WebSocket.',
      );
    } finally {
      setCallingKey(null);
    }
  };

  const openChatMenu = (item: DecoratedChat) => {
    setSelectedChat(item);
    setMenuVisible(true);
  };

  const toggleLocalPinned = async () => {
    if (!selectedChat?.uuid) {
      return;
    }

    const next = await patchChatListPreference(selectedChat.uuid, {
      isPinned: !selectedChat.localPinned,
    });

    setLocalPreferences(next);
    setSelectedChat((current) =>
      current
        ? {
            ...current,
            localPinned: !current.localPinned,
            effectivePinned: normalizeBoolean(current.is_pinned) || !current.localPinned,
          }
        : null,
    );
    setMenuVisible(false);
  };

  const toggleLocalArchived = async () => {
    if (!selectedChat?.uuid) {
      return;
    }

    const next = await patchChatListPreference(selectedChat.uuid, {
      isArchived: !selectedChat.localArchived,
    });

    setLocalPreferences(next);
    setSelectedChat((current) =>
      current
        ? {
            ...current,
            localArchived: !current.localArchived,
            effectiveArchived: normalizeBoolean(current.is_archived) || !current.localArchived,
          }
        : null,
    );
    setMenuVisible(false);
  };

  const toggleLocalMuted = async () => {
    if (!selectedChat?.uuid) {
      return;
    }

    const next = await patchChatListPreference(selectedChat.uuid, {
      isMuted: !selectedChat.localMuted,
    });

    setLocalPreferences(next);
    setSelectedChat((current) =>
      current
        ? {
            ...current,
            localMuted: !current.localMuted,
            effectiveMuted: normalizeBoolean(current.is_muted) || !current.localMuted,
          }
        : null,
    );
    setMenuVisible(false);
  };

  const toggleSelectedChatContact = async () => {
    const peerUuid = selectedChat?.peer_user?.uuid;

    if (!peerUuid) {
      return;
    }

    if (selectedChat?.localContact) {
      await removeLocalContact(peerUuid);
      setLocalContactUuids((current) => {
        const next = new Set(current);
        next.delete(peerUuid);
        return next;
      });
    } else {
      await addLocalContact(peerUuid);
      setLocalContactUuids((current) => new Set(current).add(peerUuid));
    }

    setMenuVisible(false);
  };

  const hideSelectedChat = () => {
    if (!selectedChat?.uuid) {
      return;
    }

    const chatUuid = selectedChat.uuid;
    const title = chatTitle(selectedChat);

    Alert.alert(
      'Скрыть чат?',
      `Чат «${title}» будет скрыт только на этом устройстве. Сообщения на сервере не удаляются.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Скрыть',
          style: 'destructive',
          onPress: async () => {
            try {
              const next = await patchChatListPreference(chatUuid, {
                isHidden: true,
                isArchived: true,
                isMuted: true,
              });
              if (selectedChat?.peer_user?.uuid) {
                await removeLocalContact(selectedChat.peer_user.uuid);
                setLocalContactUuids((current) => {
                  const localNext = new Set(current);
                  localNext.delete(selectedChat.peer_user!.uuid);
                  return localNext;
                });
              }

              setLocalPreferences(next);
              setData((current) => current.filter((item) => item.uuid !== chatUuid));
              setSelectedChat(null);
              setMenuVisible(false);
            } catch (error) {
              console.error('hideSelectedChat error:', error);
            }
          },
        },
      ],
    );
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
          <Text style={[styles.headerTitle, { color: ui.textPrimary }]}>Чаты</Text>
          <Pressable
            onPress={() => setMainMenuVisible(true)}
            accessibilityLabel="Открыть меню"
            style={({ pressed }) => [styles.menuTrigger, pressed && { backgroundColor: ui.bgHover }]}
          >
            <View style={styles.menuDots}>
              <View style={[styles.menuDot, { backgroundColor: ui.textSecondary }]} />
              <View style={[styles.menuDot, { backgroundColor: ui.textSecondary }]} />
              <View style={[styles.menuDot, { backgroundColor: ui.textSecondary }]} />
            </View>
          </Pressable>
        </View>

        <View style={[styles.searchContainer, { backgroundColor: ui.bgPrimary }]}> 
          <SearchBar value={search} onChangeText={setSearch} placeholder="Поиск чатов и людей" ui={ui} />
        </View>

        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item.uuid}
          initialNumToRender={16}
          maxToRenderPerBatch={12}
          updateCellsBatchingPeriod={50}
          windowSize={8}
          removeClippedSubviews={Platform.OS !== 'web'}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadChats()}
              tintColor={ui.accent}
              colors={[ui.accent]}
            />
          }
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              <StoriesStrip compact />

              {activeTab !== 'all' ? (
                <View style={[styles.filterBanner, { backgroundColor: ui.bgSecondary }]}> 
                  <Text style={[styles.filterText, { color: ui.textPrimary }]}>Показано: {activeFilterLabel}</Text>
                  <Pressable onPress={() => setActiveTab('all')} hitSlop={10}>
                    <Ionicons name="close" size={18} color={ui.textSecondary} />
                  </Pressable>
                </View>
              ) : null}

              {search.trim().length >= 2 ? (
                <View style={styles.peopleSection}>
                  <Text style={[styles.sectionTitle, { color: ui.textPrimary }]}>Люди</Text>

                  {searchingPeople ? (
                    <Text style={[styles.helperText, { color: ui.textSecondary }]}>Поиск...</Text>
                  ) : people.length > 0 ? (
                    <View style={[styles.peopleCard, { backgroundColor: ui.bgPrimary }]}> 
                      {people.map((person, index) => {
                        const name = personName(person);
                        return (
                          <Pressable
                            key={person.uuid}
                            onPress={() => void startDirectChat(person)}
                            disabled={creatingFor === person.uuid}
                            style={({ pressed }) => [
                              styles.personRow,
                              { backgroundColor: pressed ? ui.bgHover : ui.bgPrimary },
                            ]}
                          >
                            <RoundAvatar
                              title={name}
                              uri={person.avatar}
                              color={getAvatarColor(name)}
                              size={46}
                              ui={ui}
                            />
                            <View style={styles.personTextBlock}>
                              <Text style={[styles.chatName, { color: ui.textPrimary }]} numberOfLines={1}>
                                {name}
                              </Text>
                              <Text style={[styles.chatMessage, { color: ui.textSecondary }]} numberOfLines={1}>
                                @{person.username || person.email || 'user'}
                              </Text>
                            </View>
                            {creatingFor === person.uuid ? (
                              <ActivityIndicator size="small" color={ui.accent} />
                            ) : (
                              <View style={[styles.smallActionBtn, { backgroundColor: ui.accent }]}> 
                                <Text style={styles.smallActionText}>Чат</Text>
                              </View>
                            )}
                            {index < people.length - 1 ? (
                              <View style={[styles.personSeparator, { backgroundColor: ui.separator }]} />
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={[styles.helperText, { color: ui.textSecondary }]}>Люди не найдены</Text>
                  )}
                </View>
              ) : null}
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyTitle, { color: ui.textPrimary }]}> 
                {activeTab === 'archive' ? 'Архив пуст' : 'Чатов пока нет'}
              </Text>
              <Text style={[styles.helperText, { color: ui.textSecondary }]}> 
                {activeTab === 'archive'
                  ? 'Здесь появятся архивированные чаты.'
                  : 'Начни диалог через поиск пользователя сверху.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ChatRow
              item={item}
              ui={ui}
              callingKey={callingKey}
              onOpenChat={openChat}
              onOpenMenu={openChatMenu}
              onOpenCallChooser={openCallChooser}
            />
          )}
        />

        <Modal visible={mainMenuVisible} transparent animationType="fade" onRequestClose={() => setMainMenuVisible(false)}>
          <View style={styles.menuModalRoot}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMainMenuVisible(false)} />
            <View style={[styles.dropdownMenu, { backgroundColor: ui.bgSecondary, shadowColor: ui.shadow }]}> 
              <DropdownItem
                icon="bookmark-outline"
                label="Избранное"
                ui={ui}
                onPress={() => {
                  setActiveTab('pinned');
                  setMainMenuVisible(false);
                }}
              />
              <DropdownItem icon="people-outline" label="Создать группу" ui={ui} onPress={openGroupCreator} />
              <DropdownItem
                icon="archive-outline"
                label="Архив"
                ui={ui}
                onPress={() => {
                  setActiveTab('archive');
                  setMainMenuVisible(false);
                }}
              />
              <DropdownItem
                icon="pin-outline"
                label="Закрепленное"
                ui={ui}
                onPress={() => {
                  setActiveTab('pinned');
                  setMainMenuVisible(false);
                }}
              />
              <View style={[styles.dropdownDivider, { backgroundColor: ui.separator }]} />
              <DropdownItem
                icon={theme.isDark ? 'sunny-outline' : 'moon-outline'}
                label={theme.isDark ? 'Дневной режим' : 'Ночной режим'}
                ui={ui}
                onPress={() => void switchDayNight()}
              />
            </View>
          </View>
        </Modal>

        <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
          <View style={[styles.bottomModalRoot, { backgroundColor: ui.overlay }]}> 
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuVisible(false)} />
            <View style={styles.bottomSheetWrap}>
              <View style={[styles.sheet, { backgroundColor: ui.bgSecondary, shadowColor: ui.shadow }]}> 
                <Text style={[styles.sheetTitle, { color: ui.textPrimary }]}> 
                  {selectedChat ? chatTitle(selectedChat) : 'Чат'}
                </Text>

                <Pressable
                  onPress={() => void toggleLocalPinned()}
                  style={({ pressed }) => [
                    styles.sheetItem,
                    { borderColor: ui.separator, backgroundColor: pressed ? ui.bgHover : 'transparent' },
                  ]}
                >
                  <Ionicons
                    name={selectedChat?.localPinned ? 'bookmark' : 'bookmark-outline'}
                    size={20}
                    color={ui.accent}
                  />
                  <Text style={[styles.sheetItemText, { color: ui.textPrimary }]}> 
                    {selectedChat?.localPinned ? 'Убрать локальный закреп' : 'Закрепить локально'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => void toggleLocalArchived()}
                  style={({ pressed }) => [
                    styles.sheetItem,
                    { borderColor: ui.separator, backgroundColor: pressed ? ui.bgHover : 'transparent' },
                  ]}
                >
                  <Ionicons
                    name={selectedChat?.localArchived ? 'archive' : 'archive-outline'}
                    size={20}
                    color={ui.accent}
                  />
                  <Text style={[styles.sheetItemText, { color: ui.textPrimary }]}> 
                    {selectedChat?.localArchived ? 'Убрать из локального архива' : 'Архивировать локально'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => void toggleLocalMuted()}
                  style={({ pressed }) => [
                    styles.sheetItem,
                    { borderColor: ui.separator, backgroundColor: pressed ? ui.bgHover : 'transparent' },
                  ]}
                >
                  <Ionicons
                    name={selectedChat?.localMuted ? 'volume-high-outline' : 'volume-mute-outline'}
                    size={20}
                    color={ui.accent}
                  />
                  <Text style={[styles.sheetItemText, { color: ui.textPrimary }]}>
                    {selectedChat?.localMuted ? 'Включить звук' : 'Беззвучно'}
                  </Text>
                </Pressable>

                {selectedChat?.peer_user?.uuid ? (
                  <Pressable
                    onPress={() => void toggleSelectedChatContact()}
                    style={({ pressed }) => [
                      styles.sheetItem,
                      { borderColor: ui.separator, backgroundColor: pressed ? ui.bgHover : 'transparent' },
                    ]}
                  >
                    <Ionicons
                      name={selectedChat.localContact ? 'person-remove-outline' : 'person-add-outline'}
                      size={20}
                      color={ui.accent}
                    />
                    <Text style={[styles.sheetItemText, { color: ui.textPrimary }]}>
                      {selectedChat.localContact ? 'Убрать из контактов' : 'Добавить в контакты'}
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  onPress={hideSelectedChat}
                  style={({ pressed }) => [
                    styles.sheetItem,
                    {
                      borderColor: 'rgba(239,68,68,0.32)',
                      backgroundColor: pressed ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.06)',
                    },
                  ]}
                >
                  <Ionicons name="trash-outline" size={20} color={ui.danger} />
                  <Text style={[styles.sheetItemText, { color: ui.danger }]}>Удалить / скрыть чат</Text>
                </Pressable>

                {selectedChat ? (
                  <Text style={[styles.sheetHint, { color: ui.textSecondary }]}> 
                    Скрытие работает локально на этом устройстве. Сообщения и сам чат на сервере не удаляются.
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={groupVisible} transparent animationType="slide" onRequestClose={() => setGroupVisible(false)}>
          <View style={[styles.bottomModalRoot, { backgroundColor: ui.overlay }]}> 
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setGroupVisible(false)} />
            <View style={styles.bottomSheetWrap}>
              <View style={[styles.sheet, { backgroundColor: ui.bgSecondary, shadowColor: ui.shadow }]}> 
                <Text style={[styles.sheetTitle, { color: ui.textPrimary }]}>Создать группу</Text>
                <TextInput
                  value={groupTitle}
                  onChangeText={setGroupTitle}
                  placeholder="Название группы"
                  placeholderTextColor={ui.textSecondary}
                  style={[
                    styles.groupInput,
                    { color: ui.textPrimary, backgroundColor: ui.bgPrimary, borderColor: ui.separator },
                  ]}
                />

                <SearchBar value={groupSearch} onChangeText={setGroupSearch} placeholder="Найти участников" ui={ui} />

                <ScrollView style={styles.groupPeopleList} contentContainerStyle={styles.groupPeopleContent}>
                  {groupSearching ? (
                    <ActivityIndicator color={ui.accent} />
                  ) : groupPeople.length ? (
                    groupPeople.map((person) => {
                      const selected = selectedGroupMembers.includes(person.uuid);
                      const name = personName(person);

                      return (
                        <Pressable
                          key={person.uuid}
                          onPress={() => toggleGroupMember(person.uuid)}
                          style={({ pressed }) => [
                            styles.groupPersonRow,
                            {
                              backgroundColor: selected
                                ? `${ui.accent}22`
                                : pressed
                                  ? ui.bgHover
                                  : ui.bgPrimary,
                            },
                          ]}
                        >
                          <RoundAvatar
                            title={name}
                            uri={person.avatar}
                            color={getAvatarColor(name)}
                            size={42}
                            ui={ui}
                          />
                          <View style={styles.groupPersonText}>
                            <Text style={[styles.chatName, { color: ui.textPrimary }]} numberOfLines={1}>
                              {name}
                            </Text>
                            <Text style={[styles.chatMessage, { color: ui.textSecondary }]} numberOfLines={1}>
                              @{person.username || person.email || 'user'}
                            </Text>
                          </View>
                          <Ionicons
                            name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                            size={22}
                            color={selected ? ui.accent : ui.textSecondary}
                          />
                        </Pressable>
                      );
                    })
                  ) : (
                    <Text style={[styles.helperText, { color: ui.textSecondary }]}> 
                      Введи минимум 2 символа, чтобы найти участников.
                    </Text>
                  )}
                </ScrollView>

                <Pressable
                  onPress={() => void submitGroup()}
                  disabled={groupCreating}
                  style={({ pressed }) => [
                    styles.createGroupButton,
                    { backgroundColor: ui.accent, opacity: groupCreating ? 0.72 : pressed ? 0.82 : 1 },
                  ]}
                >
                  {groupCreating ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                      <Text style={styles.createGroupButtonText}>Создать ({selectedGroupMembers.length})</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={Boolean(callChooserChat)}
          transparent
          animationType="fade"
          onRequestClose={() => setCallChooserChat(null)}
        >
          <View style={[styles.bottomModalRoot, { backgroundColor: ui.overlay }]}> 
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setCallChooserChat(null)} />
            <View style={styles.bottomSheetWrap}>
              <View style={[styles.sheet, { backgroundColor: ui.bgSecondary, shadowColor: ui.shadow }]}> 
                <Text style={[styles.sheetTitle, { color: ui.textPrimary }]}>Позвонить</Text>
                <Text style={[styles.sheetSub, { color: ui.textSecondary }]}> 
                  {callChooserChat ? chatTitle(callChooserChat) : ''}
                </Text>

                <Pressable
                  onPress={() => (callChooserChat ? void startCall(callChooserChat, 'audio') : undefined)}
                  disabled={!callChooserChat || Boolean(callingKey)}
                  style={({ pressed }) => [
                    styles.callChoice,
                    { backgroundColor: ui.success, opacity: pressed ? 0.8 : callingKey ? 0.6 : 1 },
                  ]}
                >
                  <Ionicons name="call" size={20} color="#FFFFFF" />
                  <Text style={styles.callChoiceText}>
                    {callingKey === `${callChooserChat?.uuid}:audio` ? 'Запускаю...' : 'Аудио звонок'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => (callChooserChat ? void startCall(callChooserChat, 'video') : undefined)}
                  disabled={!callChooserChat || Boolean(callingKey)}
                  style={({ pressed }) => [
                    styles.callChoice,
                    { backgroundColor: ui.accent, opacity: pressed ? 0.8 : callingKey ? 0.6 : 1 },
                  ]}
                >
                  <Ionicons name="videocam" size={20} color="#FFFFFF" />
                  <Text style={styles.callChoiceText}>
                    {callingKey === `${callChooserChat?.uuid}:video` ? 'Запускаю...' : 'Видео звонок'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setCallChooserChat(null)}
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
  menuDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  menuDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
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
  chatItem: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: 'relative',
  },
  chatContent: {
    flex: 1,
    minWidth: 0,
    height: 54,
    marginLeft: 14,
    justifyContent: 'center',
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  chatMessage: {
    fontSize: 14,
    fontWeight: '400',
  },
  chatMeta: {
    height: 54,
    minWidth: 42,
    marginLeft: 8,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  chatTime: {
    fontSize: 12,
    fontWeight: '400',
  },
  chatMetaBottom: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  pinIcon: {
    transform: [{ rotate: '45deg' }],
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  chatSeparator: {
    position: 'absolute',
    left: 84,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
  filterBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    minHeight: 40,
    borderRadius: 20,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  peopleSection: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  peopleCard: {
    overflow: 'hidden',
  },
  personRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  personTextBlock: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  },
  personSeparator: {
    position: 'absolute',
    left: 58,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
  smallActionBtn: {
    minWidth: 56,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  helperText: {
    fontSize: 14,
    lineHeight: 20,
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
  menuModalRoot: {
    flex: 1,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 64,
    right: 16,
    width: 240,
    borderRadius: 16,
    paddingVertical: 8,
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 18,
  },
  dropdownItem: {
    minHeight: 46,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  dropdownText: {
    fontSize: 15,
    fontWeight: '500',
  },
  dropdownDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 6,
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
    marginBottom: 12,
  },
  sheetSub: {
    fontSize: 14,
    marginTop: -6,
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
  sheetHint: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  groupInput: {
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    marginBottom: 10,
  },
  groupPeopleList: {
    maxHeight: 260,
    marginTop: 10,
    marginBottom: 12,
  },
  groupPeopleContent: {
    gap: 8,
  },
  groupPersonRow: {
    minHeight: 58,
    borderRadius: 18,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  groupPersonText: {
    flex: 1,
    minWidth: 0,
  },
  createGroupButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  createGroupButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
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
