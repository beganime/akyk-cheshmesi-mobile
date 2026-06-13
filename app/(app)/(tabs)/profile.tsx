import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '@/src/state/auth';
import { useTheme } from '@/src/theme/ThemeProvider';

export default function ProfileScreen() {
  const { theme } = useTheme();
  const { user, logout } = useAuthStore();

  const name =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    user?.username ||
    'Пользователь';
  const username = user?.username ? `@${user.username}` : 'username не указан';
  const email = user?.email || 'email не указан';

  const onLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Профиль</Text>
        <Pressable
          onPress={() => router.push('/(app)/settings')}
          style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.65 }]}
        >
          <Ionicons name="settings-outline" size={23} color={theme.colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.profileBlock, { borderBottomColor: theme.colors.border }]}>
          {user?.avatar ? (
            <ExpoImage
              source={{ uri: user.avatar }}
              style={styles.avatarImage}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}

          <View style={styles.profileText}>
            <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.status, { color: theme.colors.primary }]}>online</Text>
          </View>
        </View>

        <View style={[styles.infoGroup, { borderColor: theme.colors.border }]}>
          <InfoRow icon="person-outline" label={username} />
          <InfoRow icon="mail-outline" label={email} />
        </View>

        <View style={[styles.menuGroup, { borderColor: theme.colors.border }]}>
          <MenuRow
            icon="create-outline"
            title="Редактировать профиль"
            onPress={() => router.push('/(app)/profile-edit')}
          />
          <MenuRow
            icon="settings-outline"
            title="Настройки"
            onPress={() => router.push('/(app)/settings')}
          />
        </View>

        <Pressable
          onPress={() => void onLogout()}
          style={({ pressed }) => [
            styles.logoutRow,
            {
              borderColor: theme.colors.border,
              backgroundColor: pressed ? theme.colors.backgroundSecondary : 'transparent',
            },
          ]}
        >
          <Ionicons name="log-out-outline" size={21} color={theme.colors.danger} />
          <Text style={[styles.logoutText, { color: theme.colors.danger }]}>Выйти</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );

  function InfoRow({
    icon,
    label,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
  }) {
    return (
      <View style={[styles.infoRow, { borderBottomColor: theme.colors.border }]}>
        <Ionicons name={icon} size={20} color={theme.colors.muted} />
        <Text style={[styles.infoText, { color: theme.colors.text }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    );
  }

  function MenuRow({
    icon,
    title,
    onPress,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    onPress: () => void;
  }) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.menuRow,
          {
            borderBottomColor: theme.colors.border,
            backgroundColor: pressed ? theme.colors.backgroundSecondary : 'transparent',
          },
        ]}
      >
        <Ionicons name={icon} size={21} color={theme.colors.primary} />
        <Text style={[styles.menuText, { color: theme.colors.text }]}>{title}</Text>
        <Ionicons name="chevron-forward" size={19} color={theme.colors.muted} />
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    minHeight: 58,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: 120,
  },
  profileBlock: {
    paddingHorizontal: 18,
    paddingVertical: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#E5E7EB',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
  },
  profileText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
  },
  status: {
    marginTop: 5,
    fontSize: 14,
    fontWeight: '700',
  },
  infoGroup: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 14,
  },
  infoRow: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  menuGroup: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 14,
  },
  menuRow: {
    minHeight: 54,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  logoutRow: {
    minHeight: 54,
    marginTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '800',
  },
});
