import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/src/components/GlassCard';
import { useTheme } from '@/src/theme/ThemeProvider';

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backButton, { borderColor: theme.colors.border }]}
        >
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Настройки</Text>

        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>
        <GlassCard>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Тема</Text>

          {themeModes.map((mode) => {
            const isActive = themeName === mode;

            return (
              <Pressable
                key={mode}
                onPress={() => setThemeName(mode)}
                style={[
                  styles.option,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: isActive ? theme.colors.primary : 'transparent',
                  },
                ]}
              >
                <Text
                  style={{
                    color: isActive ? '#fff' : theme.colors.text,
                    fontWeight: '600',
                  }}
                >
                  {themeLabels[mode]}
                </Text>
              </Pressable>
            );
          })}
        </GlassCard>
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
  backButton: {
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
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  option: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
});