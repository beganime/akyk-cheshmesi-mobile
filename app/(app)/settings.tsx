import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
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
  DEFAULT_CHAT_APPEARANCE,
  type BubblePreset,
  type ChatAppearance,
  type ChatBackgroundPreset,
  buildBubblePreviewStyle,
  buildChatBackgroundStyle,
  loadChatAppearance,
  saveChatAppearance,
} from '@/src/lib/chatAppearance';

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

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
        },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.headerButton, { borderColor: theme.colors.border }]}
        >
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Настройки</Text>

        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <GlassCard>
          <Text style={[styles.groupTitle, { color: theme.colors.text }]}>Аккаунт</Text>

          <Pressable
            onPress={() => router.push('/(app)/profile-edit')}
            style={[styles.rowItem, { borderColor: theme.colors.border }]}
          >
            <Text style={[styles.rowText, { color: theme.colors.text }]}>Редактировать профиль</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
          </Pressable>

          <Pressable
            onPress={() => router.push('/(app)/blocked-users')}
            style={[styles.rowItem, { borderColor: theme.colors.border }]}
          >
            <Text style={[styles.rowText, { color: theme.colors.text }]}>Черный список</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
          </Pressable>
        </GlassCard>

        <GlassCard>
          <Text style={[styles.groupTitle, { color: theme.colors.text }]}>Оформление приложения</Text>

          {themeModes.map((mode) => {
            const active = themeName === mode;

            return (
              <Pressable
                key={mode}
                onPress={() => void setThemeName(mode)}
                style={[
                  styles.optionItem,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: active ? theme.colors.primary : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    {
                      color: active ? '#FFFFFF' : theme.colors.text,
                    },
                  ]}
                >
                  {themeLabels[mode]}
                </Text>
              </Pressable>
            );
          })}
        </GlassCard>

        <GlassCard>
          <Text style={[styles.groupTitle, { color: theme.colors.text }]}>Оформление чата</Text>

          <Text style={[styles.subTitle, { color: theme.colors.muted }]}>Фон чата</Text>
          {backgroundPresets.map((preset) => {
            const active = appearance.backgroundPreset === preset;

            return (
              <Pressable
                key={preset}
                onPress={() => void patchAppearance({ backgroundPreset: preset })}
                style={[
                  styles.optionItem,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: active ? theme.colors.primary : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    {
                      color: active ? '#FFFFFF' : theme.colors.text,
                    },
                  ]}
                >
                  {backgroundLabels[preset]}
                </Text>
              </Pressable>
            );
          })}

          <Text style={[styles.subTitle, { color: theme.colors.muted }]}>Мои сообщения</Text>
          {bubblePresets.map((preset) => {
            const active = appearance.ownBubblePreset === preset;

            return (
              <Pressable
                key={`own-${preset}`}
                onPress={() => void patchAppearance({ ownBubblePreset: preset })}
                style={[
                  styles.optionItem,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: active ? theme.colors.primary : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    {
                      color: active ? '#FFFFFF' : theme.colors.text,
                    },
                  ]}
                >
                  {bubbleLabels[preset]}
                </Text>
              </Pressable>
            );
          })}

          <Text style={[styles.subTitle, { color: theme.colors.muted }]}>Сообщения собеседника</Text>
          {bubblePresets.map((preset) => {
            const active = appearance.peerBubblePreset === preset;

            return (
              <Pressable
                key={`peer-${preset}`}
                onPress={() => void patchAppearance({ peerBubblePreset: preset })}
                style={[
                  styles.optionItem,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: active ? theme.colors.primary : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    {
                      color: active ? '#FFFFFF' : theme.colors.text,
                    },
                  ]}
                >
                  {bubbleLabels[preset]}
                </Text>
              </Pressable>
            );
          })}

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
              <Text style={{ color: theme.colors.text, fontSize: 13 }}>Привет 👋</Text>
            </View>

            <View
              style={[
                styles.previewBubble,
                styles.previewOwnBubble,
                buildBubblePreviewStyle(theme, appearance.ownBubblePreset, true),
              ]}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 13 }}>Вот так будет выглядеть чат</Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard>
          <Text style={[styles.groupTitle, { color: theme.colors.text }]}>Приложение</Text>

          <View style={[styles.rowItem, { borderColor: theme.colors.border }]}>
            <Text style={[styles.rowText, { color: theme.colors.text }]}>Уведомления</Text>
            <Text style={[styles.soonText, { color: theme.colors.muted }]}>Следующий этап</Text>
          </View>

          <View style={[styles.rowItem, { borderColor: theme.colors.border }]}>
            <Text style={[styles.rowText, { color: theme.colors.text }]}>Медиа и кэш</Text>
            <Text style={[styles.soonText, { color: theme.colors.muted }]}>Следующий этап</Text>
          </View>
        </GlassCard>

        <Pressable
          onPress={() => void handleLogout()}
          style={[styles.logoutButton, { backgroundColor: theme.colors.primary }]}
        >
          <Text style={styles.logoutText}>Выйти</Text>
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
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    paddingBottom: 120,
    gap: 12,
  },
  groupTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  subTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 8,
  },
  rowItem: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: {
    fontSize: 15,
    fontWeight: '600',
  },
  optionItem: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  previewWrap: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    marginTop: 8,
    gap: 10,
  },
  previewBubble: {
    maxWidth: '82%',
    minHeight: 42,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  previewOwnBubble: {
    alignSelf: 'flex-end',
  },
  soonText: {
    fontSize: 13,
  },
  logoutButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
