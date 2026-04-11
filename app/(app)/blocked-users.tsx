import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { GlassCard } from '@/src/components/GlassCard';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getBlockedUsers, unblockUserLocal } from '@/src/lib/local/blockedUsers';

export default function BlockedUsersScreen() {
  const { theme } = useTheme();
  const [items, setItems] = useState<string[]>([]);

  const loadItems = useCallback(async () => {
    const data = await getBlockedUsers();
    setItems(data);
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.headerButton, { borderColor: theme.colors.border }]}
        >
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Черный список</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>
        {items.length === 0 ? (
          <GlassCard>
            <Text style={[styles.empty, { color: theme.colors.muted }]}>Список пуст</Text>
          </GlassCard>
        ) : (
          items.map((uuid) => (
            <GlassCard key={uuid}>
              <View style={styles.row}>
                <Text style={[styles.uuidText, { color: theme.colors.text }]} numberOfLines={1}>
                  {uuid}
                </Text>
                <Pressable
                  onPress={() => {
                    void unblockUserLocal(uuid).then(loadItems);
                  }}
                  style={[styles.unblockBtn, { backgroundColor: theme.colors.primary }]}
                >
                  <Text style={styles.unblockText}>Разблокировать</Text>
                </Pressable>
              </View>
            </GlassCard>
          ))
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { padding: 16, gap: 10 },
  empty: { fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  uuidText: { flex: 1, fontSize: 13, fontWeight: '600' },
  unblockBtn: {
    height: 34,
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unblockText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
