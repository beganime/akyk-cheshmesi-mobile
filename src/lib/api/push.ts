import { Platform } from 'react-native';

import { apiClient } from '@/src/lib/api/client';
import { ENV } from '@/src/config/env';

export type PushProvider = 'fcm' | 'apns';
export type PushPlatform = 'android' | 'ios' | 'web';

export type RegisterPushTokenPayload = {
  token: string;
  provider: PushProvider;
  platform: PushPlatform;
  device_id?: string;
  device_name?: string;
  app_version?: string;
  meta?: Record<string, unknown>;
};

export type DeletePushTokenPayload =
  | {
      token: string;
      provider?: never;
      platform?: never;
      device_id?: never;
    }
  | {
      token?: string;
      provider: PushProvider;
      platform: PushPlatform;
      device_id: string;
    };

function normalizePath(path?: string) {
  const value = (path || '/push-tokens/').trim();
  if (!value.startsWith('/')) {
    return `/${value}`;
  }
  return value;
}

const PUSH_TOKEN_PATH = normalizePath(ENV.PUSH_TOKEN_SYNC_PATH);

export async function registerPushToken(payload: RegisterPushTokenPayload) {
  const response = await apiClient.post(PUSH_TOKEN_PATH, payload);
  return response.data;
}

export async function deletePushToken(payload: DeletePushTokenPayload) {
  const response = await apiClient.delete(PUSH_TOKEN_PATH, {
    data: payload,
  });
  return response.data;
}

export async function syncExpoPushToken(token: string) {
  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
  const provider = Platform.OS === 'ios' ? 'apns' : 'fcm';

  return registerPushToken({
    token,
    provider,
    platform,
    device_id: `${platform}-expo-device`,
    device_name: 'Akyl Cheshmesi Mobile',
  });
}