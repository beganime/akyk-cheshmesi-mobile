import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { GlassCard } from '@/src/components/GlassCard';
import {
  AuthErrorBanner,
  AuthHeader,
  AuthPrimaryButton,
  AuthThemeToggle,
} from '@/src/features/auth/AuthUi';
import { registerRequest } from '@/src/lib/api/auth';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getApiErrorMessage } from '@/src/utils/apiErrors';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function RegisterScreen() {
  const { theme } = useTheme();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onRegister = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    setErrorMessage(null);

    if (!normalizedEmail) {
      setErrorMessage('Введите email');
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setErrorMessage('Введите корректный email');
      return;
    }

    try {
      setLoading(true);

      const data = await registerRequest(normalizedEmail);

      router.push({
        pathname: '/(auth)/verify-email',
        params: {
          email: data?.email ?? normalizedEmail,
        },
      });
    } catch (error: any) {
      setErrorMessage(getApiErrorMessage(error, 'Не удалось отправить код подтверждения'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={theme.colors.heroGradient} style={styles.gradient}>
      <AuthThemeToggle />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AuthHeader
            icon="person-add"
            title="Регистрация"
            subtitle="Создайте аккаунт и получите код подтверждения на почту"
          />

          <GlassCard>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Шаг 1 из 3</Text>
            <Text style={[styles.cardSubtitle, { color: theme.colors.muted }]}>
              Укажите email. Мы отправим на него 6-значный код подтверждения.
            </Text>

            <AuthErrorBanner message={errorMessage} />

            <View
              style={[
                styles.inputWrap,
                {
                  backgroundColor: theme.colors.inputBackground,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Ionicons name="mail-outline" size={18} color={theme.colors.muted} />
              <TextInput
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Email"
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, { color: theme.colors.text }]}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="done"
                onSubmitEditing={() => void onRegister()}
                editable={!loading}
              />
            </View>

            <AuthPrimaryButton
              title="Отправить код"
              loading={loading}
              disabled={loading}
              onPress={() => void onRegister()}
            />

            <Pressable
              style={styles.secondaryAction}
              onPress={() => router.replace('/(auth)/login')}
              disabled={loading}
            >
              <Text style={[styles.secondaryActionText, { color: theme.colors.primary }]}>
                Уже есть аккаунт? Войти
              </Text>
            </Pressable>
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
    gap: 18,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  inputWrap: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
  },
  secondaryAction: {
    alignSelf: 'center',
    marginTop: 14,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
