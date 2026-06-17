import { PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/src/theme/ThemeProvider';

type AuthPrimaryButtonProps = {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export function AuthPrimaryButton({
  title,
  icon = 'arrow-forward',
  loading,
  disabled,
  onPress,
}: AuthPrimaryButtonProps) {
  const { theme } = useTheme();
  const isDisabled = Boolean(disabled || loading);
  const colors: [string, string] = theme.isDark
    ? ['#178A48', '#0F6A38']
    : ['#31A866', '#55C983'];

  return (
    <Pressable onPress={onPress} disabled={isDisabled}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.primaryButton, isDisabled && styles.disabled]}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Text style={styles.primaryButtonText}>{title}</Text>
            <Ionicons name={icon} size={18} color="#FFFFFF" />
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

type AuthErrorBannerProps = {
  message: string | null;
};

export function AuthErrorBanner({ message }: AuthErrorBannerProps) {
  const { theme } = useTheme();

  if (!message) {
    return null;
  }

  return (
    <View
      style={[
        styles.errorBanner,
        {
          backgroundColor: theme.isDark ? 'rgba(248,113,113,0.13)' : '#FEF2F2',
          borderColor: theme.isDark ? 'rgba(248,113,113,0.32)' : '#FECACA',
        },
      ]}
    >
      <Ionicons name="alert-circle-outline" size={18} color={theme.colors.danger} />
      <Text style={[styles.errorText, { color: theme.colors.danger }]}>{message}</Text>
    </View>
  );
}

export function AuthThemeToggle() {
  const { theme, setThemeName } = useTheme();
  const nextThemeName = theme.isDark ? 'lightGreen' : 'darkGreen';

  return (
    <Pressable
      onPress={() => void setThemeName(nextThemeName)}
      style={[
        styles.themeToggle,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.borderStrong,
        },
      ]}
      hitSlop={8}
    >
      <Ionicons
        name={theme.isDark ? 'moon' : 'sunny-outline'}
        size={17}
        color={theme.colors.primary}
      />
      <Text style={[styles.themeToggleText, { color: theme.colors.text }]}>
        {theme.isDark ? 'Тёмная' : 'Светлая'}
      </Text>
    </Pressable>
  );
}

export function AuthHeader({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  const { theme } = useTheme();

  return (
    <View style={styles.hero}>
      <View style={[styles.logoCircle, { backgroundColor: theme.colors.primary }]}>
        <Ionicons name={icon} size={28} color="#FFFFFF" />
      </View>
      <Text style={[styles.brandTitle, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.brandSubtitle, { color: theme.colors.muted }]}>{subtitle}</Text>
    </View>
  );
}

export function AuthFieldError({ children }: PropsWithChildren) {
  const { theme } = useTheme();

  if (!children) {
    return null;
  }

  return <Text style={[styles.fieldError, { color: theme.colors.danger }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  primaryButton: {
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  disabled: {
    opacity: 0.68,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  errorBanner: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  themeToggle: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 5,
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  themeToggleText: {
    fontSize: 13,
    fontWeight: '800',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 6,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  brandTitle: {
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  brandSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 21,
  },
  fieldError: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: -6,
    marginBottom: 10,
  },
});
