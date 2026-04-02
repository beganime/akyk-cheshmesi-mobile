import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/src/components/GlassCard';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuthStore } from '@/src/state/auth';
import { loginRequest } from '@/src/lib/api/auth';

export default function LoginScreen() {
  const { theme } = useTheme();
  const setSession = useAuthStore((s) => s.setSession);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    try {
      if (!email.trim() || !password.trim()) {
        Alert.alert('Ошибка', 'Введите email и пароль');
        return;
      }

      setLoading(true);

      const data = await loginRequest(email, password);

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
      const backendMessage =
        error?.response?.data?.detail ||
        error?.message ||
        'Не удалось войти';

      Alert.alert('Login error', backendMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#0B1020', '#141B32', '#1A2545']}
      style={styles.gradient}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <View style={styles.hero}>
            <View style={[styles.logoCircle, { backgroundColor: theme.colors.primary }]}>
              <Ionicons name="sparkles" size={28} color="#FFFFFF" />
            </View>

            <Text style={styles.brandTitle}>Akyl Cheshmesi</Text>
            <Text style={styles.brandSubtitle}>
              Быстрый, безопасный и красивый мессенджер
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
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.inputBackground,
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
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View
              style={[
                styles.inputWrap,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.inputBackground,
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
              />
            </View>

            <Pressable onPress={() => void onLogin()} disabled={loading}>
              <LinearGradient
                colors={['#4F6BFF', '#6E7BFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.button}
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

            <View style={styles.featuresRow}>
              <View style={styles.featureItem}>
                <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.primary} />
                <Text style={[styles.featureText, { color: theme.colors.muted }]}>
                  Защищённо
                </Text>
              </View>

              <View style={styles.featureItem}>
                <Ionicons name="flash-outline" size={16} color={theme.colors.primary} />
                <Text style={[styles.featureText, { color: theme.colors.muted }]}>
                  Быстро
                </Text>
              </View>

              <View style={styles.featureItem}>
                <Ionicons name="cloud-done-outline" size={16} color={theme.colors.primary} />
                <Text style={[styles.featureText, { color: theme.colors.muted }]}>
                  Синхронно
                </Text>
              </View>
            </View>
          </GlassCard>
        </View>
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
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
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
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  featuresRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 10,
  },
  featureItem: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  featureText: {
    fontSize: 12,
    fontWeight: '600',
  },
});