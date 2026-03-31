import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassCard } from '@/src/components/GlassCard';
import { SearchInput } from '@/src/components/SearchInput';
import { useTheme } from '@/src/theme/ThemeProvider';
import { searchUsers, UserShort } from '@/src/lib/api/contacts';
import { createDirectChat } from '@/src/lib/api/chats';

function displayName(item: UserShort) {
  return (
    item.full_name ||
    [item.first_name, item.last_name].filter(Boolean).join(' ') ||
    item.username ||
    item.email ||
    'Без имени'
  );
}

export default function ContactsScreen() {
  const { theme } = useTheme();
  const [search, setSearch] = useState('');
  const [data, setData] = useState<UserShort[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingId, setCreatingId] = useState<string | null>(null);

  useEffect(() => {
    const q = search.trim();

    if (q.length < 2) {
      setData([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const results = await searchUsers(q);
        setData(results);
      } catch (error) {
        console.error('searchUsers error:', error);
        setData([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [search]);

  const startChat = async (user: UserShort) => {
    try {
      setCreatingId(user.uuid);
      const createdChat = await createDirectChat(user.uuid);

      if (createdChat?.uuid) {
        router.push({
          pathname: '/(app)/chat/[chatUuid]',
          params: { chatUuid: createdChat.uuid },
        });
      }
    } catch (error) {
      console.error('createDirectChat error:', error);
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.screenTitle, { color: theme.colors.text }]}>Контакты</Text>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Найти человека"
        />
      </View>

      {search.trim().length < 2 ? (
        <View style={styles.centered}>
          <Text style={[styles.hint, { color: theme.colors.muted }]}>
            Введите минимум 2 символа
          </Text>
        </View>
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.uuid}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <GlassCard>
              <View style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.avatarText}>
                    {displayName(item).slice(0, 1).toUpperCase()}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
                    {displayName(item)}
                  </Text>
                  <Text style={[styles.meta, { color: theme.colors.muted }]} numberOfLines={1}>
                    @{item.username || 'user'}
                  </Text>
                </View>

                <Pressable
                  onPress={() => void startChat(item)}
                  disabled={creatingId === item.uuid}
                  style={[styles.btn, { backgroundColor: theme.colors.primary }]}
                >
                  <Text style={styles.btnText}>
                    {creatingId === item.uuid ? '...' : 'Чат'}
                  </Text>
                </Pressable>
              </View>
            </GlassCard>
          )}
          ListEmptyComponent={
            <Text style={[styles.hint, { color: theme.colors.muted }]}>
              Ничего не найдено
            </Text>
          }
        />
      )}
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 12,
  },
  row: {
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
  name: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  meta: {
    fontSize: 14,
  },
  btn: {
    minWidth: 72,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
  },
});