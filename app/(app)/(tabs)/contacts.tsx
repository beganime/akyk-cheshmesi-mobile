import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Pressable,
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
import { useAuthStore } from '@/src/state/auth';
import type { ChatListItem, ChatMember } from '@/src/types/chat';

type ContactUser = {
  uuid: string;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  avatar?: string | null;
  is_admin?: boolean;
  is_staff?: boolean;
};

type ContactItem = {
  key: string;
  user_uuid: string;
  chat_uuid: string | null;
  source_chat_uuid: string | null;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  avatar?: string | null;
  is_admin?: boolean;
  is_staff?: boolean;
};

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
    first_name: user.first_name ?? null,
    last_name: user.last_name ?? null,
    full_name: user.full_name ?? null,
    avatar: user.avatar ?? null,
    is_admin: Boolean(user.is_admin),
    is_staff: Boolean(user.is_staff),
  };
}

function buildContactsFromChats(chats: ChatListItem[], currentUserUuid?: string | null): ContactItem[] {
  const map = new Map<string, ContactItem>();

  const upsert = (user: ContactUser, options: { chatUuid?: string | null; sourceChatUuid?: string | null }) => {
    if (!user?.uuid || user.uuid === currentUserUuid) {
      return;
    }

    const existing = map.get(user.uuid);

    const nextValue: ContactItem = {
      key: user.uuid,
      user_uuid: user.uuid,
      chat_uuid: existing?.chat_uuid || options.chatUuid || null,
      source_chat_uuid: existing?.source_chat_uuid || options.sourceChatUuid || null,
      username: user.username ?? existing?.username ?? null,
      email: user.email ?? existing?.email ?? null,
      phone: user.phone ?? existing?.phone ?? null,
      first_name: user.first_name ?? existing?.first_name ?? null,
      last_name: user.last_name ?? existing?.last_name ?? null,
      full_name: user.full_name ?? existing?.full_name ?? null,
      avatar: user.avatar ?? existing?.avatar ?? null,
      is_admin: Boolean(user.is_admin || existing?.is_admin),
      is_staff: Boolean(user.is_staff || existing?.is_staff),
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
          first_name: directPeer.first_name ?? null,
          last_name: directPeer.last_name ?? null,
          full_name: directPeer.full_name ?? null,
          avatar: directPeer.avatar ?? null,
          is_admin: Boolean(directPeer.is_admin),
          is_staff: Boolean(directPeer.is_staff),
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

export default function ContactsScreen() {
  const { theme } = useTheme();
  const currentUserUuid = useAuthStore((s) => s.user?.uuid);

  const [items, setItems] = useState<ContactItem[]>([]);
  const [expandedUuid, setExpandedUuid] = useState<string | null>(null);
  const [openingUuid, setOpeningUuid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadContacts = useCallback(async () => {
    try {
      const response = await fetchChats(1, 100);
      const chats = Array.isArray(response?.results) ? response.results : [];
      const contacts = buildContactsFromChats(chats, currentUserUuid);
      setItems(contacts);
    } catch (error) {
      console.error('loadContacts error:', error);
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
      const phone = String(item.phone || '').toLowerCase();

      return (
        name.includes(q) ||
        username.includes(q) ||
        email.includes(q) ||
        phone.includes(q)
      );
    });
  }, [items, search]);

  const openContactChat = async (item: ContactItem) => {
    try {
      setOpeningUuid(item.user_uuid);

      if (item.chat_uuid) {
        router.push({
          pathname: '/(app)/chat/[chatUuid]',
          params: { chatUuid: item.chat_uuid },
        });
        return;
      }

      const createdChat = await createDirectChat(item.user_uuid);

      if (createdChat?.uuid) {
        router.push({
          pathname: '/(app)/chat/[chatUuid]',
          params: { chatUuid: createdChat.uuid },
        });
      }
    } catch (error) {
      console.error('openContactChat error:', error);
    } finally {
      setOpeningUuid(null);
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
        <Text style={[styles.screenTitle, { color: theme.colors.text }]}>Контакты</Text>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Поиск по имени, почте, телефону"
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
        renderItem={({ item }) => {
          const isExpanded = expandedUuid === item.user_uuid;
          const name = fullName(item);
          const isStaff = Boolean(item.is_admin || item.is_staff);

          return (
            <Pressable
              onPress={() =>
                setExpandedUuid((current) => (current === item.user_uuid ? null : item.user_uuid))
              }
            >
              <GlassCard>
                <View style={styles.row}>
                  <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
                    <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
                          {name}
                        </Text>

                        {isStaff ? <Ionicons name="star" size={14} color="#3B82F6" /> : null}
                      </View>

                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={theme.colors.muted}
                      />
                    </View>

                    <Text style={[styles.username, { color: theme.colors.muted }]} numberOfLines={1}>
                      @{item.username || 'user'}
                    </Text>

                    {isExpanded ? (
                      <View style={styles.details}>
                        <Text style={[styles.detailText, { color: theme.colors.text }]}>
                          ФИО: {name}
                        </Text>
                        <Text style={[styles.detailText, { color: theme.colors.text }]}>
                          Почта: {item.email || 'Не указана'}
                        </Text>
                        <Text style={[styles.detailText, { color: theme.colors.text }]}>
                          Номер: {item.phone || 'Не указан'}
                        </Text>
                        <Text style={[styles.detailText, { color: theme.colors.text }]}>
                          Статус: {isStaff ? 'Персонал' : 'Пользователь'}
                        </Text>

                        <Pressable
                          onPress={() => void openContactChat(item)}
                          disabled={openingUuid === item.user_uuid}
                          style={[styles.openChatBtn, { backgroundColor: theme.colors.primary }]}
                        >
                          <Text style={styles.openChatText}>
                            {openingUuid === item.user_uuid ? 'Открытие...' : 'Открыть чат'}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </View>
              </GlassCard>
            </Pressable>
          );
        }}
      />
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
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  username: {
    fontSize: 13,
  },
  details: {
    marginTop: 12,
    gap: 6,
  },
  detailText: {
    fontSize: 14,
  },
  openChatBtn: {
    marginTop: 10,
    height: 40,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  openChatText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 14,
  },
});