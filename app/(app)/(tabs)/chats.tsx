import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { GlassCard } from '@/src/components/GlassCard';
import { SearchInput } from '@/src/components/SearchInput';
import { useTheme } from '@/src/theme/ThemeProvider';
import { fetchChats, createDirectChat } from '@/src/lib/api/chats';
import { searchUsers, UserShort } from '@/src/lib/api/contacts';
import type { ChatListItem } from '@/src/types/chat';
import {
  getLocalChatPreference,
  loadChatListPreferences,
  patchChatListPreference,
  type LocalChatPreferencesMap,
} from '@/src/lib/local/chatListPreferences';

type ChatTab = 'all' | 'pinned' | 'archive';

type DecoratedChat = ChatListItem & {
  effectivePinned: boolean;
  effectiveArchived: boolean;
  localPinned: boolean;
  localArchived: boolean;
};

const chatTabs: Array<{ key: ChatTab; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'pinned', label: 'Закреплённые' },
  { key: 'archive', label: 'Архив' },
];

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
  if (type === 'audio') return 'Голосовое сообщение';
  if (type === 'file') return 'Файл';
  if (type === 'sticker') return 'Стикер';

  return 'Сообщение';
}

function getDecoratedChats(
  data: ChatListItem[],
  localPreferences: LocalChatPreferencesMap,
): DecoratedChat[] {
  return data.map((item) => {
    const local = getLocalChatPreference(localPreferences, item.uuid);
    const serverPinned = normalizeBoolean(item.is_pinned);
    const serverArchived = normalizeBoolean(item.is_archived);

    return {
      ...item,
      localPinned: Boolean(local.isPinned),
      localArchived: Boolean(local.isArchived),
      effectivePinned: serverPinned || Boolean(local.isPinned),
      effectiveArchived: serverArchived || Boolean(local.isArchived),
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

export default function ChatsScreen() {
  const { theme } = useTheme();

  const [data, setData] = useState<ChatListItem[]>([]);
  const [people, setPeople] = useState<UserShort[]>([]);
  const [localPreferences, setLocalPreferences] = useState<LocalChatPreferencesMap>({});
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchingPeople, setSearchingPeople] = useState(false);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ChatTab>('all');
  const [selectedChat, setSelectedChat] = useState<DecoratedChat | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);

  const hydrateLocalPreferences = useCallback(async () => {
    const loaded = await loadChatListPreferences();
    setLocalPreferences(loaded);
  }, []);

  const loadChats = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);

    try {
      if (!silent) {
        setRefreshing(true);
      }

      const response = await fetchChats(1, 100);
      setData(Array.isArray(response?.results) ? response.results : []);
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
    void loadChats();
  }, [hydrateLocalPreferences, loadChats]);

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

  const decoratedChats = useMemo(() => {
    return getDecoratedChats(data, localPreferences);
  }, [data, localPreferences]);

  const tabCounts = useMemo(() => {
    const allCount = decoratedChats.filter((item) => !item.effectiveArchived).length;
    const pinnedCount = decoratedChats.filter(
      (item) => item.effectivePinned && !item.effectiveArchived,
    ).length;
    const archiveCount = decoratedChats.filter((item) => item.effectiveArchived).length;

    return {
      all: allCount,
      pinned: pinnedCount,
      archive: archiveCount,
    };
  }, [decoratedChats]);

  const filteredChats = useMemo(() => {
    const q = search.trim().toLowerCase();

    const byTab = decoratedChats.filter((item) => {
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
  }, [activeTab, decoratedChats, search]);

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
        <Text style={[styles.screenTitle, { color: theme.colors.text }]}>Чаты</Text>

        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Поиск чатов и людей"
        />

        <View style={styles.tabsRow}>
          {chatTabs.map((tab) => {
            const active = activeTab === tab.key;
            const count =
              tab.key === 'all'
                ? tabCounts.all
                : tab.key === 'pinned'
                  ? tabCounts.pinned
                  : tabCounts.archive;

            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.tabChip,
                  {
                    backgroundColor: active ? theme.colors.primary : theme.colors.cardStrong,
                    borderColor: active ? 'transparent' : theme.colors.borderStrong,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabChipText,
                    {
                      color: active ? '#FFFFFF' : theme.colors.text,
                    },
                  ]}
                >
                  {tab.label}
                </Text>

                <View
                  style={[
                    styles.tabCountBadge,
                    {
                      backgroundColor: active ? 'rgba(255,255,255,0.18)' : theme.colors.primarySoft,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabCountText,
                      {
                        color: active ? '#FFFFFF' : theme.colors.primary,
                      },
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        data={filteredChats}
        keyExtractor={(item) => item.uuid}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadChats()} />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {search.trim().length >= 2 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Люди</Text>

                {searchingPeople ? (
                  <Text style={[styles.helperText, { color: theme.colors.muted }]}>Поиск...</Text>
                ) : people.length > 0 ? (
                  <View style={{ gap: 10 }}>
                    {people.map((item) => (
                      <GlassCard key={item.uuid}>
                        <View style={styles.personRow}>
                          <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
                            <Text style={styles.avatarText}>
                              {personName(item).slice(0, 1).toUpperCase()}
                            </Text>
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text
                              style={[styles.title, { color: theme.colors.text }]}
                              numberOfLines={1}
                            >
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
                            style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
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

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {activeTab === 'all'
                  ? 'Все чаты'
                  : activeTab === 'pinned'
                    ? 'Закреплённые'
                    : 'Архив'}
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <GlassCard>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              {activeTab === 'archive' ? 'Архив пуст' : 'Чатов пока нет'}
            </Text>
            <Text style={[styles.helperText, { color: theme.colors.muted }]}>
              {activeTab === 'archive'
                ? 'Здесь будут локально и серверно архивированные чаты.'
                : 'Начни диалог через поиск пользователя сверху.'}
            </Text>
          </GlassCard>
        }
        renderItem={({ item }) => {
          const unread = Number(item.unread_count ?? 0) || 0;
          const isStaff = Boolean(item.peer_user?.is_admin || item.peer_user?.is_staff);

          return (
            <Pressable onPress={() => openChat(item)} onLongPress={() => openChatMenu(item)}>
              <GlassCard>
                <View style={styles.chatRow}>
                  <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
                    <Text style={styles.avatarText}>
                      {chatTitle(item).slice(0, 1).toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      <View style={styles.titleInline}>
                        <Text
                          style={[styles.title, { color: theme.colors.text }]}
                          numberOfLines={1}
                        >
                          {chatTitle(item)}
                        </Text>

                        {isStaff ? <Ionicons name="star" size={14} color="#3B82F6" /> : null}

                        {item.effectivePinned ? (
                          <Ionicons name="bookmark" size={14} color={theme.colors.primary} />
                        ) : null}

                        {item.effectiveArchived ? (
                          <Ionicons name="archive" size={14} color={theme.colors.muted} />
                        ) : null}
                      </View>

                      {unread > 0 ? (
                        <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
                          <Text style={styles.badgeText}>{unread}</Text>
                        </View>
                      ) : null}
                    </View>

                    <Text style={[styles.subtitle, { color: theme.colors.muted }]} numberOfLines={1}>
                      {buildPreview(item)}
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
                </View>
              </GlassCard>
            </Pressable>
          );
        }}
      />

      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuVisible(false)} />

          <View style={styles.bottomSheetWrap}>
            <GlassCard>
              <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>
                {selectedChat ? chatTitle(selectedChat) : 'Чат'}
              </Text>

              <Pressable
                onPress={() => void toggleLocalPinned()}
                style={[styles.sheetItem, { borderColor: theme.colors.borderStrong }]}
              >
                <Ionicons
                  name={selectedChat?.localPinned ? 'bookmark' : 'bookmark-outline'}
                  size={18}
                  color={theme.colors.primary}
                />
                <Text style={[styles.sheetItemText, { color: theme.colors.text }]}>
                  {selectedChat?.localPinned
                    ? 'Убрать локальный закреп'
                    : 'Закрепить локально'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => void toggleLocalArchived()}
                style={[styles.sheetItem, { borderColor: theme.colors.borderStrong }]}
              >
                <Ionicons
                  name={selectedChat?.localArchived ? 'archive' : 'archive-outline'}
                  size={18}
                  color={theme.colors.primary}
                />
                <Text style={[styles.sheetItemText, { color: theme.colors.text }]}>
                  {selectedChat?.localArchived
                    ? 'Убрать из локального архива'
                    : 'Архивировать локально'}
                </Text>
              </Pressable>

              {selectedChat ? (
                <Text style={[styles.sheetHint, { color: theme.colors.muted }]}>
                  Долгое нажатие по чату открывает локальные действия. Серверные закреп/архив из
                  настроек самого чата тоже продолжают работать.
                </Text>
              ) : null}
            </GlassCard>
          </View>
        </View>
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
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tabChip: {
    minHeight: 40,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabChipText: {
    fontSize: 13,
    fontWeight: '800',
  },
  tabCountBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCountText: {
    fontSize: 11,
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 10,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  helperText: {
    fontSize: 14,
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8,
  },
  titleInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 13,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  actionBtn: {
    minWidth: 72,
    height: 38,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
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
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 12,
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
    fontSize: 15,
    fontWeight: '700',
  },
  sheetHint: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
});