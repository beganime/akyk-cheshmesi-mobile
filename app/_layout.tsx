import 'expo-dev-client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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
import { notificationTriggerForChannel } from '@/src/lib/push/channels';
import { parsePushTarget, PUSH_CHANNELS } from '@/src/lib/push/payload';
import { getNotificationPrefs } from '@/src/lib/local/notificationPrefs';
import {
  extractChatUuidFromRealtimeEvent,
  extractMessageFromRealtimeEvent,
  isMessageEvent,
} from '@/src/lib/realtime/events';
import {
  getCallRealtimePayload,
  isCallInviteRealtimeEvent,
  isCallLifecycleRealtimeEvent,
  isCallTerminalRealtimeEvent,
} from '@/src/lib/calls/realtime';
import { useCallStore } from '@/src/state/call';

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

  const loadCall = useCallStore((s) => s.loadCall);
  const remoteEnded = useCallStore((s) => s.remoteEnded);
  const currentCallUuid = useCallStore((s) => s.currentCall?.uuid);

  const [appReady, setAppReady] = useState(false);
  const recentMessagePushesRef = useRef(new Map<string, number>());
  const pendingMessageNotificationsRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );

  const openNotificationTarget = useCallback((
    payload: Notifications.Notification | Notifications.NotificationResponse,
    source: 'tap' | 'foreground',
  ) => {
    const target = parsePushTarget(payload);

    if (target.kind === 'call' && target.callUuid) {
      const callUuid = target.callUuid;

      if (currentCallUuid === callUuid) {
        return;
      }

      void loadCall(callUuid, 'incoming').finally(() => {
        router.push({
          pathname: '/(app)/call/[callUuid]',
          params: { callUuid },
        });
      });
      return;
    }

    if (source === 'foreground') {
      return;
    }

    if (
      target.kind === 'story' &&
      target.storyUuid &&
      !target.chatUuid
    ) {
      router.push({
        pathname: '/(app)/story-viewer',
        params: { storyUuid: target.storyUuid },
      });
      return;
    }

    if (target.chatUuid) {
      router.push({
        pathname: '/(app)/chat/[chatUuid]',
        params: {
          chatUuid: target.chatUuid,
          ...(target.messageUuid ? { messageUuid: target.messageUuid } : {}),
        },
      });
    }
  }, [currentCallUuid, loadCall, router]);

  useEffect(() => {
    const unsubscribeExpired = subscribeSessionExpired(() => {
      void unregisterCurrentPushToken();
      void logout();
    });

    const unsubscribeTokens = subscribeSessionTokensChanged(
      ({ accessToken, refreshToken }) => {
        void setTokens({ accessToken, refreshToken });
      },
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
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        openNotificationTarget(response, 'tap');
      },
    );
    const receivedSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        const target = parsePushTarget(notification);
        if (target.kind === 'message' && target.messageUuid) {
          recentMessagePushesRef.current.set(target.messageUuid, Date.now());
          const pending = pendingMessageNotificationsRef.current.get(target.messageUuid);
          if (pending) {
            clearTimeout(pending);
            pendingMessageNotificationsRef.current.delete(target.messageUuid);
          }
        }
        if (target.kind === 'call') {
          openNotificationTarget(notification, 'foreground');
        }
      },
    );

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;
        openNotificationTarget(response, 'tap');
      })
      .catch(() => undefined);

    return () => {
      responseSubscription.remove();
      receivedSubscription.remove();
    };
  }, [openNotificationTarget]);

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
    const pendingNotifications = pendingMessageNotificationsRef.current;

    const unsubscribe = realtimeClient.subscribe((event) => {
      if (!isMessageEvent(event)) return;
      const message = extractMessageFromRealtimeEvent(event);
      if (!message) return;
      if (message.is_own_message) return;
      if (message.sender?.uuid && userUuid && message.sender.uuid === userUuid) {
        return;
      }

      const chatUuid = extractChatUuidFromRealtimeEvent(event);
      if (!chatUuid) return;

      const messageUuid = message.uuid;
      const receivedAt = recentMessagePushesRef.current.get(messageUuid);
      if (receivedAt && Date.now() - receivedAt < 10_000) return;

      const pending = pendingMessageNotificationsRef.current.get(messageUuid);
      if (pending) clearTimeout(pending);

      const timer = setTimeout(() => {
        pendingMessageNotificationsRef.current.delete(messageUuid);
        const pushedAt = recentMessagePushesRef.current.get(messageUuid);
        if (pushedAt && Date.now() - pushedAt < 10_000) return;

        void getNotificationPrefs().then((prefs) => {
          if (!prefs.pushEnabled) return;

          const sender =
            message.sender?.full_name ||
            message.sender?.username ||
            'Новое сообщение';
          const title = prefs.previewEnabled ? sender : 'Новое сообщение';
          const body = prefs.previewEnabled
            ? message.text?.trim() || 'Медиа-сообщение'
            : 'Откройте чат, чтобы прочитать';

          void Notifications.scheduleNotificationAsync({
            content: {
              title,
              body,
              data: {
                type: 'message',
                channel_id: PUSH_CHANNELS.messages,
                chat_uuid: chatUuid,
                message_uuid: messageUuid,
              },
              sound: prefs.soundEnabled,
              priority: Notifications.AndroidNotificationPriority.HIGH,
              vibrate: prefs.vibrationEnabled ? [0, 200, 120, 200] : undefined,
            },
            trigger: notificationTriggerForChannel(PUSH_CHANNELS.messages),
          });
        });
      }, 1_800);

      pendingMessageNotificationsRef.current.set(messageUuid, timer);
    });

    return () => {
      unsubscribe();
      pendingNotifications.forEach(clearTimeout);
      pendingNotifications.clear();
    };
  }, [accessToken, userUuid]);

  useEffect(() => {
    if (!accessToken || !userUuid) return;

    const unsubscribe = realtimeClient.subscribe((event) => {
      if (isCallInviteRealtimeEvent(event)) {
        const payload = getCallRealtimePayload(event);

        if (!payload.callUuid) return;
        if (payload.initiatedByUuid && payload.initiatedByUuid === userUuid) {
          return;
        }

        void loadCall(payload.callUuid, 'incoming').then((call) => {
          if (!call) return;

          router.push({
            pathname: '/(app)/call/[callUuid]',
            params: { callUuid: call.uuid },
          });
        });

        return;
      }

      if (isCallLifecycleRealtimeEvent(event)) {
        const payload = getCallRealtimePayload(event);
        if (!payload.callUuid) return;

        if (
          currentCallUuid &&
          currentCallUuid === payload.callUuid &&
          isCallTerminalRealtimeEvent(event)
        ) {
          void remoteEnded(payload.callUuid);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [accessToken, userUuid, loadCall, remoteEnded, router, currentCallUuid]);

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
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <RootNavigator />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
