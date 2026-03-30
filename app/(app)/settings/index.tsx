import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { GlassCard } from '@/src/components/GlassCard';
import { useAuthStore } from '@/src/state/auth';

const themeModes = [
  'lightOrange',
  'darkOrange',
  'lightGradient',
  'darkGradient',
] as const;

export default function SettingsScreen() {
  const { theme, themeName, setThemeName } = useTheme();
  const logout = useAuthStore((s) => s.logout);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <GlassCard>
        <Text style={[styles.title, { color: theme.colors.text }]}>Тема</Text>

        {themeModes.map((mode) => (
          <Pressable
            key={mode}
            onPress={() => setThemeName(mode)}
            style={[
              styles.option,
              {
                borderColor: theme.colors.border,
                backgroundColor: themeName === mode ? theme.colors.primary : 'transparent',
              },
            ]}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>{mode}</Text>
          </Pressable>
        ))}

        <Pressable onPress={logout} style={[styles.logout, { borderColor: theme.colors.border }]}>
          <Text style={{ color: theme.colors.text }}>Выйти</Text>
        </Pressable>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  option: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  logout: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
});
