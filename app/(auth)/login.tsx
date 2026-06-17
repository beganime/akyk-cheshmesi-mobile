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
import { loginRequest } from '@/src/lib/api/auth';
import { useAuthStore } from '@/src/state/auth';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getLoginErrorMessage } from '@/src/utils/apiErrors';

export default function LoginScreen() {
  const { theme } = useTheme();
  const setSession = useAuthStore((s) => s.setSession);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    setErrorMessage(null);

    if (!normalizedEmail || !password.trim()) {
      setErrorMessage('Введите email и пароль');
      return;
    }

    try {
      setLoading(true);

      const data = await loginRequest(normalizedEmail, password);

      const accessToken = data?.tokens?.access;
      const refreshToken = data?.tokens?.refresh;
      const user = data?.user ?? null;

      if (!accessToken) {
        setErrorMessage('Сервер не вернул токен доступа. Попробуйте позже');
        return;
      }

      await setSession({
        accessToken,
        refreshToken,
        user,
      });

      router.replace('/(app)/(tabs)/chats');
    } catch (error: any) {
      setErrorMessage(getLoginErrorMessage(error));
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
            icon="paper-plane"
            title="Akyl Çeşmesi Messenger"
            subtitle="Безопасное общение для своих"
          />

          <GlassCard>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Вход</Text>
            <Text style={[styles.cardSubtitle, { color: theme.colors.muted }]}>
              Войдите в аккаунт, чтобы продолжить общение.
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
                returnKeyType="next"
                editable={!loading}
              />
            </View>

            <View
              style={[
                styles.inputWrap,
                {
                  backgroundColor: theme.colors.inputBackground,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Ionicons name="lock-closed-outline" size={18} color={theme.colors.muted} />
              <TextInput
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Пароль"
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, { color: theme.colors.text }]}
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={() => void onLogin()}
                editable={!loading}
              />
              <Pressable
                onPress={() => setPasswordVisible((value) => !value)}
                hitSlop={10}
                style={styles.eyeButton}
                disabled={loading}
              >
                <Ionicons
                  name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.colors.muted}
                />
              </Pressable>
            </View>

            <AuthPrimaryButton
              title="Войти"
              loading={loading}
              disabled={loading}
              onPress={() => void onLogin()}
            />

            <Pressable
              style={styles.secondaryAction}
              onPress={() => router.push('/(auth)/register')}
              disabled={loading}
            >
              <Text style={[styles.secondaryActionText, { color: theme.colors.primary }]}>
                Нет аккаунта? Зарегистрироваться
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
    fontWeight: '800',
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
    borderRadius: 16,
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
  eyeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
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
