import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';

type SettingsSection =
  | 'language'
  | 'bots'
  | 'devices'
  | 'storage'
  | 'notifications'
  | 'chat'
  | 'appearance'
  | 'privacy'
  | 'security';

const sections: {
  key: SettingsSection;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    key: 'language',
    title: 'Язык',
    subtitle: 'Русский по умолчанию',
    icon: 'language-outline',
  },
  {
    key: 'bots',
    title: 'Боты',
    subtitle: 'Telegram-like bots',
    icon: 'sparkles-outline',
  },
  {
    key: 'devices',
    title: 'Управление устройствами',
    subtitle: 'Активные сессии и текущее устройство',
    icon: 'phone-portrait-outline',
  },
  {
    key: 'storage',
    title: 'Хранилище',
    subtitle: 'Кэш, изображения, аватарки и медиа',
    icon: 'file-tray-full-outline',
  },
  {
    key: 'notifications',
    title: 'Уведомления',
    subtitle: 'Push, звук, вибрация и превью',
    icon: 'notifications-outline',
  },
  {
    key: 'chat',
    title: 'Настройки чата',
    subtitle: 'Размер текста, фон и автозагрузка',
    icon: 'chatbubble-ellipses-outline',
  },
  {
    key: 'appearance',
    title: 'Внешний вид',
    subtitle: 'Темы и цветовые стили',
    icon: 'color-palette-outline',
  },
  {
    key: 'privacy',
    title: 'Конфиденциальность',
    subtitle: 'Статус, сообщения и заблокированные',
    icon: 'lock-closed-outline',
  },
  {
    key: 'security',
    title: 'Безопасность аккаунта',
    subtitle: 'Пароль, 2FA и активные сессии',
    icon: 'shield-checkmark-outline',
  },
];

export default function SettingsScreen() {
  const { theme } = useTheme();

  const openSection = (section: SettingsSection) => {
    if (section === 'bots') {
      router.push('/(app)/bots');
      return;
    }

    router.push({
      pathname: '/(app)/settings/[section]',
      params: { section },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Настройки</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.list, { borderColor: theme.colors.border }]}>
          {sections.map((section, index) => (
            <Pressable
              key={section.key}
              onPress={() => openSection(section.key)}
              style={({ pressed }) => [
                styles.row,
                {
                  borderBottomColor: theme.colors.border,
                  borderBottomWidth:
                    index === sections.length - 1 ? 0 : StyleSheet.hairlineWidth,
                  backgroundColor: pressed
                    ? theme.colors.backgroundSecondary
                    : 'transparent',
                },
              ]}
            >
              <View style={[styles.rowIcon, { backgroundColor: theme.colors.primarySoft }]}>
                <Ionicons name={section.icon} size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: theme.colors.text }]}>
                  {section.title}
                </Text>
                <Text style={[styles.rowSub, { color: theme.colors.muted }]} numberOfLines={1}>
                  {section.subtitle}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={19} color={theme.colors.muted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    minHeight: 58,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
  },
  content: {
    paddingTop: 14,
    paddingBottom: 120,
  },
  list: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    minHeight: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  rowSub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
  },
});
