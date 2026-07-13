import { useMemo, useState } from 'react';
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
import { setPasswordRequest } from '@/src/lib/api/auth';
import { updateMe } from '@/src/lib/api/users';
import { useAuthStore } from '@/src/state/auth';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getApiErrorMessage } from '@/src/utils/apiErrors';

function getFirstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

function isValidUsername(value: string) {
  return /^[a-zA-Z0-9_.]{4,32}$/.test(value);
}

export default function SetPasswordScreen() {
  const { theme } = useTheme();
  const setSession = useAuthStore((s) => s.setSession);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
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
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordConfirmVisible, setPasswordConfirmVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [accountCreated, setAccountCreated] = useState(false);

  const normalizedPhoneNumber = `+${phoneNumber.replace(/\D/g, '')}`;

  const clearError = () => {
    if (errorMessage) setErrorMessage(null);
  };

  const onFinish = async () => {
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedDateOfBirth = dateOfBirth.trim();

    setErrorMessage(null);

    if (!/^\+\d{7,15}$/.test(normalizedPhoneNumber)) {
      setErrorMessage('Введите номер телефона в международном формате, например +993 61 123456');
      return;
    }

    if (!verificationToken) {
      setErrorMessage('Не найден токен подтверждения. Повторите подтверждение email');
      return;
    }

    if (!normalizedUsername) {
      setErrorMessage('Введите username');
      return;
    }

    if (!isValidUsername(normalizedUsername)) {
      setErrorMessage('Username должен быть 4-32 символа: буквы, цифры, _ или .');
      return;
    }

    if (!password || !passwordConfirm) {
      setErrorMessage('Введите пароль и подтверждение');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Пароль должен быть не короче 8 символов');
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage('Пароли не совпадают');
      return;
    }

    try {
      setLoading(true);

      if (accountCreated) {
        await updateMe({ phone_number: normalizedPhoneNumber });
        await refreshProfile();
        router.replace('/(app)/(tabs)/chats');
        return;
      }

      const data = await setPasswordRequest({
        verificationToken,
        username: normalizedUsername,
        password,
        passwordConfirm,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        dateOfBirth: normalizedDateOfBirth || undefined,
      });

      const accessToken = data?.tokens?.access;
      const refreshToken = data?.tokens?.refresh;
      const user = data?.user ?? null;

      if (!accessToken) {
        setErrorMessage('Сервер не вернул токен доступа. Попробуйте войти вручную');
        return;
      }

      await setSession({
        accessToken,
        refreshToken,
        user,
      });

      setAccountCreated(true);

      try {
        await updateMe({ phone_number: normalizedPhoneNumber });
        await refreshProfile();
      } catch (phoneError) {
        setErrorMessage(
          getApiErrorMessage(
            phoneError,
            'Аккаунт создан, но номер телефона не сохранился. Проверьте номер и повторите привязку.',
          ),
        );
        return;
      }

      router.replace('/(app)/(tabs)/chats');
    } catch (error: any) {
      setErrorMessage(getApiErrorMessage(error, 'Не удалось завершить регистрацию'));
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
            icon="checkmark-circle-outline"
            title="Создание аккаунта"
            subtitle="Заполните профиль и задайте пароль"
          />

          <GlassCard>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Шаг 3 из 3</Text>
            <Text style={[styles.cardSubtitle, { color: theme.colors.muted }]}>
              {email ? `Подтверждённый email: ${email}` : 'Email уже подтверждён.'}
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
              <Ionicons name="call-outline" size={18} color={theme.colors.muted} />
              <TextInput
                value={phoneNumber}
                onChangeText={(value) => {
                  setPhoneNumber(value);
                  clearError();
                }}
                placeholder="Телефон, например +993 61 123456"
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, { color: theme.colors.text }]}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
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
              <Ionicons name="at-outline" size={18} color={theme.colors.muted} />
              <TextInput
                value={username}
                onChangeText={(value) => {
                  setUsername(value);
                  clearError();
                }}
                placeholder="Username"
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, { color: theme.colors.text }]}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                textContentType="username"
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
              <Ionicons name="person-outline" size={18} color={theme.colors.muted} />
              <TextInput
                value={firstName}
                onChangeText={(value) => {
                  setFirstName(value);
                  clearError();
                }}
                placeholder="Имя"
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, { color: theme.colors.text }]}
                autoCapitalize="words"
                autoCorrect={false}
                textContentType="givenName"
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
              <Ionicons name="person-outline" size={18} color={theme.colors.muted} />
              <TextInput
                value={lastName}
                onChangeText={(value) => {
                  setLastName(value);
                  clearError();
                }}
                placeholder="Фамилия"
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, { color: theme.colors.text }]}
                autoCapitalize="words"
                autoCorrect={false}
                textContentType="familyName"
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
              <Ionicons name="calendar-outline" size={18} color={theme.colors.muted} />
              <TextInput
                value={dateOfBirth}
                onChangeText={(value) => {
                  setDateOfBirth(value);
                  clearError();
                }}
                placeholder="Дата рождения (YYYY-MM-DD, необязательно)"
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, { color: theme.colors.text }]}
                autoCapitalize="none"
                autoCorrect={false}
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
                  clearError();
                }}
                placeholder="Пароль"
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, { color: theme.colors.text }]}
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
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
                onChangeText={(value) => {
                  setPasswordConfirm(value);
                  clearError();
                }}
                placeholder="Подтверждение пароля"
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, { color: theme.colors.text }]}
                secureTextEntry={!passwordConfirmVisible}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={() => void onFinish()}
                editable={!loading}
              />
              <Pressable
                onPress={() => setPasswordConfirmVisible((value) => !value)}
                hitSlop={10}
                style={styles.eyeButton}
                disabled={loading}
              >
                <Ionicons
                  name={passwordConfirmVisible ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.colors.muted}
                />
              </Pressable>
            </View>

            <AuthPrimaryButton
              title={accountCreated ? 'Привязать телефон' : 'Завершить регистрацию'}
              icon="checkmark"
              loading={loading}
              disabled={loading}
              onPress={() => void onFinish()}
            />
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
  eyeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
