import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { GlassCard } from '@/src/components/GlassCard';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuthStore } from '@/src/state/auth';

type SettingRow = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  action: () => void;
  danger?: boolean;
};

function showApiNote(title: string) {
  Alert.alert(
    title,
    'Интерфейс готов. Для синхронизации с сервером нужен endpoint, он записан в docs/mobile_api_required.md.',
  );
}

export default function ProfileScreen() {
  const { theme } = useTheme();
  const { user, logout } = useAuthStore();

  const name =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    user?.username ||
    'Пользователь';

  const subtitle = user?.username ? `@${user.username}` : user?.email || 'Аккаунт Akyl Çeşmesi';

  const onLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const rows: SettingRow[] = [
    {
      title: 'Безопасность аккаунта',
      icon: 'shield-checkmark-outline',
      color: '#22C55E',
      action: () => showApiNote('Безопасность аккаунта'),
    },
    {
      title: 'Настройки чата',
      icon: 'chatbubble-ellipses-outline',
      color: theme.colors.primary,
      action: () => router.push('/(app)/settings'),
    },
    {
      title: 'Конфиденциальность',
      icon: 'lock-closed-outline',
      color: '#8B5CF6',
      action: () => showApiNote('Конфиденциальность'),
    },
    {
      title: 'Уведомления',
      icon: 'notifications-outline',
      color: '#F59E0B',
      action: () => router.push('/(app)/settings'),
    },
    {
      title: 'Хранилище',
      icon: 'file-tray-full-outline',
      color: '#06B6D4',
      action: () => showApiNote('Хранилище'),
    },
    {
      title: 'Управление устройствами',
      icon: 'phone-portrait-outline',
      color: '#3B82F6',
      action: () => showApiNote('Управление устройствами'),
    },
    {
      title: 'Тема',
      icon: 'color-palette-outline',
      color: '#EC4899',
      action: () => router.push('/(app)/settings'),
    },
    {
      title: 'Язык',
      icon: 'language-outline',
      color: '#14B8A6',
      action: () => showApiNote('Язык'),
    },
    {
      title: 'Выход',
      icon: 'log-out-outline',
      color: theme.colors.danger,
      danger: true,
      action: () => void onLogout(),
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.screenTitle, { color: theme.colors.text }]}>Профиль</Text>
        <Pressable
          onPress={() => router.push('/(app)/profile-edit')}
          style={[styles.editButton, { backgroundColor: theme.colors.primarySoft }]}
        >
          <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GlassCard style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            {user?.avatar ? (
              <ExpoImage source={{ uri: user.avatar }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <View style={[styles.onlineDot, { borderColor: theme.colors.cardSolid }]} />
          </View>

          <View style={styles.profileText}>
            <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.primary }]} numberOfLines={1}>
              {subtitle}
            </Text>
            <Text style={[styles.status, { color: theme.colors.muted }]} numberOfLines={1}>
              online · {user?.email || 'email не указан'}
            </Text>
          </View>
        </GlassCard>

        <GlassCard style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={19} color={theme.colors.muted} />
            <Text style={[styles.infoText, { color: theme.colors.text }]} numberOfLines={1}>
              {user?.email || 'Email не указан'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={19} color={theme.colors.muted} />
            <Text style={[styles.infoText, { color: theme.colors.text }]} numberOfLines={1}>
              {user?.username ? `@${user.username}` : 'Username не указан'}
            </Text>
          </View>
        </GlassCard>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>Настройки</Text>
          <GlassCard style={styles.settingsCard}>
            {rows.map((row, index) => (
              <Pressable
                key={row.title}
                onPress={row.action}
                style={({ pressed }) => [
                  styles.row,
                  index < rows.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.colors.border,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={[styles.rowIcon, { backgroundColor: `${row.color}20` }]}>
                  <Ionicons name={row.icon} size={19} color={row.color} />
                </View>
                <Text
                  style={[
                    styles.rowText,
                    { color: row.danger ? theme.colors.danger : theme.colors.text },
                  ]}
                >
                  {row.title}
                </Text>
                {!row.danger ? (
                  <Ionicons name="chevron-forward" size={19} color={theme.colors.muted} />
                ) : null}
              </Pressable>
            ))}
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
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
  },
  editButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 14,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#E5E7EB',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
  },
  onlineDot: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 3,
    backgroundColor: '#22C55E',
  },
  profileText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  status: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoCard: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: '600',
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
  settingsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  row: {
    minHeight: 56,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
});
