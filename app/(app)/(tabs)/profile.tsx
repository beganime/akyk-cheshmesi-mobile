import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { GlassCard } from '@/src/components/GlassCard';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuthStore } from '@/src/state/auth';

export default function ProfileScreen() {
  const { theme } = useTheme();
  const { user, logout } = useAuthStore();

  const name =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    user?.username ||
    'Пользователь';

  const onLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.screenTitle, { color: theme.colors.text }]}>Профиль</Text>

        <GlassCard>
          <View style={styles.row}>
            {user?.avatar ? (
              <ExpoImage source={{ uri: user.avatar }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: theme.colors.text }]}>{name}</Text>
              <Text style={[styles.email, { color: theme.colors.muted }]}>
                {user?.email || 'Нет email'}
              </Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard>
          <Pressable
            onPress={() => router.push('/(app)/settings')}
            style={[styles.action, { borderColor: theme.colors.border }]}
          >
            <Text style={[styles.actionText, { color: theme.colors.text }]}>Настройки</Text>
          </Pressable>

          <Pressable
            onPress={onLogout}
            style={[
              styles.action,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.primary,
              },
            ]}
          >
            <Text style={[styles.actionText, { color: '#fff' }]}>Выйти</Text>
          </Pressable>
        </GlassCard>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: 16,
    paddingBottom: 120,
    gap: 12,
  },
  screenTitle: {
    fontSize: 30,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  avatarImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#E5E7EB',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
  },
  action: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
