import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ThemeProvider } from '@/src/theme/ThemeProvider';
import { initializeDatabase } from '@/src/lib/db';
import { realtimeClient } from '@/src/lib/realtime/socket';
import {
  subscribeSessionExpired,
  subscribeSessionTokensChanged,
} from '@/src/lib/auth/session';
import { useAuthStore } from '@/src/state/auth';
import { registerNativePushToken, unregisterCurrentPushToken } from '@/src/lib/push/register';

const queryClient = new QueryClient();

export default function RootLayout() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const logout = useAuthStore((s) => s.logout);
  const setTokens = useAuthStore((s) => s.setTokens);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthStore((s) => s.hydrated);

  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const unsubscribeExpired = subscribeSessionExpired(() => {
      void unregisterCurrentPushToken();
      void logout();
    });

    const unsubscribeTokens = subscribeSessionTokensChanged(({ accessToken, refreshToken }) => {
      void setTokens({ accessToken, refreshToken });
    });

    return () => {
      unsubscribeTokens();
      unsubscribeExpired();
    };
  }, [logout, setTokens]);

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
    if (!appReady || !hydrated) {
      return;
    }

    if (accessToken) {
      realtimeClient.connect(accessToken);
      void registerNativePushToken();

      return () => {
        realtimeClient.disconnect();
      };
    }

    realtimeClient.disconnect();
    void unregisterCurrentPushToken();
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