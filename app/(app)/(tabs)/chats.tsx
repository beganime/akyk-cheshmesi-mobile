import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { GlassCard } from '@/src/components/GlassCard';
import { SearchInput } from '@/src/components/SearchInput';
import { useTheme } from '@/src/theme/ThemeProvider';
import { fetchChats, createDirectChat } from '@/src/lib/api/chats';
import { searchUsers, UserShort } from '@/src/lib/api/contacts';
import { loadCachedChats, saveCachedChats } from '@/src/lib/db/cache';
import { realtimeClient } from '@/src/lib/realtime/socket';
import {
  applyChatLocalPreferences,
  ChatListItemWithLocal,
  ChatLocalPreferenceMap,
  getAllChatLocalPreferences,
  setChatArchivedLocally,
  setChatLabelLocally,
  setChatPinnedLocally,
  sortChatsWithLocalState,
} from '@/src/lib/local/chatPreferences';
import type { ChatLastMessage, ChatListItem } from '@/src/types/chat';

const PRESET_LABELS = [
  { label: 'Семья', color: '#4E7BFF' },
  { label: 'Друзья', color: '#1E9B62' },
  { label: 'Работа', color: '#A855F7' },
  { label: 'Учёба', color: '#F59E0B' },
  { label: 'Важное', color: '#EF4444' },
];

