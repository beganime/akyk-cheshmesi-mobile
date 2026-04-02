import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { GlassCard } from '@/src/components/GlassCard';
import { useTheme } from '@/src/theme/ThemeProvider';

export default function AiScreen() {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={theme.colors.heroGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={[styles.heroBadge, { backgroundColor: theme.colors.cardStrong }]}>
          <Ionicons name="sparkles" size={24} color={theme.colors.primary} />
        </View>

        <Text style={[styles.heroTitle, { color: theme.colors.text }]}>Akyl AI</Text>
        <Text style={[styles.heroSubtitle, { color: theme.colors.muted }]}>
          Интеллектуальные функции для чатов и ассистента
        </Text>
      </LinearGradient>

      <GlassCard>
        <View style={styles.cardHead}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: theme.colors.primary,
              },
            ]}
          />
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Скоро будет</Text>
        </View>

        <Text style={[styles.cardText, { color: theme.colors.muted }]}>
          Здесь появятся AI-ответы, умные подсказки, саммари диалогов, перевод, улучшение текста
          и помощник внутри переписки.
        </Text>

        <View style={styles.featureList}>
          <View style={styles.featureRow}>
            <Ionicons name="flash-outline" size={18} color={theme.colors.primary} />
            <Text style={[styles.featureText, { color: theme.colors.text }]}>
              Быстрые AI-действия
            </Text>
          </View>

          <View style={styles.featureRow}>
            <Ionicons name="document-text-outline" size={18} color={theme.colors.primary} />
            <Text style={[styles.featureText, { color: theme.colors.text }]}>
              Краткие выжимки переписки
            </Text>
          </View>

          <View style={styles.featureRow}>
            <Ionicons name="language-outline" size={18} color={theme.colors.primary} />
            <Text style={[styles.featureText, { color: theme.colors.text }]}>
              Перевод и улучшение текста
            </Text>
          </View>

          <View style={styles.featureRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.primary} />
            <Text style={[styles.featureText, { color: theme.colors.text }]}>
              Безопасная работа внутри приложения
            </Text>
          </View>
        </View>
      </GlassCard>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 120,
    gap: 14,
  },
  hero: {
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  heroBadge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 21,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  cardText: {
    fontSize: 15,
    lineHeight: 22,
  },
  featureList: {
    marginTop: 16,
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 15,
    fontWeight: '600',
  },
});