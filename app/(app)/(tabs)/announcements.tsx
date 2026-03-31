import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassCard } from '@/src/components/GlassCard';
import { useTheme } from '@/src/theme/ThemeProvider';

export default function AnnouncementsScreen() {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Объявления</Text>

        <GlassCard>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Скоро</Text>
          <Text style={[styles.cardText, { color: theme.colors.muted }]}>
            Здесь будет раздел объявлений, новостей и системных уведомлений.
          </Text>
        </GlassCard>
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
    fontSize: 30,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 15,
    lineHeight: 22,
  },
});