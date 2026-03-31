import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
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

      router.replace('/(app)/chats');
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <GlassCard>
        <Text style={[styles.title, { color: theme.colors.text }]}>Akyl Cheshmesi</Text>
        <Text style={[styles.subtitle, { color: theme.colors.muted }]}>Вход в систему</Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={theme.colors.muted}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.inputBackground,
            },
          ]}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={theme.colors.muted}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.inputBackground,
            },
          ]}
          secureTextEntry
        />

        <Pressable
          onPress={onLogin}
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Загрузка...' : 'Войти'}</Text>
        </Pressable>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  button: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});