import { PropsWithChildren } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/src/theme/ThemeProvider';

export function GlassCard({ children }: PropsWithChildren) {
  const { theme } = useTheme();

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.webCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        {children}
      </View>
    );
  }

  return (
    <BlurView intensity={28} tint={theme.blurTint} style={[styles.card, { borderColor: theme.colors.border }]}>
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  webCard: {
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    backdropFilter: 'blur(20px)' as any,
  },
});
