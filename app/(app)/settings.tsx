import { useEffect, useState } from 'react';
import {
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

const themeModes = [
  'lightOrange',
  'darkOrange',
  'lightGradient',
  'darkGradient',
] as const;

const themeLabels: Record<(typeof themeModes)[number], string> = {
  lightOrange: 'Светлая оранжевая',
  darkOrange: 'Тёмная оранжевая',
  lightGradient: 'Светлая красно-синяя',
  darkGradient: 'Тёмная красно-синяя',
};

const backgroundPresets: ChatBackgroundPreset[] = [
  'theme',
  'plain',
  'midnight',
  'sunset',
  'forest',
];

const backgroundLabels: Record<ChatBackgroundPreset, string> = {
  theme: 'По теме приложения',
  plain: 'Чистый',
  midnight: 'Ночной',
  sunset: 'Закат',
  forest: 'Лес',
};

const bubblePresets: BubblePreset[] = ['default', 'rounded', 'glass', 'soft'];

const bubbleLabels: Record<BubblePreset, string> = {
  default: 'Стандарт',
  rounded: 'Сильно скруглённый',
  glass: 'Стекло',
  soft: 'Мягкий',
};

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

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    getNotificationPrefs()
      .then((prefs) => setPushEnabledState(prefs.pushEnabled))
      .catch(() => undefined);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

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

  // Вспомогательный рендер для пунктов с выбором (галочкой)
  const renderCheckmarkRow = (
    label: string,
    isActive: boolean,
    onPress: () => void,
    isLast: boolean = false
  ) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.actionText, { color: theme.colors.text, fontWeight: isActive ? '700' : '500' }]}>
        {label}
      </Text>
      {isActive && <Ionicons name="checkmark" size={22} color={theme.colors.primary} />}
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.headerButton,
            { backgroundColor: theme.colors.card },
            pressed && { opacity: 0.7 }
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Настройки</Text>

        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* РАЗДЕЛ: АККАУНТ */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>АККАУНТ</Text>
          <GlassCard style={styles.cardOverrides}>
            <View style={styles.actionsContainer}>
              <Pressable
                onPress={() => router.push('/(app)/profile-edit')}
                style={({ pressed }) => [
                  styles.actionRow,
                  { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
                  pressed && { opacity: 0.7 }
                ]}
              >
                <View style={[styles.actionIcon, { backgroundColor: theme.colors.primarySoft }]}>
                  <Ionicons name="person-outline" size={18} color={theme.colors.primary} />
                </View>
                <Text style={[styles.actionText, { color: theme.colors.text }]}>Редактировать профиль</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
              </Pressable>

              <Pressable
                onPress={() => router.push('/(app)/blocked-users')}
                style={({ pressed }) => [
                  styles.actionRow,
                  pressed && { opacity: 0.7 }
                ]}
              >
                <View style={[styles.actionIcon, { backgroundColor: 'rgba(229, 72, 77, 0.1)' }]}>
                  <Ionicons name="ban-outline" size={18} color={theme.colors.danger} />
                </View>
                <Text style={[styles.actionText, { color: theme.colors.text }]}>Черный список</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
              </Pressable>
            </View>
          </GlassCard>
        </View>

        {/* РАЗДЕЛ: ТЕМА */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>ОФОРМЛЕНИЕ ПРИЛОЖЕНИЯ</Text>
          <GlassCard style={styles.cardOverrides}>
            <View style={styles.actionsContainer}>
              {themeModes.map((mode, index) =>
                renderCheckmarkRow(
                  themeLabels[mode],
                  themeName === mode,
                  () => void setThemeName(mode),
                  index === themeModes.length - 1
                )
              )}
            </View>
          </GlassCard>
        </View>

        {/* РАЗДЕЛ: ОФОРМЛЕНИЕ ЧАТА */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>ОФОРМЛЕНИЕ ЧАТА</Text>
          
          <GlassCard style={[styles.cardOverrides, { marginBottom: 16 }]}>
            <Text style={[styles.subTitle, { color: theme.colors.primary }]}>Фон чата</Text>
            <View style={styles.actionsContainer}>
              {backgroundPresets.map((preset, index) =>
                renderCheckmarkRow(
                  backgroundLabels[preset],
                  appearance.backgroundPreset === preset,
                  () => void patchAppearance({ backgroundPreset: preset }),
                  index === backgroundPresets.length - 1
                )
              )}
            </View>
          </GlassCard>

          <GlassCard style={[styles.cardOverrides, { marginBottom: 16 }]}>
            <Text style={[styles.subTitle, { color: theme.colors.primary }]}>Мои сообщения</Text>
            <View style={styles.actionsContainer}>
              {bubblePresets.map((preset, index) =>
                renderCheckmarkRow(
                  bubbleLabels[preset],
                  appearance.ownBubblePreset === preset,
                  () => void patchAppearance({ ownBubblePreset: preset }),
                  index === bubblePresets.length - 1
                )
              )}
            </View>
          </GlassCard>

          <GlassCard style={[styles.cardOverrides, { marginBottom: 16 }]}>
            <Text style={[styles.subTitle, { color: theme.colors.primary }]}>Сообщения собеседника</Text>
            <View style={styles.actionsContainer}>
              {bubblePresets.map((preset, index) =>
                renderCheckmarkRow(
                  bubbleLabels[preset],
                  appearance.peerBubblePreset === preset,
                  () => void patchAppearance({ peerBubblePreset: preset }),
                  index === bubblePresets.length - 1
                )
              )}
            </View>
          </GlassCard>

          {/* ПРЕВЬЮ ЧАТА */}
          <Text style={[styles.sectionTitle, { color: theme.colors.muted, marginTop: 4 }]}>ПРЕВЬЮ</Text>
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
              <Text style={{ color: theme.colors.text, fontSize: 14 }}>Привет 👋</Text>
            </View>

            <View
              style={[
                styles.previewBubble,
                styles.previewOwnBubble,
                buildBubblePreviewStyle(theme, appearance.ownBubblePreset, true),
              ]}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 14 }}>Вот так будет выглядеть чат</Text>
            </View>
          </View>
        </View>

        {/* РАЗДЕЛ: УВЕДОМЛЕНИЯ */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>НАСТРОЙКИ УСТРОЙСТВА</Text>
          <GlassCard style={styles.cardOverrides}>
            <View style={styles.actionsContainer}>
              <View style={styles.actionRow}>
                <View style={[styles.actionIcon, { backgroundColor: theme.colors.primarySoft }]}>
                  <Ionicons name="notifications-outline" size={18} color={theme.colors.primary} />
                </View>
                <Text style={[styles.actionText, { color: theme.colors.text }]}>Push-уведомления</Text>
                <Switch 
                  value={pushEnabled} 
                  onValueChange={(value) => void handleTogglePush(value)} 
                  trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
                />
              </View>
            </View>
          </GlassCard>
        </View>

        {/* РАЗДЕЛ: ДОПОЛНИТЕЛЬНО */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>ДОПОЛНИТЕЛЬНО</Text>
          <GlassCard style={styles.cardOverrides}>
            <View style={styles.actionsContainer}>
              <View style={[styles.actionRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border }]}>
                <View style={[styles.actionIcon, { backgroundColor: theme.colors.primarySoft }]}>
                  <Ionicons name="chatbox-ellipses-outline" size={18} color={theme.colors.primary} />
                </View>
                <Text style={[styles.actionText, { color: theme.colors.text }]}>Внутриигровые уведомления</Text>
                <Text style={[styles.soonText, { color: theme.colors.muted }]}>Скоро</Text>
              </View>

              <View style={styles.actionRow}>
                <View style={[styles.actionIcon, { backgroundColor: theme.colors.primarySoft }]}>
                  <Ionicons name="folder-outline" size={18} color={theme.colors.primary} />
                </View>
                <Text style={[styles.actionText, { color: theme.colors.text }]}>Данные и память</Text>
                <Text style={[styles.soonText, { color: theme.colors.muted }]}>Скоро</Text>
              </View>
            </View>
          </GlassCard>
        </View>

        {/* КНОПКА ВЫХОДА */}
        <View style={[styles.section, { marginTop: 10 }]}>
          <GlassCard style={styles.cardOverrides}>
            <Pressable
              onPress={() => void handleLogout()}
              style={({ pressed }) => [
                styles.actionRow,
                { justifyContent: 'center' },
                pressed && { opacity: 0.7 }
              ]}
            >
              <Text style={[styles.logoutText, { color: theme.colors.danger }]}>Выйти из аккаунта</Text>
            </Pressable>
          </GlassCard>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    paddingTop: 10,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 12,
  },
  cardOverrides: {
    padding: 0, // Убираем внутренний паддинг карточки, чтобы элементы касались краев
    overflow: 'hidden',
  },
  subTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 4,
    marginLeft: 16,
  },
  actionsContainer: {
    width: '100%',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 54,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  soonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
  previewWrap: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    overflow: 'hidden',
  },
  previewBubble: {
    maxWidth: '85%',
    minHeight: 42,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  previewOwnBubble: {
    alignSelf: 'flex-end',
  },
});