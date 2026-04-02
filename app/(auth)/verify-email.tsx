import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { registerRequest, verifyEmailRequest } from '@/src/lib/api/auth';
import { useTheme } from '@/src/theme/ThemeProvider';

function getErrorMessage(error: any, fallback: string) {
  return error?.response?.data?.detail || error?.message || fallback;
}

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

  const onVerify = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.replace(/\D/g, '').slice(0, 6);

    if (!normalizedEmail) {
      Alert.alert('Ошибка', 'Введите email');
      return;
    }

    if (normalizedCode.length !== 6) {
      Alert.alert('Ошибка', 'Введите 6-значный код');
      return;
    }

    try {
      setLoading(true);

      const data = await verifyEmailRequest(normalizedEmail, normalizedCode);
      const verificationToken = data?.verification_token;

      if (!verificationToken) {
        throw new Error('Backend did not return verification token');
      }

      router.push({
        pathname: '/(auth)/set-password',
        params: {
          email: normalizedEmail,
          verificationToken,
        },
      });
    } catch (error: any) {
      Alert.alert(
        'Ошибка подтверждения',
        getErrorMessage(error, 'Не удалось подтвердить email'),
      );
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      Alert.alert('Ошибка', 'Введите email');
      return;
    }

    try {
      setResending(true);
      await registerRequest(normalizedEmail);
      Alert.alert('Готово', 'Новый код отправлен на почту');
    } catch (error: any) {
      Alert.alert(
        'Ошибка повторной отправки',
        getErrorMessage(error, 'Не удалось отправить код повторно'),
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <LinearGradient colors={['#0B1020', '#141B32', '#1A2545']} style={styles.gradient}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={[styles.logoCircle, { backgroundColor: theme.colors.primary }]}>
              <Ionicons name="mail-open-outline" size={28} color="#FFFFFF" />
            </View>

            <Text style={styles.brandTitle}>Подтверждение email</Text>
            <Text style={styles.brandSubtitle}>
              Введи код из письма, чтобы перейти к созданию аккаунта
            </Text>
          </View>

          <GlassCard>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Шаг 2 из 3</Text>
            <Text style={[styles.cardSubtitle, { color: theme.colors.muted }]}>
              На эту почту приходит проверочный код. Если письма нет — проверь спам и отправь
              код ещё раз.
            </Text>

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
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, { color: theme.colors.text }]}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
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
                onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
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
              />
            </View>

            <Pressable onPress={() => void onVerify()} disabled={loading}>
              <LinearGradient
                colors={['#4F6BFF', '#6E7BFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.button, loading && styles.buttonDisabled]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.buttonText}>Подтвердить</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </>
                )}
              </LinearGradient>
            </Pressable>

            <Pressable style={styles.secondaryAction} onPress={() => void onResend()} disabled={resending}>
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
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 6,
  },
  brandSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 21,
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
    borderRadius: 18,
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
  button: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.9,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
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