function chatTitle(item: ChatListItem) {
  return item.display_title || item.title || item.peer_user?.username || 'Без названия';
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

function lastMessageText(lastMessage: ChatLastMessage) {
  if (!lastMessage) return 'Пока без сообщений';

  if (typeof lastMessage === 'string') {
    return lastMessage || 'Пока без сообщений';
  }

  if (typeof lastMessage === 'object') {
    if (lastMessage.preview) return lastMessage.preview;
    if (lastMessage.text) return lastMessage.text;

    switch (lastMessage.message_type) {
      case 'image':
        return 'Фото';
      case 'video':
        return 'Видео';
      case 'audio':
        return 'Аудио';
      case 'file':
        return 'Файл';
      case 'sticker':
        return 'Стикер';
      case 'system':
        return 'Системное сообщение';
      default:
        return 'Пока без сообщений';
    }
  }

  return 'Пока без сообщений';
}

function searchableLastMessage(lastMessage: ChatLastMessage) {
  if (!lastMessage) return '';
  if (typeof lastMessage === 'string') return lastMessage.toLowerCase();

  return `${lastMessage.preview ?? ''} ${lastMessage.text ?? ''} ${lastMessage.message_type ?? ''}`.toLowerCase();
}

function formatTime(value?: string | null) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function buildDisplayChats(
  chats: ChatListItem[],
  preferencesMap: ChatLocalPreferenceMap,
): ChatListItemWithLocal[] {
  return sortChatsWithLocalState(applyChatLocalPreferences(chats, preferencesMap));
}

export default function ChatsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [rawChats, setRawChats] = useState<ChatListItem[]>([]);
  const [localPrefs, setLocalPrefs] = useState<ChatLocalPreferenceMap>({});
  const [people, setPeople] = useState<UserShort[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchingPeople, setSearchingPeople] = useState(false);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [selectedChat, setSelectedChat] = useState<ChatListItemWithLocal | null>(null);

  const hydrateLocalPrefs = useCallback(async () => {
    const map = await getAllChatLocalPreferences();
    setLocalPrefs(map);
  }, []);

  const loadChats = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setRefreshing(true);

        const response = await fetchChats(1, 50);
        const nextChats = response.results ?? [];

        setRawChats(nextChats);
        await saveCachedChats(nextChats);
      } catch (error) {
        console.error('loadChats error:', error);
      } finally {
        if (!silent) setRefreshing(false);
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const hydrate = async () => {
      const [cachedChats, prefs] = await Promise.all([
        loadCachedChats(),
        getAllChatLocalPreferences(),
      ]);

      setLocalPrefs(prefs);

      if (cachedChats.length) {
        setRawChats(cachedChats);
        setLoading(false);
      }
    };

    void hydrate();
    void loadChats(true);
  }, [loadChats]);

  useFocusEffect(
    useCallback(() => {
      void hydrateLocalPrefs();
      void loadChats(true);

      const interval = setInterval(() => {
        void loadChats(true);
      }, 3000);

      const unsubscribe = realtimeClient.subscribe((event) => {
        if (event.type === 'connected' || event.type === 'ws_open') return;
        void loadChats(true);
      });

      return () => {
        clearInterval(interval);
        unsubscribe();
      };
    }, [hydrateLocalPrefs, loadChats]),
  );

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
        setPeople(results);
      } catch (error) {
        console.error('searchUsers error:', error);
        setPeople([]);
      } finally {
        setSearchingPeople(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [search]);

  const chatsWithLocalState = useMemo(
    () => buildDisplayChats(rawChats, localPrefs),
    [rawChats, localPrefs],
  );

  const filteredChats = useMemo(() => {
    const q = search.trim().toLowerCase();

    let list = chatsWithLocalState.filter((item) =>
      showArchivedOnly ? Boolean(item.local_archived) : !Boolean(item.local_archived),
    );

    if (!q) {
      return list;
    }

    return list.filter((item) => {
      const title = chatTitle(item).toLowerCase();
      const lastMessage = searchableLastMessage(item.last_message);
      const label = (item.local_label ?? '').toLowerCase();

      return title.includes(q) || lastMessage.includes(q) || label.includes(q);
    });
  }, [chatsWithLocalState, search, showArchivedOnly]);

  const stats = useMemo(() => {
    const archived = chatsWithLocalState.filter((item) => item.local_archived).length;
    const pinned = chatsWithLocalState.filter(
      (item) => item.local_pinned || Boolean(item.is_pinned),
    ).length;

    return {
      total: chatsWithLocalState.length,
      archived,
      pinned,
    };
  }, [chatsWithLocalState]);

  const startDirectChat = async (user: UserShort) => {
    try {
      setCreatingFor(user.uuid);

      const createdChat = await createDirectChat(user.uuid);

      setSearch('');
      await loadChats(true);

      if (createdChat?.uuid) {
        router.push({
          pathname: '/(app)/chat/[chatUuid]',
          params: { chatUuid: createdChat.uuid },
        });
      }
    } catch (error) {
      console.error('createDirectChat error:', error);
    } finally {
      setCreatingFor(null);
    }
  };

  const openChat = (chatUuid: string) => {
    router.push({
      pathname: '/(app)/chat/[chatUuid]',
      params: { chatUuid },
    });
  };

  const handleToggleArchiveLocal = async (chat: ChatListItemWithLocal) => {
    const nextArchived = !Boolean(chat.local_archived);
    const nextMap = await setChatArchivedLocally(chat.uuid, nextArchived);
    setLocalPrefs(nextMap);
    setSelectedChat(null);
  };

  const handleTogglePinLocal = async (chat: ChatListItemWithLocal) => {
    const nextPinned = !Boolean(chat.local_pinned);
    const nextMap = await setChatPinnedLocally(chat.uuid, nextPinned);
    setLocalPrefs(nextMap);
    setSelectedChat(null);
  };

  const handleSetLabelLocal = async (
    chat: ChatListItemWithLocal,
    label: string | null,
    color?: string | null,
  ) => {
    const nextMap = await setChatLabelLocally(chat.uuid, label, color);
    setLocalPrefs(nextMap);
    setSelectedChat(null);
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
      <FlatList
        data={filteredChats}
        keyExtractor={(item) => item.uuid}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadChats()} />}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom: Math.max(insets.bottom, 18) + 116,
          },
        ]}
        ListHeaderComponent={
          <>
            <LinearGradient
              colors={theme.colors.heroGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.hero,
                {
                  borderColor: theme.colors.borderStrong,
                },
              ]}
            >
              <View style={styles.heroTop}>
                <View>
                  <Text style={[styles.screenTitle, { color: theme.colors.text }]}>Чаты</Text>
                  <Text style={[styles.screenSubtitle, { color: theme.colors.muted }]}>
                    Быстро, чисто и по-деловому
                  </Text>
                </View>

                <View
                  style={[
                    styles.heroCounter,
                    {
                      backgroundColor: theme.colors.cardStrong,
                      borderColor: theme.colors.borderStrong,
                    },
                  ]}
                >
                  <Ionicons name="chatbubbles-outline" size={16} color={theme.colors.primary} />
                  <Text style={[styles.heroCounterText, { color: theme.colors.text }]}>
                    {stats.total}
                  </Text>
                </View>
              </View>

              <SearchInput
                value={search}
                onChangeText={setSearch}
                placeholder="Поиск чатов, людей и локальных меток"
              />

              <View style={styles.quickStatsRow}>
                <View
                  style={[
                    styles.quickStat,
                    {
                      backgroundColor: theme.colors.cardStrong,
                      borderColor: theme.colors.borderStrong,
                    },
                  ]}
                >
                  <Text style={[styles.quickStatValue, { color: theme.colors.text }]}>
                    {stats.pinned}
                  </Text>
                  <Text style={[styles.quickStatLabel, { color: theme.colors.muted }]}>
                    Закреплённые
                  </Text>
                </View>

                <View
                  style={[
                    styles.quickStat,
                    {
                      backgroundColor: theme.colors.cardStrong,
                      borderColor: theme.colors.borderStrong,
                    },
                  ]}
                >
                  <Text style={[styles.quickStatValue, { color: theme.colors.text }]}>
                    {stats.archived}
                  </Text>
                  <Text style={[styles.quickStatLabel, { color: theme.colors.muted }]}>
                    В архиве
                  </Text>
                </View>
              </View>

              <View style={styles.segmentRow}>
                <Pressable
                  onPress={() => setShowArchivedOnly(false)}
                  style={[
                    styles.segmentButton,
                    {
                      backgroundColor: !showArchivedOnly
                        ? theme.colors.primarySoft
                        : theme.colors.cardStrong,
                      borderColor: theme.colors.borderStrong,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        color: !showArchivedOnly ? theme.colors.primary : theme.colors.text,
                      },
                    ]}
                  >
                    Активные
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowArchivedOnly(true)}
                  style={[
                    styles.segmentButton,
                    {
                      backgroundColor: showArchivedOnly
                        ? theme.colors.primarySoft
                        : theme.colors.cardStrong,
                      borderColor: theme.colors.borderStrong,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        color: showArchivedOnly ? theme.colors.primary : theme.colors.text,
                      },
                    ]}
                  >
                    Архив
                  </Text>
                </Pressable>
              </View>
            </LinearGradient>

            {search.trim().length >= 2 && (
              <View style={styles.peopleSection}>
                <View style={styles.peopleHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    Люди
                  </Text>
                  {searchingPeople ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : null}
                </View>

                {people.length > 0 ? (
                  <View style={styles.peopleList}>
                    {people.map((item) => (
                      <GlassCard key={item.uuid}>
                        <View style={styles.personRow}>
                          <View
                            style={[
                              styles.avatar,
                              { backgroundColor: theme.colors.primarySoft },
                            ]}
                          >
                            <Text style={[styles.avatarText, { color: theme.colors.primary }]}>
                              {personName(item).slice(0, 1).toUpperCase()}
                            </Text>
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
                              {personName(item)}
                            </Text>
                            <Text
                              style={[styles.subtitle, { color: theme.colors.muted }]}
                              numberOfLines={1}
                            >
                              @{item.username || 'user'}
                            </Text>
                          </View>

                          <Pressable
                            onPress={() => void startDirectChat(item)}
                            disabled={creatingFor === item.uuid}
                            style={[
                              styles.actionBtn,
                              {
                                backgroundColor: theme.colors.primary,
                              },
                            ]}
                          >
                            <Text style={styles.actionBtnText}>
                              {creatingFor === item.uuid ? '...' : 'Чат'}
                            </Text>
                          </Pressable>
                        </View>
                      </GlassCard>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.helperText, { color: theme.colors.muted }]}>
                    Люди не найдены
                  </Text>
                )}
              </View>
            )}

            <View style={styles.sectionHead}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {showArchivedOnly ? 'Архив чатов' : 'Чаты'}
              </Text>
              <Text style={[styles.sectionHint, { color: theme.colors.muted }]}>
                Зажми чат для локальных действий
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <GlassCard>
            <View style={styles.emptyWrap}>
              <Ionicons name="chatbox-ellipses-outline" size={34} color={theme.colors.primary} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                {showArchivedOnly ? 'Архив пока пустой' : 'Пока пусто'}
              </Text>
              <Text style={[styles.emptyText, { color: theme.colors.muted }]}>
                {showArchivedOnly
                  ? 'Локально архивируй чаты, и они появятся здесь только на этом устройстве.'
                  : 'Начни диалог, закрепи важное и расставь метки для удобства.'}
              </Text>
            </View>
          </GlassCard>
        }
        renderItem={({ item }) => {
          const unread = Number(item.unread_count ?? 0) || 0;
          const isPinned = Boolean(item.local_pinned || item.is_pinned);

          return (
            <Pressable
              onPress={() => openChat(item.uuid)}
              onLongPress={() => setSelectedChat(item)}
            >
              <GlassCard>
                <View style={styles.chatRow}>
                  <View
                    style={[
                      styles.avatar,
                      {
                        backgroundColor: theme.colors.primarySoft,
                      },
                    ]}
                  >
                    <Text style={[styles.avatarText, { color: theme.colors.primary }]}>
                      {chatTitle(item).slice(0, 1).toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
                        {chatTitle(item)}
                      </Text>

                      <View style={styles.titleBadges}>
                        {item.local_label ? (
                          <View
                            style={[
                              styles.localLabel,
                              {
                                backgroundColor:
                                  item.local_label_color || theme.colors.primarySoft,
                              },
                            ]}
                          >
                            <Text style={styles.localLabelText}>{item.local_label}</Text>
                          </View>
                        ) : null}

                        {isPinned ? (
                          <Ionicons name="bookmark" size={15} color={theme.colors.primary} />
                        ) : null}
                      </View>
                    </View>

                    <View style={styles.subtitleRow}>
                      <Text
                        style={[styles.subtitle, { color: theme.colors.muted }]}
                        numberOfLines={1}
                      >
                        {lastMessageText(item.last_message)}
                      </Text>

                      {!!item.last_message_at && (
                        <Text style={[styles.timeText, { color: theme.colors.muted }]}>
                          {formatTime(item.last_message_at)}
                        </Text>
                      )}
                    </View>
                  </View>

                  {unread > 0 ? (
                    <View
                      style={[
                        styles.unreadBadge,
                        {
                          backgroundColor: theme.colors.primary,
                        },
                      ]}
                    >
                      <Text style={styles.unreadText}>{unread > 99 ? '99+' : unread}</Text>
                    </View>
                  ) : null}
                </View>
              </GlassCard>
            </Pressable>
          );
        }}
      />

      <View
        pointerEvents="box-none"
        style={[
          styles.fabColumn,
          {
            bottom: Math.max(insets.bottom, 18) + 82,
          },
        ]}
      >
        <Pressable
          onPress={() => setShowArchivedOnly((prev) => !prev)}
          style={[
            styles.miniFab,
            {
              backgroundColor: theme.colors.cardStrong,
              borderColor: theme.colors.borderStrong,
              shadowColor: theme.colors.shadow,
            },
          ]}
        >
          <Ionicons
            name={showArchivedOnly ? 'archive' : 'archive-outline'}
            size={20}
            color={theme.colors.text}
          />
        </Pressable>

        <Pressable
          onPress={() => router.push('/(app)/(tabs)/contacts')}
          style={[
            styles.mainFab,
            {
              backgroundColor: theme.colors.fab,
              shadowColor: theme.colors.shadow,
            },
          ]}
        >
          <Ionicons name="person-add" size={22} color={theme.colors.fabText} />
        </Pressable>
      </View>

      <Modal
        transparent
        animationType="fade"
        visible={Boolean(selectedChat)}
        onRequestClose={() => setSelectedChat(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedChat(null)}>
          <Pressable
            onPress={() => null}
            style={[
              styles.bottomSheet,
              {
                backgroundColor: theme.colors.cardSolid,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            {selectedChat ? (
              <>
                <View style={styles.sheetHandleWrap}>
                  <View
                    style={[
                      styles.sheetHandle,
                      {
                        backgroundColor: theme.colors.borderStrong,
                      },
                    ]}
                  />
                </View>

                <Text style={[styles.sheetTitle, { color: theme.colors.text }]} numberOfLines={1}>
                  {chatTitle(selectedChat)}
                </Text>

                <Text style={[styles.sheetSubtitle, { color: theme.colors.muted }]}>
                  Локальные действия на этом устройстве
                </Text>

                <View style={styles.sheetActions}>
                  <Pressable
                    onPress={() => void handleTogglePinLocal(selectedChat)}
                    style={[
                      styles.sheetAction,
                      {
                        borderColor: theme.colors.borderStrong,
                        backgroundColor: theme.colors.backgroundTertiary,
                      },
                    ]}
                  >
                    <Ionicons
                      name={selectedChat.local_pinned ? 'bookmark' : 'bookmark-outline'}
                      size={18}
                      color={theme.colors.primary}
                    />
                    <Text style={[styles.sheetActionText, { color: theme.colors.text }]}>
                      {selectedChat.local_pinned ? 'Убрать из закрепа' : 'Закрепить локально'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => void handleToggleArchiveLocal(selectedChat)}
                    style={[
                      styles.sheetAction,
                      {
                        borderColor: theme.colors.borderStrong,
                        backgroundColor: theme.colors.backgroundTertiary,
                      },
                    ]}
                  >
                    <Ionicons
                      name={selectedChat.local_archived ? 'archive' : 'archive-outline'}
                      size={18}
                      color={theme.colors.primary}
                    />
                    <Text style={[styles.sheetActionText, { color: theme.colors.text }]}>
                      {selectedChat.local_archived ? 'Вернуть из архива' : 'Архивировать локально'}
                    </Text>
                  </Pressable>
                </View>

                <Text style={[styles.labelTitle, { color: theme.colors.text }]}>Метки</Text>

                <View style={styles.labelGrid}>
                  {PRESET_LABELS.map((preset) => (
                    <Pressable
                      key={preset.label}
                      onPress={() =>
                        void handleSetLabelLocal(selectedChat, preset.label, preset.color)
                      }
                      style={[
                        styles.labelChip,
                        {
                          backgroundColor: preset.color,
                        },
                      ]}
                    >
                      <Text style={styles.labelChipText}>{preset.label}</Text>
                    </Pressable>
                  ))}

                  <Pressable
                    onPress={() => void handleSetLabelLocal(selectedChat, null, null)}
                    style={[
                      styles.labelChip,
                      {
                        backgroundColor: theme.colors.backgroundTertiary,
                        borderColor: theme.colors.borderStrong,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text style={[styles.labelChipText, { color: theme.colors.text }]}>
                      Убрать метку
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 12,
  },
  hero: {
    borderRadius: 30,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 14,
    gap: 14,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroCounter: {
    minWidth: 54,
    height: 40,
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  heroCounterText: {
    fontSize: 15,
    fontWeight: '800',
  },
  screenTitle: {
    fontSize: 30,
    fontWeight: '800',
  },
  screenSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  quickStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickStat: {
    flex: 1,
    minHeight: 70,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  quickStatValue: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 3,
  },
  quickStatLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
  },
  peopleSection: {
    marginBottom: 14,
    gap: 10,
  },
  peopleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  peopleList: {
    gap: 10,
  },
  helperText: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 2,
  },
  sectionHead: {
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 3,
  },
  sectionHint: {
    fontSize: 13,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  subtitleRow: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subtitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  localLabel: {
    maxWidth: 88,
    minHeight: 22,
    borderRadius: 999,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  localLabelText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  actionBtn: {
    minWidth: 66,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
  },
  fabColumn: {
    position: 'absolute',
    right: 18,
    alignItems: 'center',
    gap: 12,
  },
  miniFab: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  mainFab: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
  },
  sheetHandleWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  sheetHandle: {
    width: 42,
    height: 5,
    borderRadius: 999,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  sheetSubtitle: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
  sheetActions: {
    gap: 10,
    marginBottom: 18,
  },
  sheetAction: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetActionText: {
    fontSize: 15,
    fontWeight: '700',
  },
  labelTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  labelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  labelChip: {
    minHeight: 38,
    borderRadius: 999,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelChipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});