import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { GlassCard } from '@/src/components/GlassCard';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuthStore } from '@/src/state/auth';
import {
  registerNativePushToken,
  unregisterCurrentPushToken,
} from '@/src/lib/push/register';
import {
  DEFAULT_CHAT_APPEARANCE,
  type BubblePreset,
  type ChatAppearance,
  type ChatBackgroundPreset,
  buildBubblePreviewStyle,
  buildChatBackgroundStyle,
  loadChatAppearance,
  saveChatAppearance,
} from '@/src/lib/chatAppearance';
import { getNotificationPrefs, setPushEnabled } from '@/src/lib/local/notificationPrefs';

const themeModes = ['lightGradient', 'darkGradient'] as const;
const themeLabels: Record<(typeof themeModes)[number], string> = {
  lightGradient: 'Дневной режим',
  darkGradient: 'Ночной режим',
};

const backgroundPresets: ChatBackgroundPreset[] = ['theme', 'plain', 'midnight', 'forest'];
const backgroundLabels: Record<ChatBackgroundPreset, string> = {
  theme: 'Как в приложении',
  plain: 'Чистый',
  midnight: 'Ночной',
  sunset: 'Закат',
  forest: 'Зелёный',
};

const bubblePresets: BubblePreset[] = ['default', 'rounded', 'glass', 'soft'];
const bubbleLabels: Record<BubblePreset, string> = {
  default: 'Telegram',
  rounded: 'Круглее',
  glass: 'Стекло',
  soft: 'Мягкий',
};

function showApiNote(title: string) {
  Alert.alert(
    title,
    'Экран готов, но для серверной синхронизации нужен endpoint. Записал это в docs/mobile_api_required.md.',
  );
}

export default function SettingsScreen() {
  const { theme, themeName, setThemeName } = useTheme();
  const logout = useAuthStore((s) => s.logout);

  const [appearance, setAppearance] = useState<ChatAppearance>(DEFAULT_CHAT_APPEARANCE);
  const [pushEnabled, setPushEnabledState] = useState(true);

  useEffect(() => {
    let mounted = true;

    loadChatAppearance()
      .then((value) => {
        if (mounted) {
          setAppearance(value);
        }
      })
      .catch(() => undefined);

    getNotificationPrefs()
      .then((prefs) => setPushEnabledState(prefs.pushEnabled))
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  const patchAppearance = async (patch: Partial<ChatAppearance>) => {
    const nextValue = {
      ...appearance,
      ...patch,
    };

    setAppearance(nextValue);
    await saveChatAppearance(nextValue);
  };

  const handleTogglePush = async (value: boolean) => {
    setPushEnabledState(value);
    await setPushEnabled(value);
    if (value) {
      await registerNativePushToken();
    } else {
      await unregisterCurrentPushToken();
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const renderOption = (
    label: string,
    active: boolean,
    onPress: () => void,
    isLast = false,
  ) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.border,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.rowText, { color: theme.colors.text }]}>{label}</Text>
      {active ? <Ionicons name="checkmark" size={22} color={theme.colors.primary} /> : null}
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.headerButton, { backgroundColor: theme.colors.cardStrong }]}
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Настройки</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>Аккаунт</Text>
          <GlassCard style={styles.card}>
            <Pressable
              onPress={() => router.push('/(app)/profile-edit')}
              style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border }]}
            >
              <Ionicons name="person-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.rowText, { color: theme.colors.text }]}>Редактировать профиль</Text>
              <Ionicons name="chevron-forward" size={19} color={theme.colors.muted} />
            </Pressable>
            <Pressable onPress={() => router.push('/(app)/blocked-users')} style={styles.row}>
              <Ionicons name="ban-outline" size={20} color={theme.colors.danger} />
              <Text style={[styles.rowText, { color: theme.colors.text }]}>Чёрный список</Text>
              <Ionicons name="chevron-forward" size={19} color={theme.colors.muted} />
            </Pressable>
          </GlassCard>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>Тема</Text>
          <GlassCard style={styles.card}>
            {themeModes.map((mode, index) =>
              renderOption(
                themeLabels[mode],
                themeName === mode,
                () => void setThemeName(mode),
                index === themeModes.length - 1,
              ),
            )}
          </GlassCard>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>Чаты</Text>
          <GlassCard style={[styles.card, styles.previewCard]}>
            <View
              style={[
                styles.previewWrap,
                {
                  ...buildChatBackgroundStyle(theme, appearance),
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.previewBubble,
                  buildBubblePreviewStyle(theme, appearance.peerBubblePreset, false),
                ]}
              >
                <Text style={{ color: theme.colors.text }}>Привет</Text>
              </View>
              <View
                style={[
                  styles.previewBubble,
                  styles.previewOwnBubble,
                  buildBubblePreviewStyle(theme, appearance.ownBubblePreset, true),
                ]}
              >
                <Text style={{ color: '#FFFFFF' }}>Выглядит аккуратно</Text>
              </View>
            </View>

            <Text style={[styles.subTitle, { color: theme.colors.muted }]}>Фон</Text>
            {backgroundPresets.map((preset, index) =>
              renderOption(
                backgroundLabels[preset],
                appearance.backgroundPreset === preset,
                () => void patchAppearance({ backgroundPreset: preset }),
                index === backgroundPresets.length - 1,
              ),
            )}

            <Text style={[styles.subTitle, { color: theme.colors.muted }]}>Мои сообщения</Text>
            {bubblePresets.map((preset, index) =>
              renderOption(
                bubbleLabels[preset],
                appearance.ownBubblePreset === preset,
                () => void patchAppearance({ ownBubblePreset: preset }),
                index === bubblePresets.length - 1,
              ),
            )}
          </GlassCard>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>Уведомления и устройство</Text>
          <GlassCard style={styles.card}>
            <View style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border }]}>
              <Ionicons name="notifications-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.rowText, { color: theme.colors.text }]}>Push-уведомления</Text>
              <Switch
                value={pushEnabled}
                onValueChange={(value) => void handleTogglePush(value)}
                trackColor={{ true: theme.colors.primary, false: theme.colors.borderStrong }}
              />
            </View>
            <Pressable
              onPress={() => showApiNote('Управление устройствами')}
              style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border }]}
            >
              <Ionicons name="phone-portrait-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.rowText, { color: theme.colors.text }]}>Управление устройствами</Text>
              <Text style={[styles.soonText, { color: theme.colors.muted }]}>API нужен</Text>
            </Pressable>
            <Pressable onPress={() => showApiNote('Хранилище')} style={styles.row}>
              <Ionicons name="file-tray-full-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.rowText, { color: theme.colors.text }]}>Хранилище</Text>
              <Text style={[styles.soonText, { color: theme.colors.muted }]}>API нужен</Text>
            </Pressable>
          </GlassCard>
        </View>

        <Pressable onPress={() => void handleLogout()} style={[styles.logout, { backgroundColor: theme.colors.cardStrong }]}>
          <Text style={[styles.logoutText, { color: theme.colors.danger }]}>Выйти из аккаунта</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 42,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 96,
    gap: 18,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    marginLeft: 12,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  previewCard: {
    paddingTop: 12,
  },
  row: {
    minHeight: 54,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  soonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  subTitle: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  previewWrap: {
    minHeight: 150,
    marginHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    overflow: 'hidden',
  },
  previewBubble: {
    maxWidth: '82%',
    minHeight: 40,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  previewOwnBubble: {
    alignSelf: 'flex-end',
  },
  logout: {
    minHeight: 54,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '800',
  },
});
