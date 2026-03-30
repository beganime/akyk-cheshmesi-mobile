import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '@/src/components/GlassCard';
import { useTheme } from '@/src/theme/ThemeProvider';
import { apiClient } from '@/src/lib/api/client';

type Chat = {
  uuid: string;
  display_title?: string;
  last_message?: string;
  unread_count?: number | string;
};

export default function ChatsScreen() {
  const { theme } = useTheme();
  const [data, setData] = useState<Chat[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadChats = async () => {
    setRefreshing(true);
    try {
      const response = await apiClient.get('/chats/?page=1&page_size=20');
      setData(response.data?.results ?? []);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadChats();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.uuid}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadChats} />}
        renderItem={({ item }) => (
          <GlassCard>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {item.display_title || 'Без названия'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
              {item.last_message || 'Нет сообщений'}
            </Text>
          </GlassCard>
        )}
        ListEmptyComponent={
          <Text style={{ color: theme.colors.muted, textAlign: 'center', marginTop: 40 }}>
            Чаты пока не загружены
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14 },
});
