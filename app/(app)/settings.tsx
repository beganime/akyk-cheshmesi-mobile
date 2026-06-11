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
import { useTheme, type ThemeMode } from '@/src/theme/ThemeProvider';
import { useAuthStore } from '@/src/state/auth';
import {
  registerNativePushToken,
  unregisterCurrentPushToken,
} from '@/src/lib/push/register';
import {
  DEFAULT_CHAT_APPEARANCE,
  type CardRadiusPreset,
  type ChatAppearance,
  type ChatBackgroundPreset,
  type MessageSizePreset,
  type TextSizePreset,
  buildBubblePreviewStyle,
  buildChatBackgroundStyle,
  loadChatAppearance,
  saveChatAppearance,
} from '@/src/lib/chatAppearance';
import { getNotificationPrefs, setPushEnabled } from '@/src/lib/local/notificationPrefs';

type Option<T extends string> = {
  value: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

const themeModeOptions: Option<ThemeMode>[] = [
  { value: 'system', label: 'Системная', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Светлая', icon: 'sunny-outline' },
  { value: 'dark', label: 'Тёмная', icon: 'moon-outline' },
];

const textSizeOptions: Option<TextSizePreset>[] = [
  { value: 'small', label: 'Маленький' },
  { value: 'normal', label: 'Обычный' },
  { value: 'large', label: 'Крупный' },
];

const messageSizeOptions: Option<MessageSizePreset>[] = [
  { value: 'compact', label: 'Компактный' },
  { value: 'normal', label: 'Обычный' },
  { value: 'spacious', label: 'Просторный' },
];

const cardRadiusOptions: Option<CardRadiusPreset>[] = [
  { value: 'standard', label: 'Стандарт' },
  { value: 'soft', label: 'Мягкое' },
  { value: 'large', label: 'Большое' },
];

const backgroundOptions: Option<ChatBackgroundPreset>[] = [
  { value: 'gradient', label: 'Градиент' },
  { value: 'solid', label: 'Однотонный' },
  { value: 'light', label: 'Светлый' },
  { value: 'dark', label: 'Тёмный' },
];

function showApiNote(title: string) {
  Alert.alert(
    title,
    'Интерфейс готов. Для синхронизации с сервером нужен endpoint, он записан в docs/mobile_api_required.md.',
  );
}

export default function SettingsScreen() {
  const { theme, themeMode, setThemeMode } = useTheme();
  const logout = useAuthStore((s) => s.logout);

  const [appearance, setAppearance] = useState<ChatAppearance>(DEFAULT_CHAT_APPEARANCE);
  const [pushEnabled, setPushEnabledState] = useState(true);
  const [savingPush, setSavingPush] = useState(false);

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
      .then((prefs) => {
        if (mounted) {
          setPushEnabledState(prefs.pushEnabled);
        }
      })
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
    setSavingPush(true);

    try {
      await setPushEnabled(value);
      if (value) {
        await registerNativePushToken();
      } else {
        await unregisterCurrentPushToken();
      }
    } catch (error) {
      console.error('handleTogglePush error:', error);
      setPushEnabledState(!value);
      Alert.alert('Push-уведомления', 'Не удалось обновить push token. Проверьте Firebase/серверный endpoint.');
    } finally {
      setSavingPush(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const renderSegmented = <T extends string>(
    options: Option<T>[],
    currentValue: T,
    onChange: (value: T) => void,
  ) => (
    <View style={[styles.segmented, { backgroundColor: theme.colors.inputBackground }]}>
      {options.map((option) => {
        const active = option.value === currentValue;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              {
                backgroundColor: active ? theme.colors.primary : 'transparent',
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            {option.icon ? (
              <Ionicons
                name={option.icon}
                size={16}
                color={active ? '#FFFFFF' : theme.colors.muted}
              />
            ) : null}
            <Text
              style={[
                styles.segmentText,
                { color: active ? '#FFFFFF' : theme.colors.text },
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
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
              style={[styles.row, styles.rowBorder, { borderBottomColor: theme.colors.border }]}
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
          <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>Внешний вид</Text>
          <GlassCard style={styles.cardPadded}>
            <View style={styles.heroPreview}>
              <View
                style={[
                  styles.previewWrap,
                  buildChatBackgroundStyle(theme, appearance),
                  { borderColor: theme.colors.borderStrong },
                ]}
              >
                <View
                  style={[
                    styles.previewBubble,
                    buildBubblePreviewStyle(theme, appearance.peerBubblePreset, false),
                  ]}
                >
                  <Text style={{ color: theme.colors.text }}>Привет, как дела?</Text>
                </View>
                <View
                  style={[
                    styles.previewBubble,
                    styles.previewOwnBubble,
                    buildBubblePreviewStyle(theme, appearance.ownBubblePreset, true),
                  ]}
                >
                  <Text style={{ color: '#FFFFFF' }}>Всё отлично</Text>
                </View>
              </View>
            </View>

            <Text style={[styles.optionTitle, { color: theme.colors.text }]}>Тема</Text>
            {renderSegmented(themeModeOptions, themeMode, (value) => void setThemeMode(value))}

            <Text style={[styles.optionTitle, { color: theme.colors.text }]}>Цветовой стиль</Text>
            <View style={[styles.colorStyle, { backgroundColor: theme.colors.primarySoft }]}>
              <View style={[styles.colorSwatch, { backgroundColor: theme.colors.primary }]} />
              <Text style={[styles.colorStyleText, { color: theme.colors.text }]}>Зелёный по умолчанию</Text>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
            </View>

            <Text style={[styles.optionTitle, { color: theme.colors.text }]}>Размер текста</Text>
            {renderSegmented(textSizeOptions, appearance.textSize, (value) =>
              void patchAppearance({ textSize: value }),
            )}

            <Text style={[styles.optionTitle, { color: theme.colors.text }]}>Размер сообщений</Text>
            {renderSegmented(messageSizeOptions, appearance.messageSize, (value) =>
              void patchAppearance({ messageSize: value }),
            )}

            <Text style={[styles.optionTitle, { color: theme.colors.text }]}>Скругление карточек</Text>
            {renderSegmented(cardRadiusOptions, appearance.cardRadius, (value) =>
              void patchAppearance({ cardRadius: value }),
            )}

            <Text style={[styles.optionTitle, { color: theme.colors.text }]}>Фон чата</Text>
            {renderSegmented(backgroundOptions, appearance.backgroundPreset, (value) =>
              void patchAppearance({ backgroundPreset: value }),
            )}
          </GlassCard>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>Уведомления и устройство</Text>
          <GlassCard style={styles.card}>
            <View style={[styles.row, styles.rowBorder, { borderBottomColor: theme.colors.border }]}>
              <Ionicons name="notifications-outline" size={20} color={theme.colors.primary} />
              <View style={styles.rowTextWrap}>
                <Text style={[styles.rowText, { color: theme.colors.text }]}>Push-уведомления</Text>
                <Text style={[styles.rowSub, { color: theme.colors.muted }]}>
                  Новые сообщения, звонки и ответы
                </Text>
              </View>
              <Switch
                value={pushEnabled}
                disabled={savingPush}
                onValueChange={(value) => void handleTogglePush(value)}
                trackColor={{ true: theme.colors.primary, false: theme.colors.borderStrong }}
                thumbColor="#FFFFFF"
              />
            </View>

            <Pressable
              onPress={() => showApiNote('Управление устройствами')}
              style={[styles.row, styles.rowBorder, { borderBottomColor: theme.colors.border }]}
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

        <Pressable
          onPress={() => void handleLogout()}
          style={[styles.logout, { backgroundColor: theme.colors.cardStrong }]}
        >
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
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  cardPadded: {
    gap: 12,
  },
  row: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowTextWrap: {
    flex: 1,
    gap: 2,
  },
  rowText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  rowSub: {
    fontSize: 12,
    fontWeight: '600',
  },
  soonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  heroPreview: {
    marginBottom: 4,
  },
  previewWrap: {
    minHeight: 154,
    borderRadius: 24,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    overflow: 'hidden',
  },
  previewBubble: {
    maxWidth: '82%',
    minHeight: 40,
    alignSelf: 'flex-start',
  },
  previewOwnBubble: {
    alignSelf: 'flex-end',
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  segmented: {
    minHeight: 44,
    borderRadius: 16,
    padding: 4,
    flexDirection: 'row',
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 6,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '800',
  },
  colorStyle: {
    minHeight: 46,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colorSwatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  colorStyleText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
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
