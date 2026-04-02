import { Platform } from 'react-native';
import { apiClient } from '@/src/lib/api/client';
import type { MediaPresignResponse, UploadedMedia } from '@/src/types/media';

type PickedImageAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  width?: number;
  height?: number;
  file?: File;
};

function buildSafeFilename(asset: PickedImageAsset) {
  return asset.fileName || `photo-${Date.now()}.jpg`;
}

function buildContentType(asset: PickedImageAsset) {
  return asset.mimeType || 'image/jpeg';
}

async function assetToBlob(asset: PickedImageAsset): Promise<Blob> {
  if (Platform.OS === 'web' && asset.file) {
    return asset.file;
  }

  const response = await fetch(asset.uri);
  return await response.blob();
}

async function uploadLocal(asset: PickedImageAsset): Promise<UploadedMedia> {
  const formData = new FormData();

  if (Platform.OS === 'web' && asset.file) {
    formData.append('file', asset.file);
  } else {
    formData.append(
      'file',
      {
        uri: asset.uri,
        name: buildSafeFilename(asset),
        type: buildContentType(asset),
      } as any
    );
  }

  formData.append('is_public', 'false');

  const response = await apiClient.post<UploadedMedia>('/media/upload-local/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

async function uploadViaPresign(asset: PickedImageAsset): Promise<UploadedMedia> {
  const blob = await assetToBlob(asset);

  const presignResponse = await apiClient.post<MediaPresignResponse>('/media/presign/', {
    filename: buildSafeFilename(asset),
    content_type: buildContentType(asset),
    size: asset.fileSize || blob.size,
  });

  const presignData = presignResponse.data;

  const putResponse = await fetch(presignData.upload.url, {
    method: presignData.upload.method || 'PUT',
    headers: presignData.upload.headers || {},
    body: blob,
  });

  if (!putResponse.ok) {
    throw new Error(`S3 upload failed with status ${putResponse.status}`);
  }

  const completeResponse = await apiClient.post<UploadedMedia>('/media/complete/', {
    media_uuid: presignData.media.uuid,
  });

  return completeResponse.data;
}

export async function uploadPickedImage(asset: PickedImageAsset): Promise<UploadedMedia> {
  try {
    return await uploadLocal(asset);
  } catch (error: any) {
    const detail = String(error?.response?.data?.detail || '');

    if (detail.includes('USE_S3 is enabled')) {
      return await uploadViaPresign(asset);
    }

    throw error;
  }
}