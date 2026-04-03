import { Platform } from 'react-native';

import { apiClient } from '@/src/lib/api/client';
import type { MediaPresignResponse, UploadedMedia } from '@/src/types/media';

export type PickedMediaAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  width?: number;
  height?: number;
  durationMillis?: number | null;
  file?: File;
};

function getExtensionFromName(name?: string | null) {
  if (!name) return '';
  const index = name.lastIndexOf('.');
  if (index === -1) return '';
  return name.slice(index).toLowerCase();
}

function inferMimeType(asset: PickedMediaAsset) {
  if (asset.mimeType?.trim()) {
    return asset.mimeType;
  }

  const source = `${asset.fileName || ''} ${asset.uri}`.toLowerCase();

  if (source.includes('.m4a')) return 'audio/m4a';
  if (source.includes('.aac')) return 'audio/aac';
  if (source.includes('.mp3')) return 'audio/mpeg';
  if (source.includes('.webm')) return 'audio/webm';
  if (source.includes('.mp4')) return 'video/mp4';
  if (source.includes('.mov')) return 'video/quicktime';
  if (source.includes('.jpg') || source.includes('.jpeg')) return 'image/jpeg';
  if (source.includes('.png')) return 'image/png';
  if (source.includes('.heic')) return 'image/heic';

  return 'application/octet-stream';
}

function buildSafeFilename(asset: PickedMediaAsset) {
  if (asset.fileName?.trim()) {
    return asset.fileName;
  }

  const mime = inferMimeType(asset);

  if (mime.startsWith('audio/')) {
    return `voice-${Date.now()}${getExtensionFromName(asset.fileName) || '.m4a'}`;
  }

  if (mime.startsWith('video/')) {
    return `video-${Date.now()}${getExtensionFromName(asset.fileName) || '.mp4'}`;
  }

  if (mime.startsWith('image/')) {
    return `photo-${Date.now()}${getExtensionFromName(asset.fileName) || '.jpg'}`;
  }

  return `file-${Date.now()}${getExtensionFromName(asset.fileName) || ''}`;
}

async function assetToBlob(asset: PickedMediaAsset): Promise<Blob> {
  if (Platform.OS === 'web' && asset.file) {
    return asset.file;
  }

  const response = await fetch(asset.uri);
  return await response.blob();
}

async function uploadLocal(asset: PickedMediaAsset): Promise<UploadedMedia> {
  const formData = new FormData();

  if (Platform.OS === 'web' && asset.file) {
    formData.append('file', asset.file);
  } else {
    formData.append(
      'file',
      {
        uri: asset.uri,
        name: buildSafeFilename(asset),
        type: inferMimeType(asset),
      } as any,
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

async function uploadViaPresign(asset: PickedMediaAsset): Promise<UploadedMedia> {
  const blob = await assetToBlob(asset);

  const presignResponse = await apiClient.post<MediaPresignResponse>('/media/presign/', {
    filename: buildSafeFilename(asset),
    content_type: inferMimeType(asset),
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

export async function uploadPickedMedia(asset: PickedMediaAsset): Promise<UploadedMedia> {
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

export async function uploadPickedImage(asset: PickedMediaAsset): Promise<UploadedMedia> {
  return uploadPickedMedia(asset);
}