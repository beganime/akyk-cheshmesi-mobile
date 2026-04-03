import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

import { deletePushToken, registerPushToken } from '@/src/lib/api/push';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let currentRegisteredToken: string | null = null;
let pushTokenListenerSubscription: Notifications.EventSubscription | null = null;

async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync('messages', {
    name: 'Messages',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 200, 120, 200],
    lightColor: '#4E7BFF',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

function mapTokenToProvider(type: string): 'fcm' | 'apns' {
  return type === 'ios' ? 'apns' : 'fcm';
}

function mapTokenToPlatform(type: string): 'android' | 'ios' | 'web' {
  if (type === 'ios') return 'ios';
  if (type === 'android') return 'android';
  return 'web';
}

async function upsertTokenByNativeToken(tokenInfo: Notifications.DevicePushToken) {
  const tokenValue = String(tokenInfo.data || '').trim();

  if (!tokenValue) {
    return null;
  }

  currentRegisteredToken = tokenValue;

  await registerPushToken({
    token: tokenValue,
    provider: mapTokenToProvider(tokenInfo.type),
    platform: mapTokenToPlatform(tokenInfo.type),
    device_name: Constants.deviceName || '',
    app_version: Constants.expoConfig?.version || '',
    meta: {
      appOwnership: Constants.appOwnership ?? null,
      executionEnvironment: Constants.executionEnvironment ?? null,
    },
  });

  return tokenValue;
}

export async function registerNativePushToken() {
  if (Platform.OS === 'web') {
    return null;
  }

  await ensureAndroidNotificationChannel();

  const existingPermissions = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermissions.status;

  if (finalStatus !== 'granted') {
    const requestedPermissions = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermissions.status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const tokenInfo = await Notifications.getDevicePushTokenAsync();
  const tokenValue = await upsertTokenByNativeToken(tokenInfo);

  if (!pushTokenListenerSubscription) {
    pushTokenListenerSubscription = Notifications.addPushTokenListener((nextToken) => {
      void upsertTokenByNativeToken(nextToken);
    });
  }

  return tokenValue;
}

export async function unregisterCurrentPushToken() {
  if (!currentRegisteredToken) {
    return;
  }

  try {
    await deletePushToken({
      token: currentRegisteredToken,
    });
  } catch (error) {
    console.error('unregisterCurrentPushToken error:', error);
  } finally {
    currentRegisteredToken = null;
  }
}