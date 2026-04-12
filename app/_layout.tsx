import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';

import { ThemeProvider, useTheme } from '@/src/theme/ThemeProvider';
import { initializeDatabase } from '@/src/lib/db';
import { realtimeClient } from '@/src/lib/realtime/socket';
import {
  subscribeSessionExpired,
  subscribeSessionTokensChanged,
} from '@/src/lib/auth/session';
import { useAuthStore } from '@/src/state/auth';
import {
  registerNativePushToken,
  unregisterCurrentPushToken,
} from '@/src/lib/push/register';
import { getNotificationPrefs } from '@/src/lib/local/notificationPrefs';
import {
  extractChatUuidFromRealtimeEvent,
  extractMessageFromRealtimeEvent,
  isMessageEvent,
} from '@/src/lib/realtime/events';

const queryClient = new QueryClient();

function RootNavigator() {
  const { theme } = useTheme();

  return (
    <>
      <StatusBar
        style={theme.blurTint === 'dark' ? 'light' : 'dark'}
        backgroundColor={theme.colors.background}
      />

      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const router = useRouter();
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const logout = useAuthStore((s) => s.logout);
  const setTokens = useAuthStore((s) => s.setTokens);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthStore((s) => s.hydrated);
  const userUuid = useAuthStore((s) => s.user?.uuid);
  const [appReady, setAppReady] = useState(false);

  const extractChatUuidFromNotification = (response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data as Record<string, unknown> | undefined;
    const chatUuid = data?.chat_uuid;
    return typeof chatUuid === 'string' && chatUuid.trim() ? chatUuid : null;
  };

  useEffect(() => {
    const unsubscribeExpired = subscribeSessionExpired(() => {
      void unregisterCurrentPushToken();
      void logout();
    });

    const unsubscribeTokens = subscribeSessionTokensChanged(
      ({ accessToken, refreshToken }) => {
        void setTokens({ accessToken, refreshToken });
      }
    );

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
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const chatUuid = extractChatUuidFromNotification(response);
      if (!chatUuid) return;
      router.push({
        pathname: '/(app)/chat/[chatUuid]',
        params: { chatUuid },
      });
    });

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;
        const chatUuid = extractChatUuidFromNotification(response);
        if (!chatUuid) return;
        router.push({
          pathname: '/(app)/chat/[chatUuid]',
          params: { chatUuid },
        });
      })
      .catch(() => undefined);

    return () => {
      subscription.remove();
    };
  }, [router]);

  useEffect(() => {
    if (!appReady || !hydrated) {
      return;
    }

    if (accessToken) {
      realtimeClient.connect(accessToken);
      void getNotificationPrefs().then((prefs) => {
        if (prefs.pushEnabled) {
          void registerNativePushToken();
        } else {
          void unregisterCurrentPushToken();
        }
      });

      return () => {
        realtimeClient.disconnect();
      };
    }

    realtimeClient.disconnect();
    void unregisterCurrentPushToken();
  }, [appReady, hydrated, accessToken]);

  useEffect(() => {
    if (!accessToken) return;

    const unsubscribe = realtimeClient.subscribe((event) => {
      if (!isMessageEvent(event)) return;
      const message = extractMessageFromRealtimeEvent(event);
      if (!message) return;
      if (message.is_own_message) return;
      if (message.sender?.uuid && userUuid && message.sender.uuid === userUuid) return;

      const chatUuid = extractChatUuidFromRealtimeEvent(event);
      if (!chatUuid) return;

      const title =
        message.sender?.full_name ||
        message.sender?.username ||
        'Новое сообщение';
      const body = message.text?.trim() || 'Медиа сообщение';

      void Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            chat_uuid: chatUuid,
            message_uuid: message.uuid,
          },
          sound: true,
        },
        trigger: null,
      });
    });

    return () => {
      unsubscribe();
    };
  }, [accessToken, userUuid]);

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
          <RootNavigator />
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
