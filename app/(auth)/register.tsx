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
import { registerRequest } from '@/src/lib/api/auth';
import { useTheme } from '@/src/theme/ThemeProvider';

function getErrorMessage(error: any, fallback: string) {
  return error?.response?.data?.detail || error?.message || fallback;
}

export default function RegisterScreen() {
  const { theme } = useTheme();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const onRegister = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      Alert.alert('Ошибка', 'Введите email');
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
      Alert.alert('Ошибка регистрации', getErrorMessage(error, 'Не удалось отправить код'));
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
              <Ionicons name="person-add" size={28} color="#FFFFFF" />
            </View>

            <Text style={styles.brandTitle}>Регистрация</Text>
            <Text style={styles.brandSubtitle}>
              Создай аккаунт и получи код подтверждения на почту
            </Text>
          </View>

          <GlassCard>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Шаг 1 из 3</Text>
            <Text style={[styles.cardSubtitle, { color: theme.colors.muted }]}>
              Укажи email. Мы отправим на него 6-значный код подтверждения.
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
                returnKeyType="done"
                onSubmitEditing={() => void onRegister()}
              />
            </View>

            <Pressable onPress={() => void onRegister()} disabled={loading}>
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
                    <Text style={styles.buttonText}>Отправить код</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </>
                )}
              </LinearGradient>
            </Pressable>

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
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
});