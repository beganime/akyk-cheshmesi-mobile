import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/src/theme/ThemeProvider';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { initializeDatabase } from '@/src/lib/db';
import { useAuthStore } from '@/src/state/auth';
import { realtimeClient } from '@/src/lib/realtime/socket';
import { subscribeSessionExpired } from '@/src/lib/auth/session';

const queryClient = new QueryClient();

export default function RootLayout() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const logout = useAuthStore((s) => s.logout);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthStore((s) => s.hydrated);

  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        await initializeDatabase();
        await bootstrap();
      } catch (error) {
        console.error('App bootstrap error:', error);
      } finally {
        if (mounted) {
          setAppReady(true);
        }
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [bootstrap]);

  useEffect(() => {
    const unsubscribe = subscribeSessionExpired(() => {
      void logout();
    });

    return unsubscribe;
  }, [logout]);

  useEffect(() => {
    if (!appReady || !hydrated) return;

    if (accessToken) {
      realtimeClient.connect(accessToken);

      return () => {
        realtimeClient.disconnect();
      };
    }

    realtimeClient.disconnect();
  }, [appReady, hydrated, accessToken]);

  if (!appReady) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0B1020',
          }}
        >
          <ActivityIndicator />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
          </Stack>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}