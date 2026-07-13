import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';

const APP_SITE = 'https://akyl-cheshmesi.ru';

export default function AboutScreen() {
  const { theme } = useTheme();
  const version = Constants.expoConfig?.version || '1.0.7';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}> 
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={25} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>О приложении</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.logo, { backgroundColor: theme.colors.primary }]}> 
          <Ionicons name="chatbubbles" size={42} color={theme.colors.fabText} />
        </View>
        <Text style={[styles.appName, { color: theme.colors.text }]}>Akyl Çeşmesi</Text>
        <Text style={[styles.version, { color: theme.colors.muted }]}>Версия {version}</Text>

        <Text style={[styles.description, { color: theme.colors.text }]}> 
          Мессенджер для личного общения, групп, историй, голосовых сообщений и звонков.
        </Text>

        <View style={[styles.infoList, { borderColor: theme.colors.border }]}> 
          <InfoRow icon="shield-checkmark-outline" title="Безопасная авторизация" text="Access и refresh токены хранятся локально и обновляются автоматически." />
          <InfoRow icon="notifications-outline" title="Уведомления" text="Новые сообщения и входящие звонки используют отдельные системные каналы." />
          <InfoRow icon="color-palette-outline" title="Оформление" text="Шесть светлых и тёмных цветовых тем с системными отступами Android и iOS." />
        </View>

        <Pressable
          onPress={() => void Linking.openURL(APP_SITE)}
          style={({ pressed }) => [
            styles.siteRow,
            {
              borderColor: theme.colors.border,
              backgroundColor: pressed ? theme.colors.backgroundSecondary : 'transparent',
            },
          ]}
        >
          <Ionicons name="globe-outline" size={21} color={theme.colors.primary} />
          <Text style={[styles.siteText, { color: theme.colors.text }]}>akyl-cheshmesi.ru</Text>
          <Ionicons name="open-outline" size={18} color={theme.colors.muted} />
        </Pressable>

        <Text style={[styles.copyright, { color: theme.colors.muted }]}>© 2026 Akyl Çeşmesi</Text>
      </ScrollView>
    </SafeAreaView>
  );

  function InfoRow({ icon, title, text }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }) {
    return (
      <View style={[styles.infoRow, { borderBottomColor: theme.colors.border }]}> 
        <View style={[styles.infoIcon, { backgroundColor: theme.colors.primarySoft }]}> 
          <Ionicons name={icon} size={20} color={theme.colors.primary} />
        </View>
        <View style={styles.infoTextWrap}>
          <Text style={[styles.infoTitle, { color: theme.colors.text }]}>{title}</Text>
          <Text style={[styles.infoText, { color: theme.colors.muted }]}>{text}</Text>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { minHeight: 56, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { paddingHorizontal: 20, paddingTop: 30, paddingBottom: 40, alignItems: 'center' },
  logo: { width: 88, height: 88, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  appName: { marginTop: 16, fontSize: 28, fontWeight: '700' },
  version: { marginTop: 4, fontSize: 13, fontWeight: '600' },
  description: { maxWidth: 420, marginTop: 18, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  infoList: { width: '100%', marginTop: 28, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  infoRow: { minHeight: 78, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  infoTextWrap: { flex: 1 },
  infoTitle: { fontSize: 15, fontWeight: '700' },
  infoText: { marginTop: 3, fontSize: 13, lineHeight: 18 },
  siteRow: { width: '100%', minHeight: 54, marginTop: 18, paddingHorizontal: 14, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 11 },
  siteText: { flex: 1, fontSize: 15, fontWeight: '700' },
  copyright: { marginTop: 28, fontSize: 12 },
});
