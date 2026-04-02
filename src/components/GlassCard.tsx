import { PropsWithChildren } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';

import { useTheme } from '@/src/theme/ThemeProvider';

export function GlassCard({ children }: PropsWithChildren) {
  const { theme } = useTheme();

  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          styles.webCard,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.borderStrong,
            shadowColor: theme.colors.shadow,
          },
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <BlurView
      intensity={42}
      tint={theme.blurTint}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.borderStrong,
          shadowColor: theme.colors.shadow,
        },
      ]}
    >
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOpacity: 0.1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 9,
  },
  webCard: {
    padding: 16,
    borderRadius: 28,
    borderWidth: 1,
    boxShadow: '0 14px 30px rgba(0,0,0,0.12)' as any,
    backdropFilter: 'blur(24px)' as any,
    WebkitBackdropFilter: 'blur(24px)' as any,
  },
});