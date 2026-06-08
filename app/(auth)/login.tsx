import { useState } from 'react';
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
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { GlassCard } from '@/src/components/GlassCard';
import { loginRequest } from '@/src/lib/api/auth';
import { useAuthStore } from '@/src/state/auth';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getApiErrorMessage } from '@/src/utils/apiErrors';

export default function LoginScreen() {
  const { theme } = useTheme();
  const setSession = useAuthStore((s) => s.setSession);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password.trim()) {
      Alert.alert('Ошибка', 'Введите email и пароль');
      return;
    }

    try {
      setLoading(true);

      const data = await loginRequest(normalizedEmail, password);

      const accessToken = data?.tokens?.access;
      const refreshToken = data?.tokens?.refresh;
      const user = data?.user ?? null;

      if (!accessToken) {
        throw new Error('Backend did not return access token');
      }

      await setSession({
        accessToken,
        refreshToken,
        user,
      });

      router.replace('/(app)/(tabs)/chats');
    } catch (error: any) {
      Alert.alert('Ошибка входа', getApiErrorMessage(error, 'Не удалось войти'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={theme.colors.heroGradient} style={styles.gradient}>
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
              <Ionicons name="paper-plane" size={28} color="#FFFFFF" />
            </View>

            <Text style={[styles.brandTitle, { color: theme.colors.text }]}>
              Akyl Çeşmesi Messenger
            </Text>
            <Text style={[styles.brandSubtitle, { color: theme.colors.muted }]}>
              Безопасное общение для своих
            </Text>
          </View>

          <GlassCard>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Вход</Text>
            <Text style={[styles.cardSubtitle, { color: theme.colors.muted }]}>
              Войди в аккаунт и продолжи с того места, где остановился.
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
                returnKeyType="next"
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
                onChangeText={setPassword}
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
              />
              <Pressable
                onPress={() => setPasswordVisible((value) => !value)}
                hitSlop={10}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.colors.muted}
                />
              </Pressable>
            </View>

            <Pressable onPress={() => void onLogin()} disabled={loading}>
              <LinearGradient
                colors={[theme.colors.primary, '#60BDF2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.button, loading && styles.buttonDisabled]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.buttonText}>Войти</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </>
                )}
              </LinearGradient>
            </Pressable>

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
  eyeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
