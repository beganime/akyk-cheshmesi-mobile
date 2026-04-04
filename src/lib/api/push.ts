import { apiClient } from '@/src/lib/api/client';
import { ENV } from '@/src/config/env';

type SyncPushTokenPayload = {
  token: string;
  provider: 'expo';
  device_name?: string | null;
  platform?: string | null;
};

function normalizePath(path: string) {
  if (!path.startsWith('/')) {
    return `/${path}`;
  }
  return path;
}

export async function syncExpoPushToken(token: string): Promise<void> {
  const payload: SyncPushTokenPayload = {
    token,
    provider: 'expo',
    device_name: 'mobile-app',
    platform: 'expo',
  };

  const path = normalizePath(
    ENV.PUSH_TOKEN_SYNC_PATH ?? '/devices/push-token/',
  );

  try {
    await apiClient.post(path, payload);
  } catch (error: any) {
    const status = error?.response?.status;

    if (status === 404 || status === 405) {
      console.warn(
        `Push token sync endpoint ${path} is not implemented on backend yet.`,
      );
      return;
    }

    console.error('Failed to sync expo push token:', error);
  }
}