import { Platform } from 'react-native';

import { apiClient } from '@/src/lib/api/client';
import type { PickedMediaAsset } from '@/src/lib/api/media';
import type { UserProfile } from '@/src/types/user';

export type UpdateMePayload = {
  first_name?: string;
  last_name?: string;
  bio?: string;
  date_of_birth?: string | null;
  phone_number?: string;
  show_online_status?: boolean;
  avatarAsset?: PickedMediaAsset | null;
};

function hasAvatarAsset(asset?: PickedMediaAsset | null): boolean {
  return Boolean(asset && (asset.file || asset.uri));
}

function appendString(formData: FormData, key: string, value?: string | null) {
  if (value === undefined) return;
  formData.append(key, value ?? '');
}

function appendBoolean(formData: FormData, key: string, value?: boolean) {
  if (value === undefined) return;
  formData.append(key, String(value));
}

function getAvatarFilename(asset: PickedMediaAsset) {
  return asset.fileName?.trim() || `avatar-${Date.now()}.jpg`;
}

function getAvatarMimeType(asset: PickedMediaAsset) {
  const mimeType = asset.mimeType?.trim();
  if (mimeType === 'image/jpg') return 'image/jpeg';
  return mimeType || 'image/jpeg';
}

async function appendAvatar(formData: FormData, asset: PickedMediaAsset) {
  const filename = getAvatarFilename(asset);
  const mimeType = getAvatarMimeType(asset);

  if (asset.file) {
    formData.append('avatar', asset.file, filename);
    return;
  }

  if (Platform.OS === 'web') {
    const response = await fetch(asset.uri);

    if (!response.ok) {
      throw new Error(`Не удалось прочитать аватар: ${response.status}`);
    }

    const blob = await response.blob();

    if (typeof File !== 'undefined') {
      formData.append('avatar', new File([blob], filename, { type: mimeType }), filename);
      return;
    }

    formData.append('avatar', blob, filename);
    return;
  }

  formData.append(
    'avatar',
    {
      uri: asset.uri,
      name: filename,
      type: mimeType,
    } as any
  );
}

function buildJsonPayload(payload: UpdateMePayload): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  if (payload.first_name !== undefined) data.first_name = payload.first_name;
  if (payload.last_name !== undefined) data.last_name = payload.last_name;
  if (payload.bio !== undefined) data.bio = payload.bio;
  if (payload.date_of_birth !== undefined) data.date_of_birth = payload.date_of_birth;
  if (payload.phone_number !== undefined) data.phone_number = payload.phone_number;
  if (payload.show_online_status !== undefined) {
    data.show_online_status = payload.show_online_status;
  }

  return data;
}

async function buildMultipartPayload(payload: UpdateMePayload): Promise<FormData> {
  const formData = new FormData();

  appendString(formData, 'first_name', payload.first_name);
  appendString(formData, 'last_name', payload.last_name);
  appendString(formData, 'bio', payload.bio);
  appendString(formData, 'phone_number', payload.phone_number);
  appendBoolean(formData, 'show_online_status', payload.show_online_status);

  if (
    payload.date_of_birth !== undefined &&
    payload.date_of_birth !== null &&
    payload.date_of_birth.trim().length > 0
  ) {
    formData.append('date_of_birth', payload.date_of_birth.trim());
  }

  if (payload.avatarAsset) {
    await appendAvatar(formData, payload.avatarAsset);
  }

  return formData;
}

export async function updateMe(payload: UpdateMePayload): Promise<UserProfile> {
  if (hasAvatarAsset(payload.avatarAsset)) {
    const formData = await buildMultipartPayload(payload);

    const response = await apiClient.put<UserProfile>('/users/me/', formData);

    return response.data;
  }

  const response = await apiClient.put<UserProfile>(
    '/users/me/',
    buildJsonPayload(payload)
  );

  return response.data;
}
