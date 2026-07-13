import { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const contrast = theme.isDark ? '#181716' : '#ffffff';

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.primaryButton,
        { backgroundColor: theme.colors.primary },
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={contrast} />
      ) : (
        <>
          <Text style={[styles.primaryButtonText, { color: contrast }]}>{title}</Text>
          <Ionicons name={icon} size={18} color={contrast} />
        </>
      )}
    </Pressable>
  );
}

export function AuthErrorBanner({ message }: { message: string | null }) {
  const { theme } = useTheme();
  if (!message) return null;

  return (
    <View
      style={[
        styles.errorBanner,
        {
          backgroundColor: theme.isDark ? '#382224' : '#fff4f3',
          borderColor: theme.isDark ? '#684044' : '#e8b9b5',
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
  const insets = useSafeAreaInsets();
  const nextThemeName = theme.isDark ? 'lightGreen' : 'darkGreen';

  return (
    <Pressable
      onPress={() => void setThemeName(nextThemeName)}
      style={[
        styles.themeToggle,
        {
          top: Math.max(insets.top + 12, 28),
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
      <View style={[styles.logoMark, { backgroundColor: theme.colors.primary }]}>
        <Ionicons
          name={icon}
          size={26}
          color={theme.isDark ? '#181716' : '#ffffff'}
        />
      </View>
      <Text style={[styles.brandTitle, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.brandSubtitle, { color: theme.colors.muted }]}>{subtitle}</Text>
    </View>
  );
}

export function AuthFieldError({ children }: PropsWithChildren) {
  const { theme } = useTheme();
  if (!children) return null;
  return <Text style={[styles.fieldError, { color: theme.colors.danger }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  primaryButton: {
    minHeight: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  disabled: { opacity: 0.58 },
  primaryButtonText: { fontSize: 16, fontWeight: '700' },
  errorBanner: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  errorText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  themeToggle: {
    position: 'absolute',
    right: 16,
    zIndex: 5,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  themeToggleText: { fontSize: 13, fontWeight: '700' },
  hero: { alignItems: 'center', marginBottom: 6 },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  brandTitle: { fontSize: 31, fontWeight: '500', marginBottom: 7, textAlign: 'center' },
  brandSubtitle: { fontSize: 15, textAlign: 'center', lineHeight: 21 },
  fieldError: { fontSize: 12, fontWeight: '600', marginTop: -6, marginBottom: 10 },
});
