import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
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
      <View style={styles.header}>
        <Text style={[styles.screenTitle, { color: theme.colors.text }]}>Профиль</Text>
      </View>

      <View style={styles.content}>
        <GlassCard>
          <View style={styles.profileInfoRow}>
            {user?.avatar ? (
              <ExpoImage 
                source={{ uri: user.avatar }} 
                style={[styles.avatarImage, { borderColor: theme.colors.border }]} 
                contentFit="cover" 
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
              </View>
            )}

            <View style={styles.textContainer}>
              <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
                {name}
              </Text>
              <Text style={[styles.email, { color: theme.colors.muted }]} numberOfLines={1}>
                {user?.email || 'Нет email'}
              </Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard>
          <View style={styles.actionsContainer}>
            <Pressable
              onPress={() => router.push('/(app)/settings')}
              style={({ pressed }) => [
                styles.actionRow,
                { borderBottomColor: theme.colors.border },
                pressed && { opacity: 0.7 }
              ]}
            >
              <View style={[styles.actionIcon, { backgroundColor: theme.colors.primarySoft }]}>
                <Ionicons name="settings-outline" size={20} color={theme.colors.primary} />
              </View>
              <Text style={[styles.actionText, { color: theme.colors.text }]}>Настройки</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
            </Pressable>

            <Pressable
              onPress={onLogout}
              style={({ pressed }) => [
                styles.actionRow,
                { borderBottomWidth: 0 },
                pressed && { opacity: 0.7 }
              ]}
            >
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(229, 72, 77, 0.1)' }]}>
                <Ionicons name="log-out-outline" size={20} color={theme.colors.danger} />
              </View>
              <Text style={[styles.actionText, { color: theme.colors.danger }]}>Выйти</Text>
            </Pressable>
          </View>
        </GlassCard>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 5,
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  profileInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 4,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  email: {
    fontSize: 15,
    fontWeight: '500',
  },
  actionsContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
});