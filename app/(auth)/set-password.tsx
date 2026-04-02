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
import { setPasswordRequest } from '@/src/lib/api/auth';
import { useAuthStore } from '@/src/state/auth';
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

export default function SetPasswordScreen() {
  const { theme } = useTheme();
  const setSession = useAuthStore((s) => s.setSession);
  const params = useLocalSearchParams<{
    email?: string | string[];
    verificationToken?: string | string[];
  }>();

  const email = useMemo(() => getFirstParam(params.email).trim().toLowerCase(), [params.email]);
  const verificationToken = useMemo(
    () => getFirstParam(params.verificationToken).trim(),
    [params.verificationToken],
  );

  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const onFinish = async () => {
    if (!verificationToken) {
      Alert.alert('Ошибка', 'Не найден verification token. Повтори подтверждение email.');
      return;
    }

    if (!username.trim()) {
      Alert.alert('Ошибка', 'Введите username');
      return;
    }

    if (!password.trim() || !passwordConfirm.trim()) {
      Alert.alert('Ошибка', 'Введите пароль и подтверждение');
      return;
    }

    if (password !== passwordConfirm) {
      Alert.alert('Ошибка', 'Пароли не совпадают');
      return;
    }

    try {
      setLoading(true);

      const data = await setPasswordRequest({
        verificationToken,
        username,
        password,
        passwordConfirm,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        dateOfBirth: dateOfBirth.trim() || undefined,
      });

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
      Alert.alert(
        'Ошибка завершения регистрации',
        getErrorMessage(error, 'Не удалось завершить регистрацию'),
      );
    } finally {
      setLoading(false);
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
              <Ionicons name="checkmark-circle-outline" size={28} color="#FFFFFF" />
            </View>

            <Text style={styles.brandTitle}>Создание аккаунта</Text>
            <Text style={styles.brandSubtitle}>
              Заполни профиль и задай пароль, чтобы завершить регистрацию
            </Text>
          </View>

          <GlassCard>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Шаг 3 из 3</Text>
            <Text style={[styles.cardSubtitle, { color: theme.colors.muted }]}>
              {email ? `Подтверждённый email: ${email}` : 'Email уже подтверждён.'}
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
              <Ionicons name="at-outline" size={18} color={theme.colors.muted} />
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="Username"
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, { color: theme.colors.text }]}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                textContentType="username"
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
              <Ionicons name="person-outline" size={18} color={theme.colors.muted} />
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Имя"
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, { color: theme.colors.text }]}
                autoCapitalize="words"
                autoCorrect={false}
                textContentType="givenName"
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
              <Ionicons name="person-outline" size={18} color={theme.colors.muted} />
              <TextInput
                value={lastName}
                onChangeText={setLastName}
                placeholder="Фамилия"
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, { color: theme.colors.text }]}
                autoCapitalize="words"
                autoCorrect={false}
                textContentType="familyName"
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
              <Ionicons name="calendar-outline" size={18} color={theme.colors.muted} />
              <TextInput
                value={dateOfBirth}
                onChangeText={setDateOfBirth}
                placeholder="Дата рождения (YYYY-MM-DD, не обязательно)"
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, { color: theme.colors.text }]}
                autoCapitalize="none"
                autoCorrect={false}
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
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
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
              <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.muted} />
              <TextInput
                value={passwordConfirm}
                onChangeText={setPasswordConfirm}
                placeholder="Подтверждение пароля"
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, { color: theme.colors.text }]}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={() => void onFinish()}
              />
            </View>

            <Pressable onPress={() => void onFinish()} disabled={loading}>
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
                    <Text style={styles.buttonText}>Завершить регистрацию</Text>
                    <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                  </>
                )}
              </LinearGradient>
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
});