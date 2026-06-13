import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import {
  DEFAULT_CHAT_APPEARANCE,
  type ChatAppearance,
  loadChatAppearance,
  saveChatAppearance,
} from '@/src/lib/chatAppearance';
import {
  clearAllAppCaches,
  clearImageDiskCache,
  clearImageMemoryCache,
  clearLocalJsonCache,
  formatCacheSize,
  getLocalCacheStats,
  type CacheStats,
} from '@/src/lib/cache/storage';
import {
  getNotificationPrefs,
  saveNotificationPrefs,
  setPushEnabled,
} from '@/src/lib/local/notificationPrefs';
import {
  registerNativePushToken,
  unregisterCurrentPushToken,
} from '@/src/lib/push/register';
import { useTheme, type ThemeMode } from '@/src/theme/ThemeProvider';
import { themeOptions, themes, type ThemeName } from '@/src/theme/themes';

type SettingsSection =
  | 'language'
  | 'devices'
  | 'storage'
  | 'notifications'
  | 'chat'
  | 'appearance'
  | 'privacy'
  | 'security';

type NotificationPrefs = Awaited<ReturnType<typeof getNotificationPrefs>>;

type LocalToggles = {
  enterToSend: boolean;
  autoDownloadMedia: boolean;
  whoCanSeeStatus: 'contacts' | 'everyone' | 'nobody';
  whoCanWrite: 'contacts' | 'everyone';
};

const sectionMeta: Record<SettingsSection, { title: string; icon: keyof typeof Ionicons.glyphMap }> = {
  language: { title: 'Язык', icon: 'language-outline' },
  devices: { title: 'Управление устройствами', icon: 'phone-portrait-outline' },
  storage: { title: 'Хранилище', icon: 'file-tray-full-outline' },
  notifications: { title: 'Уведомления', icon: 'notifications-outline' },
  chat: { title: 'Настройки чата', icon: 'chatbubble-ellipses-outline' },
  appearance: { title: 'Внешний вид', icon: 'color-palette-outline' },
  privacy: { title: 'Конфиденциальность', icon: 'lock-closed-outline' },
  security: { title: 'Безопасность аккаунта', icon: 'shield-checkmark-outline' },
};

const themeModeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Системная' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
];

const textSizeOptions: { value: ChatAppearance['textSize']; label: string }[] = [
  { value: 'small', label: 'Маленький' },
  { value: 'normal', label: 'Обычный' },
  { value: 'large', label: 'Крупный' },
];

const messageSizeOptions: { value: ChatAppearance['messageSize']; label: string }[] = [
  { value: 'compact', label: 'Компактный' },
  { value: 'normal', label: 'Обычный' },
  { value: 'spacious', label: 'Просторный' },
];

const backgroundOptions: { value: ChatAppearance['backgroundPreset']; label: string }[] = [
  { value: 'gradient', label: 'Градиент' },
  { value: 'solid', label: 'Однотонный' },
  { value: 'light', label: 'Светлый' },
  { value: 'dark', label: 'Тёмный' },
];

