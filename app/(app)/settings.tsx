import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/src/components/GlassCard';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuthStore } from '@/src/state/auth';

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

export default function SettingsScreen() {
  const { theme, themeName, setThemeName } = useTheme();
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
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

      <View style={styles.content}>
        <GlassCard>
          <Text style={[styles.groupTitle, { color: theme.colors.text }]}>Аккаунт</Text>

          <Pressable
            onPress={() => router.push('/(app)/profile-edit')}
            style={[styles.rowItem, { borderColor: theme.colors.border }]}
          >
            <Text style={[styles.rowText, { color: theme.colors.text }]}>
              Редактировать профиль
            </Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
          </Pressable>

          <Pressable
            onPress={() => {}}
            style={[styles.rowItem, { borderColor: theme.colors.border }]}
          >
            <Text style={[styles.rowText, { color: theme.colors.text }]}>
              Приватность и безопасность
            </Text>
            <Text style={[styles.soonText, { color: theme.colors.muted }]}>Скоро</Text>
          </Pressable>
        </GlassCard>

        <GlassCard>
          <Text style={[styles.groupTitle, { color: theme.colors.text }]}>Оформление</Text>

          {themeModes.map((mode) => {
            const isActive = themeName === mode;

            return (
              <Pressable
                key={mode}
                onPress={() => setThemeName(mode)}
                style={[
                  styles.themeItem,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: isActive ? theme.colors.primary : 'transparent',
                  },
                ]}
              >
                <Text
                  style={{
                    color: isActive ? '#FFFFFF' : theme.colors.text,
                    fontWeight: '600',
                  }}
                >
                  {themeLabels[mode]}
                </Text>
              </Pressable>
            );
          })}
        </GlassCard>

        <GlassCard>
          <Text style={[styles.groupTitle, { color: theme.colors.text }]}>Приложение</Text>

          <Pressable
            onPress={() => {}}
            style={[styles.rowItem, { borderColor: theme.colors.border }]}
          >
            <Text style={[styles.rowText, { color: theme.colors.text }]}>
              Уведомления
            </Text>
            <Text style={[styles.soonText, { color: theme.colors.muted }]}>Скоро</Text>
          </Pressable>

          <Pressable
            onPress={() => {}}
            style={[styles.rowItem, { borderColor: theme.colors.border }]}
          >
            <Text style={[styles.rowText, { color: theme.colors.text }]}>
              Медиа и кэш
            </Text>
            <Text style={[styles.soonText, { color: theme.colors.muted }]}>Скоро</Text>
          </Pressable>
        </GlassCard>

        <Pressable
          onPress={() => void handleLogout()}
          style={[styles.logoutButton, { backgroundColor: theme.colors.primary }]}
        >
          <Text style={styles.logoutText}>Выйти</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  soonText: {
    fontSize: 13,
  },
  themeItem: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
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