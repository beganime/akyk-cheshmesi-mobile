import { PropsWithChildren } from 'react';
import {
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';

import { useTheme } from '@/src/theme/ThemeProvider';

type GlassCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

export function GlassCard({ children, style }: GlassCardProps) {
  const { theme } = useTheme();

  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          styles.base,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.borderStrong,
            shadowColor: theme.colors.shadow,
          },
          {
            boxShadow: '0 14px 30px rgba(0,0,0,0.12)' as any,
            backdropFilter: 'blur(24px)' as any,
            WebkitBackdropFilter: 'blur(24px)' as any,
          } as any,
          style,
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
        styles.base,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.borderStrong,
          shadowColor: theme.colors.shadow,
        },
        style,
      ]}
    >
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  base: {
    padding: 16,
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOpacity: 0.1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 9,
  },
});