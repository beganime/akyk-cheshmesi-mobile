import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { GlassCard } from '@/src/components/GlassCard';
import {
  AuthErrorBanner,
  AuthHeader,
  AuthPrimaryButton,
  AuthThemeToggle,
} from '@/src/features/auth/AuthUi';
import { registerRequest, verifyEmailRequest } from '@/src/lib/api/auth';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getApiErrorMessage } from '@/src/utils/apiErrors';

function getFirstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

export default function VerifyEmailScreen() {
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ email?: string | string[] }>();

  const initialEmail = useMemo(
    () => getFirstParam(params.email).trim().toLowerCase(),
    [params.email],
  );

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const onVerify = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.replace(/\D/g, '').slice(0, 6);

    setErrorMessage(null);
    setInfoMessage(null);

    if (!normalizedEmail) {
      setErrorMessage('Введите email');
      return;
    }

    if (normalizedCode.length !== 6) {
      setErrorMessage('Введите 6-значный код');
      return;
    }

    try {
      setLoading(true);

      const data = await verifyEmailRequest(normalizedEmail, normalizedCode);
      const verificationToken = data?.verification_token;

      if (!verificationToken) {
        setErrorMessage('Сервер не вернул токен подтверждения. Запросите код заново');
        return;
      }

      router.push({
        pathname: '/(auth)/set-password',
        params: {
          email: normalizedEmail,
          verificationToken,
        },
      });
    } catch (error: any) {
      setErrorMessage(getApiErrorMessage(error, 'Не удалось подтвердить email'));
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    setErrorMessage(null);
    setInfoMessage(null);

    if (!normalizedEmail) {
      setErrorMessage('Введите email');
      return;
    }

    try {
      setResending(true);
      await registerRequest(normalizedEmail);
      setInfoMessage('Новый код отправлен на почту');
    } catch (error: any) {
      setErrorMessage(getApiErrorMessage(error, 'Не удалось отправить код повторно'));
    } finally {
      setResending(false);
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
            icon="mail-open-outline"
            title="Подтверждение email"
            subtitle="Введите код из письма, чтобы перейти к созданию аккаунта"
          />

          <GlassCard>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Шаг 2 из 3</Text>
            <Text style={[styles.cardSubtitle, { color: theme.colors.muted }]}>
              Если письма нет, проверьте спам или отправьте код повторно.
            </Text>

            <AuthErrorBanner message={errorMessage} />
            {infoMessage ? (
              <Text style={[styles.infoText, { color: theme.colors.primary }]}>
                {infoMessage}
              </Text>
            ) : null}

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
                  setErrorMessage(null);
                  setInfoMessage(null);
                }}
                placeholder="Email"
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, { color: theme.colors.text }]}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                editable={!loading && !resending}
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
              <Ionicons name="key-outline" size={18} color={theme.colors.muted} />
              <TextInput
                value={code}
                onChangeText={(value) => {
                  setCode(value.replace(/\D/g, '').slice(0, 6));
                  setErrorMessage(null);
                }}
                placeholder="6-значный код"
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, { color: theme.colors.text }]}
                keyboardType="number-pad"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={() => void onVerify()}
                editable={!loading && !resending}
              />
            </View>

            <AuthPrimaryButton
              title="Подтвердить"
              loading={loading}
              disabled={loading || resending}
              onPress={() => void onVerify()}
            />

            <Pressable
              style={styles.secondaryAction}
              onPress={() => void onResend()}
              disabled={loading || resending}
            >
              {resending ? (
                <ActivityIndicator color={theme.colors.primary} />
              ) : (
                <Text style={[styles.secondaryActionText, { color: theme.colors.primary }]}>
                  Отправить код повторно
                </Text>
              )}
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
  infoText: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 12,
  },
  secondaryAction: {
    alignSelf: 'center',
    marginTop: 14,
    minHeight: 24,
    justifyContent: 'center',
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
