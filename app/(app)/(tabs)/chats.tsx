import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassCard } from '@/src/components/GlassCard';
import { SearchInput } from '@/src/components/SearchInput';
import { useTheme } from '@/src/theme/ThemeProvider';
import { fetchChats, createDirectChat } from '@/src/lib/api/chats';
import { searchUsers, UserShort } from '@/src/lib/api/contacts';
import type { ChatLastMessage, ChatListItem } from '@/src/types/chat';

function chatTitle(item: ChatListItem) {
  return item.display_title || item.title || 'Без названия';
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
        return '📷 Фото';
      case 'video':
        return '🎬 Видео';
      case 'audio':
        return '🎤 Аудио';
      case 'file':
        return '📎 Файл';
      case 'sticker':
        return '🟡 Стикер';
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

export default function ChatsScreen() {
  const { theme } = useTheme();

  const [data, setData] = useState<ChatListItem[]>([]);
  const [people, setPeople] = useState<UserShort[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchingPeople, setSearchingPeople] = useState(false);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);

  const loadChats = async () => {
    try {
      setRefreshing(true);
      const response = await fetchChats(1, 30);
      setData(response.results ?? []);
    } catch (error) {
      console.error('loadChats error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadChats();
  }, []);

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

  const filteredChats = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;

    return data.filter((item) => {
      const title = chatTitle(item).toLowerCase();
      const lastMessage = searchableLastMessage(item.last_message);
      return title.includes(q) || lastMessage.includes(q);
    });
  }, [data, search]);

  const startDirectChat = async (user: UserShort) => {
    try {
      setCreatingFor(user.uuid);
      const createdChat = await createDirectChat(user.uuid);

      setSearch('');
      await loadChats();

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
      </View>

      <FlatList
        data={filteredChats}
        keyExtractor={(item) => item.uuid}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadChats} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {search.trim().length >= 2 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Люди</Text>

                {searchingPeople ? (
                  <Text style={[styles.helperText, { color: theme.colors.muted }]}>
                    Поиск...
                  </Text>
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
                            <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
                              {personName(item)}
                            </Text>
                            <Text style={[styles.subtitle, { color: theme.colors.muted }]} numberOfLines={1}>
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
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Чаты</Text>
            </View>
          </>
        }
        renderItem={({ item }) => {
          const unread = Number(item.unread_count ?? 0) || 0;

          return (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(app)/chat/[chatUuid]',
                  params: { chatUuid: item.uuid },
                })
              }
            >
              <GlassCard>
                <View style={styles.chatRow}>
                  <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
                    <Text style={styles.avatarText}>
                      {chatTitle(item).slice(0, 1).toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
                        {chatTitle(item)}
                      </Text>

                      {unread > 0 && (
                        <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
                          <Text style={styles.badgeText}>{unread}</Text>
                        </View>
                      )}
                    </View>

                    <Text style={[styles.subtitle, { color: theme.colors.muted }]} numberOfLines={1}>
                      {lastMessageText(item.last_message)}
                    </Text>
                  </View>
                </View>
              </GlassCard>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={[styles.helperText, { color: theme.colors.muted }]}>
            Чаты не найдены
          </Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 12,
  },
  screenTitle: {
    fontSize: 30,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 12,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  helperText: {
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
  },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  badgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  actionBtn: {
    minWidth: 72,
    height: 40,
    borderRadius: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
});