export default function SettingsSectionScreen() {
  const params = useLocalSearchParams<{ section?: string }>();
  const section = normalizeSection(params.section);
  const meta = sectionMeta[section];
  const { theme, themeMode, selectedThemeName, setThemeMode, setThemeName } = useTheme();
  const [appearance, setAppearance] = useState<ChatAppearance>(DEFAULT_CHAT_APPEARANCE);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>({
    pushEnabled: true,
    soundEnabled: true,
    vibrationEnabled: true,
    previewEnabled: true,
  });
  const [localToggles, setLocalToggles] = useState<LocalToggles>({
    enterToSend: false,
    autoDownloadMedia: true,
    whoCanSeeStatus: 'contacts',
    whoCanWrite: 'contacts',
  });
  const [cacheStats, setCacheStats] = useState<CacheStats>({ keys: 0, bytes: 0 });
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const currentDeviceName = useMemo(() => {
    return Device.deviceName || Device.modelName || `${Platform.OS} device`;
  }, []);

  const appVersion = Constants.expoConfig?.version || Constants.nativeAppVersion || 'unknown';

  const refreshCacheStats = useCallback(async () => {
    const stats = await getLocalCacheStats();
    setCacheStats(stats);
  }, []);

  useEffect(() => {
    let mounted = true;

    loadChatAppearance()
      .then((value) => {
        if (mounted) setAppearance(value);
      })
      .catch(() => undefined);

    getNotificationPrefs()
      .then((value) => {
        if (mounted) setNotificationPrefs(value);
      })
      .catch(() => undefined);

    void refreshCacheStats();

    return () => {
      mounted = false;
    };
  }, [refreshCacheStats]);

  const patchAppearance = async (patch: Partial<ChatAppearance>) => {
    const next = {
      ...appearance,
      ...patch,
    };

    setAppearance(next);
    await saveChatAppearance(next);
  };

  const patchNotifications = async (patch: Partial<NotificationPrefs>) => {
    const next = {
      ...notificationPrefs,
      ...patch,
    };

    setNotificationPrefs(next);
    await saveNotificationPrefs(next);
  };

  const togglePush = async (value: boolean) => {
    setBusyKey('push');
    setNotificationPrefs((current) => ({ ...current, pushEnabled: value }));

    try {
      await setPushEnabled(value);
      if (value) {
        await registerNativePushToken();
      } else {
        await unregisterCurrentPushToken();
      }
    } catch {
      setNotificationPrefs((current) => ({ ...current, pushEnabled: !value }));
      Alert.alert('Уведомления', 'Не удалось обновить push token. Проверь Firebase и backend endpoint.');
    } finally {
      setBusyKey(null);
    }
  };

  const clearCache = async (key: string, action: () => Promise<void>) => {
    try {
      setBusyKey(key);
      await action();
      await refreshCacheStats();
      Alert.alert('Хранилище', 'Кэш очищен.');
    } catch {
      Alert.alert('Хранилище', 'Не удалось очистить кэш.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{meta.title}</Text>
        </View>
        <View style={styles.headerButton}>
          <Ionicons name={meta.icon} size={22} color={theme.colors.primary} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {renderSection()}
      </ScrollView>
    </SafeAreaView>
  );

  function renderSection() {
    switch (section) {
      case 'language':
        return (
          <SectionBlock>
            <Row icon="language-outline" title="Русский" subtitle="по умолчанию" selected />
            <InfoBox text="Другие языки будут добавлены позже." />
          </SectionBlock>
        );
      case 'devices':
        return (
          <>
            <SectionBlock>
              <Row
                icon="phone-portrait-outline"
                title={currentDeviceName}
                subtitle={`${Platform.OS} · app ${appVersion}`}
                selected
              />
            </SectionBlock>
            <InfoBox text="Backend endpoint для списка устройств и завершения сессий пока не задокументирован. UI готов, данные текущего устройства берутся локально." />
          </>
        );
      case 'storage':
        return (
          <>
            <SectionBlock>
              <Row
                icon="server-outline"
                title="Локальный кэш"
                subtitle={`${formatCacheSize(cacheStats.bytes)} · ${cacheStats.keys} ключей`}
              />
              <ActionRow
                icon="trash-outline"
                title="Очистить JSON-кэш"
                busy={busyKey === 'json-cache'}
                onPress={() => void clearCache('json-cache', clearLocalJsonCache)}
              />
              <ActionRow
                icon="image-outline"
                title="Очистить изображения и аватарки"
                busy={busyKey === 'image-cache'}
                onPress={() =>
                  void clearCache('image-cache', async () => {
                    await clearImageMemoryCache();
                    await clearImageDiskCache();
                  })
                }
              />
              <ActionRow
                icon="nuclear-outline"
                title="Очистить весь кэш приложения"
                busy={busyKey === 'all-cache'}
                danger
                onPress={() => void clearCache('all-cache', clearAllAppCaches)}
              />
            </SectionBlock>
            <SectionBlock>
              <ToggleRow
                title="Автозагрузка медиа"
                value={localToggles.autoDownloadMedia}
                onValueChange={(value) =>
                  setLocalToggles((current) => ({ ...current, autoDownloadMedia: value }))
                }
              />
            </SectionBlock>
          </>
        );
      case 'notifications':
        return (
          <SectionBlock>
            <ToggleRow
              title="Push-уведомления"
              value={notificationPrefs.pushEnabled}
              disabled={busyKey === 'push'}
              onValueChange={(value) => void togglePush(value)}
            />
            <ToggleRow
              title="Звук"
              value={notificationPrefs.soundEnabled}
              onValueChange={(value) => void patchNotifications({ soundEnabled: value })}
            />
            <ToggleRow
              title="Вибрация"
              value={notificationPrefs.vibrationEnabled}
              onValueChange={(value) => void patchNotifications({ vibrationEnabled: value })}
            />
            <ToggleRow
              title="Превью текста"
              value={notificationPrefs.previewEnabled}
              onValueChange={(value) => void patchNotifications({ previewEnabled: value })}
            />
            <ActionRow
              icon="volume-mute-outline"
              title="Беззвучные чаты"
              subtitle="Управляются долгим нажатием на чат"
              onPress={() => router.push('/(app)/(tabs)/chats')}
            />
          </SectionBlock>
        );
      case 'chat':
        return (
          <>
            <SectionBlock>
              <PickerRow
                title="Размер текста"
                options={textSizeOptions}
                value={appearance.textSize}
                onChange={(value) => void patchAppearance({ textSize: value })}
              />
              <PickerRow
                title="Размер сообщений"
                options={messageSizeOptions}
                value={appearance.messageSize}
                onChange={(value) => void patchAppearance({ messageSize: value })}
              />
              <PickerRow
                title="Фон чата"
                options={backgroundOptions}
                value={appearance.backgroundPreset}
                onChange={(value) => void patchAppearance({ backgroundPreset: value })}
              />
              <ToggleRow
                title="Enter отправляет сообщение"
                value={localToggles.enterToSend}
                onValueChange={(value) =>
                  setLocalToggles((current) => ({ ...current, enterToSend: value }))
                }
              />
              <ToggleRow
                title="Автозагрузка медиа"
                value={localToggles.autoDownloadMedia}
                onValueChange={(value) =>
                  setLocalToggles((current) => ({ ...current, autoDownloadMedia: value }))
                }
              />
            </SectionBlock>
          </>
        );
      case 'appearance':
        return (
          <>
            <SectionBlock>
              <PickerRow
                title="Режим"
                options={themeModeOptions}
                value={themeMode}
                onChange={(value) => void setThemeMode(value)}
              />
            </SectionBlock>
            <SectionBlock>
              {themeOptions.map((option) => (
                <ThemeRow
                  key={option.name}
                  name={option.name}
                  label={option.label}
                  selected={selectedThemeName === option.name}
                  onPress={() => void setThemeName(option.name)}
                />
              ))}
            </SectionBlock>
          </>
        );
      case 'privacy':
        return (
          <>
            <SectionBlock>
              <PickerRow
                title="Кто видит статус"
                options={[
                  { value: 'contacts', label: 'Контакты' },
                  { value: 'everyone', label: 'Все' },
                  { value: 'nobody', label: 'Никто' },
                ]}
                value={localToggles.whoCanSeeStatus}
                onChange={(value) =>
                  setLocalToggles((current) => ({ ...current, whoCanSeeStatus: value }))
                }
              />
              <PickerRow
                title="Кто может писать"
                options={[
                  { value: 'contacts', label: 'Контакты' },
                  { value: 'everyone', label: 'Все' },
                ]}
                value={localToggles.whoCanWrite}
                onChange={(value) =>
                  setLocalToggles((current) => ({ ...current, whoCanWrite: value }))
                }
              />
              <ActionRow
                icon="ban-outline"
                title="Заблокированные и скрытые"
                onPress={() => router.push('/(app)/blocked-users')}
              />
            </SectionBlock>
            <InfoBox text="Настройки приватности пока локальные. Для синхронизации нужен backend settings/privacy API." />
          </>
        );
      case 'security':
        return (
          <>
            <SectionBlock>
              <Row icon="key-outline" title="Смена пароля" subtitle="Нужен backend endpoint" />
              <Row icon="shield-half-outline" title="2FA" subtitle="Будет добавлено позже" />
              <ActionRow
                icon="phone-portrait-outline"
                title="Активные сессии"
                subtitle="Открыть управление устройствами"
                onPress={() =>
                  router.replace({
                    pathname: '/(app)/settings/[section]',
                    params: { section: 'devices' },
                  })
                }
              />
            </SectionBlock>
            <InfoBox text="Для смены пароля, 2FA и удалённого завершения сессий нужны backend endpoints." />
          </>
        );
      default:
        return null;
    }
  }

  function SectionBlock({ children }: { children: ReactNode }) {
    return (
      <View style={[styles.block, { borderColor: theme.colors.border }]}>{children}</View>
    );
  }

  function Row({
    icon,
    title,
    subtitle,
    selected,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle?: string;
    selected?: boolean;
  }) {
    return (
      <View style={[styles.row, { borderBottomColor: theme.colors.border }]}>
        <Ionicons name={icon} size={21} color={selected ? theme.colors.primary : theme.colors.muted} />
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: theme.colors.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.rowSub, { color: theme.colors.muted }]}>{subtitle}</Text>
          ) : null}
        </View>
        {selected ? <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} /> : null}
      </View>
    );
  }

  function ActionRow({
    icon,
    title,
    subtitle,
    busy,
    danger,
    onPress,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle?: string;
    busy?: boolean;
    danger?: boolean;
    onPress: () => void;
  }) {
    return (
      <Pressable
        onPress={onPress}
        disabled={busy}
        style={({ pressed }) => [
          styles.row,
          {
            borderBottomColor: theme.colors.border,
            backgroundColor: pressed ? theme.colors.backgroundSecondary : 'transparent',
          },
        ]}
      >
        <Ionicons name={icon} size={21} color={danger ? theme.colors.danger : theme.colors.primary} />
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: danger ? theme.colors.danger : theme.colors.text }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.rowSub, { color: theme.colors.muted }]}>{subtitle}</Text>
          ) : null}
        </View>
        {busy ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : (
          <Ionicons name="chevron-forward" size={19} color={theme.colors.muted} />
        )}
      </Pressable>
    );
  }

  function ToggleRow({
    title,
    value,
    disabled,
    onValueChange,
  }: {
    title: string;
    value: boolean;
    disabled?: boolean;
    onValueChange: (value: boolean) => void;
  }) {
    return (
      <View style={[styles.row, { borderBottomColor: theme.colors.border }]}>
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: theme.colors.text }]}>{title}</Text>
        </View>
        <Switch
          value={value}
          disabled={disabled}
          onValueChange={onValueChange}
          trackColor={{ true: theme.colors.primary, false: theme.colors.borderStrong }}
          thumbColor="#FFFFFF"
        />
      </View>
    );
  }

  function PickerRow<T extends string>({
    title,
    options,
    value,
    onChange,
  }: {
    title: string;
    options: { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
  }) {
    return (
      <View style={[styles.pickerRow, { borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.pickerTitle, { color: theme.colors.text }]}>{title}</Text>
        <View style={styles.chipWrap}>
          {options.map((option) => {
            const active = option.value === value;

            return (
              <Pressable
                key={option.value}
                onPress={() => onChange(option.value)}
                style={[
                  styles.chip,
                  {
                    borderColor: active ? theme.colors.primary : theme.colors.borderStrong,
                    backgroundColor: active ? theme.colors.primarySoft : 'transparent',
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: active ? theme.colors.primary : theme.colors.text }]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  function ThemeRow({
    name,
    label,
    selected,
    onPress,
  }: {
    name: ThemeName;
    label: string;
    selected: boolean;
    onPress: () => void;
  }) {
    const previewTheme = themes[name];

    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.themeRow,
          {
            borderBottomColor: theme.colors.border,
            backgroundColor: pressed ? theme.colors.backgroundSecondary : 'transparent',
          },
        ]}
      >
        <View style={[styles.themeSwatch, { backgroundColor: theme.colors.primarySoft }]}>
          <View
            style={[styles.themeSwatchDot, { backgroundColor: previewTheme.colors.primary }]}
          />
        </View>
        <Text style={[styles.rowTitle, { color: theme.colors.text }]}>{label}</Text>
        {selected ? <Ionicons name="checkmark" size={22} color={theme.colors.primary} /> : null}
      </Pressable>
    );
  }

  function InfoBox({ text }: { text: string }) {
    return (
      <View style={[styles.infoBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.backgroundSecondary }]}>
        <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
        <Text style={[styles.infoText, { color: theme.colors.muted }]}>{text}</Text>
      </View>
    );
  }
}

function normalizeSection(value?: string): SettingsSection {
  switch (value) {
    case 'language':
    case 'devices':
    case 'storage':
    case 'notifications':
    case 'chat':
    case 'appearance':
    case 'privacy':
    case 'security':
      return value;
    default:
      return 'appearance';
  }
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
  },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  content: {
    paddingTop: 14,
    paddingBottom: 120,
    gap: 14,
  },
  block: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    minHeight: 56,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  pickerRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '800',
  },
  themeRow: {
    minHeight: 56,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  themeSwatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeSwatchDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  infoBox: {
    marginHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
});
