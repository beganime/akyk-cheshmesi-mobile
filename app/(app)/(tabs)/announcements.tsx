import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';

export default function AnnouncementsScreen() {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Новости</Text>

        <View style={[styles.panel, { borderColor: theme.colors.border }]}>
          <View style={styles.newsRow}>
            <View style={[styles.iconBox, { backgroundColor: theme.colors.primarySoft }]}>
              <Ionicons name="newspaper-outline" size={22} color={theme.colors.primary} />
            </View>
            <View style={styles.newsText}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Скоро</Text>
              <Text style={[styles.cardText, { color: theme.colors.muted }]}>
                Здесь будут объявления, новости и системные уведомления.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: 16,
    paddingBottom: 120,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  panel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  newsRow: {
    minHeight: 74,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newsText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 3,
  },
  cardText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
});
