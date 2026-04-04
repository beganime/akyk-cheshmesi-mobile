import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { syncExpoPushToken } from '@/src/lib/api/push';

const EXPO_PUSH_TOKEN_KEY = 'expo_push_token';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function getProjectId(): string | undefined {
  const easProjectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  return typeof easProjectId === 'string' ? easProjectId : undefined;
}

async function ensureAndroidChannel() {
  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function getStoredExpoPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(EXPO_PUSH_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to read stored expo push token:', error);
    return null;
  }
}

export async function saveExpoPushToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(EXPO_PUSH_TOKEN_KEY, token);
  } catch (error) {
    console.error('Failed to save expo push token:', error);
  }
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device.');
    return null;
  }

  if (Device.osName === 'Android') {
    await ensureAndroidChannel();
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const permissionResult = await Notifications.requestPermissionsAsync();
    finalStatus = permissionResult.status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Push notification permission not granted.');
    return null;
  }

  const projectId = getProjectId();
  if (!projectId) {
    console.error('EAS projectId not found. Push token cannot be requested.');
    return null;
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  const token = tokenResponse.data;
  await saveExpoPushToken(token);

  return token;
}

export async function initializeNotifications(params?: {
  isAuthenticated?: boolean;
}): Promise<void> {
  try {
    const token = await registerForPushNotificationsAsync();

    if (!token) {
      return;
    }

    if (!params?.isAuthenticated) {
      return;
    }

    await syncExpoPushToken(token);
  } catch (error) {
    console.error('initializeNotifications error:', error);
  }
}