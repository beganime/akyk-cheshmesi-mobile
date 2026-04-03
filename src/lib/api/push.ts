import { apiClient } from '@/src/lib/api/client';

export type RegisterPushTokenPayload = {
  token: string;
  provider: 'fcm' | 'apns';
  platform: 'android' | 'ios' | 'web';
  device_id?: string;
  device_name?: string;
  app_version?: string;
  meta?: Record<string, unknown>;
};

export type DeletePushTokenPayload = {
  token?: string;
  provider?: 'fcm' | 'apns';
  platform?: 'android' | 'ios' | 'web';
  device_id?: string;
};

export async function registerPushToken(payload: RegisterPushTokenPayload) {
  const response = await apiClient.post('/push-tokens/', payload);
  return response.data;
}

export async function deletePushToken(payload: DeletePushTokenPayload) {
  const response = await apiClient.delete('/push-tokens/', {
    data: payload,
  });
  return response.data;
}