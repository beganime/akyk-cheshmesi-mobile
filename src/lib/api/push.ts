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
const FALLBACK_PUSH_TOKEN_PATHS = [
  '/device-tokens/',
  '/notifications/device-token/',
].filter((path) => path !== PUSH_TOKEN_PATH);

function isMissingEndpointError(error: any) {
  const status = Number(error?.response?.status || 0);
  return status === 404 || status === 405;
}

async function tryPushTokenPaths<T>(
  request: (path: string) => Promise<T>,
): Promise<T> {
  const paths = [PUSH_TOKEN_PATH, ...FALLBACK_PUSH_TOKEN_PATHS];
  let lastError: unknown = null;

  for (const path of paths) {
    try {
      return await request(path);
    } catch (error) {
      lastError = error;
      if (!isMissingEndpointError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

export function isPushTokenEndpointMissing(error: unknown) {
  return isMissingEndpointError(error);
}

export async function registerPushToken(payload: RegisterPushTokenPayload) {
  const response = await tryPushTokenPaths((path) => apiClient.post(path, payload));
  return response.data;
}

export async function deletePushToken(payload: DeletePushTokenPayload) {
  const response = await tryPushTokenPaths((path) =>
    apiClient.delete(path, {
      data: payload,
    }),
  );
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
