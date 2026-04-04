import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import {
  deletePushToken,
  registerPushToken,
  type PushPlatform,
  type PushProvider,
} from '@/src/lib/api/push';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const PUSH_REGISTRATION_STORAGE_KEY = 'push_registration_v1';
const LOCAL_DEVICE_ID_STORAGE_KEY = 'push_local_device_id_v1';

type StoredPushRegistration = {
  token: string | null;
  provider: PushProvider | null;
  platform: PushPlatform | null;
  device_id: string;
};

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

function mapTokenToProvider(type: string): PushProvider {
  return type === 'ios' ? 'apns' : 'fcm';
}

function mapTokenToPlatform(type: string): PushPlatform {
  if (type === 'ios') return 'ios';
  if (type === 'android') return 'android';
  return 'web';
}

function buildFallbackDeviceId() {
  return `device-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

async function getOrCreateLocalDeviceId() {
  try {
    const existing = await AsyncStorage.getItem(LOCAL_DEVICE_ID_STORAGE_KEY);
    if (existing && existing.trim()) {
      return existing.trim();
    }

    const generated = buildFallbackDeviceId();
    await AsyncStorage.setItem(LOCAL_DEVICE_ID_STORAGE_KEY, generated);
    return generated;
  } catch (error) {
    console.error('getOrCreateLocalDeviceId error:', error);
    return buildFallbackDeviceId();
  }
}

async function readStoredRegistration(): Promise<StoredPushRegistration | null> {
  try {
    const raw = await AsyncStorage.getItem(PUSH_REGISTRATION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StoredPushRegistration;
    if (!parsed?.device_id) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('readStoredRegistration error:', error);
    return null;
  }
}

async function writeStoredRegistration(value: StoredPushRegistration) {
  try {
    await AsyncStorage.setItem(
      PUSH_REGISTRATION_STORAGE_KEY,
      JSON.stringify(value),
    );
  } catch (error) {
    console.error('writeStoredRegistration error:', error);
  }
}

function normalizeTokenValue(data: unknown) {
  if (typeof data === 'string') {
    return data.trim();
  }

  if (data == null) {
    return '';
  }

  return String(data).trim();
}

async function upsertTokenByNativeToken(tokenInfo: Notifications.DevicePushToken) {
  const tokenValue = normalizeTokenValue(tokenInfo.data);
  if (!tokenValue) {
    return null;
  }

  const provider = mapTokenToProvider(tokenInfo.type);
  const platform = mapTokenToPlatform(tokenInfo.type);
  const deviceId = await getOrCreateLocalDeviceId();

  await registerPushToken({
    token: tokenValue,
    provider,
    platform,
    device_id: deviceId,
    device_name: Device.modelName || Constants.deviceName || '',
    app_version: Constants.expoConfig?.version || '',
    meta: {
      appOwnership: Constants.appOwnership ?? null,
      executionEnvironment: Constants.executionEnvironment ?? null,
      platformOs: Platform.OS,
      platformVersion: Platform.Version,
      brand: Device.brand ?? null,
      manufacturer: Device.manufacturer ?? null,
      osName: Device.osName ?? null,
      osVersion: Device.osVersion ?? null,
      isDevice: Device.isDevice,
    },
  });

  currentRegisteredToken = tokenValue;

  await writeStoredRegistration({
    token: tokenValue,
    provider,
    platform,
    device_id: deviceId,
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
    pushTokenListenerSubscription = Notifications.addPushTokenListener(
      (nextToken) => {
        void upsertTokenByNativeToken(nextToken);
      },
    );
  }

  return tokenValue;
}

export async function unregisterCurrentPushToken() {
  const stored = await readStoredRegistration();

  const tokenToDelete = currentRegisteredToken ?? stored?.token ?? null;

  try {
    if (tokenToDelete) {
      await deletePushToken({
        token: tokenToDelete,
      });
    } else if (stored?.provider && stored.platform && stored.device_id) {
      await deletePushToken({
        provider: stored.provider,
        platform: stored.platform,
        device_id: stored.device_id,
      });
    }
  } catch (error) {
    console.error('unregisterCurrentPushToken error:', error);
  } finally {
    currentRegisteredToken = null;

    if (stored?.device_id) {
      await writeStoredRegistration({
        token: null,
        provider: stored.provider,
        platform: stored.platform,
        device_id: stored.device_id,
      });
    }
  }
}