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
            borderColor: theme.colors.border,
          },
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <BlurView
      intensity={38}
      tint={theme.blurTint}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
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
    borderRadius: 26,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  webCard: {
    padding: 16,
    borderRadius: 26,
    borderWidth: 1,
    boxShadow: '0 10px 30px rgba(0,0,0,0.10)' as any,
    backdropFilter: 'blur(24px)' as any,
    WebkitBackdropFilter: 'blur(24px)' as any,
  },
});