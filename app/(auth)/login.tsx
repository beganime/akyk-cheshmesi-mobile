import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { GlassCard } from '@/src/components/GlassCard';
import { useTheme } from '@/src/theme/ThemeProvider';
import { apiClient } from '@/src/lib/api/client';
import { useAuthStore } from '@/src/state/auth';

export default function LoginScreen() {
  const { theme } = useTheme();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    try {
      setLoading(true);
      const response = await apiClient.post('/auth/login/', { email, password });
      const access = response.data?.access ?? response.data?.access_token ?? '';
      const refresh = response.data?.refresh ?? response.data?.refresh_token ?? '';

      if (!access) {
        throw new Error('Backend did not return access token');
      }

      await setTokens(access, refresh);
      router.replace('/(app)/chats');
    } catch (error: any) {
      Alert.alert('Login error', error?.message ?? 'Could not sign in');
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
          style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={theme.colors.muted}
          style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
          secureTextEntry
        />

        <Pressable onPress={onLogin} style={[styles.button, { backgroundColor: theme.colors.primary }]} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Загрузка...' : 'Войти'}</Text>
        </Pressable>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 16, marginBottom: 24 },
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
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
