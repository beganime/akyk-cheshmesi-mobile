import { Platform } from 'react-native';
import { apiClient } from '@/src/lib/api/client';

export type PickedMediaAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  width?: number;
  height?: number;
  duration?: number | null;
  file?: File;
};

export type UploadedMedia = {
  uuid: string;
  original_name?: string | null;
  content_type?: string | null;
  size?: number | null;
  media_kind?: string | null;
  storage_provider?: string | null;
  object_key?: string | null;
  status?: string | null;
  is_public?: boolean | null;
  file_url?: string | null;
  meta?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type MediaPresignResponse = {
  media: UploadedMedia;
  upload: {
    method?: string;
    url: string;
    headers?: Record<string, string>;
    expires_in_seconds?: number;
  };
};

function getFileExtensionFromMime(mimeType?: string | null): string {
  const value = String(mimeType || '').toLowerCase();

  if (value.includes('jpeg') || value.includes('jpg')) return '.jpg';
  if (value.includes('png')) return '.png';
  if (value.includes('webp')) return '.webp';
  if (value.includes('gif')) return '.gif';
  if (value.includes('mp4')) return '.mp4';
  if (value.includes('quicktime')) return '.mov';
  if (value.includes('webm')) return '.webm';
  if (value.includes('mpeg')) return '.mp3';
  if (value.includes('aac')) return '.aac';
  if (value.includes('wav')) return '.wav';
  if (value.includes('ogg')) return '.ogg';
  if (value.includes('pdf')) return '.pdf';

  return '';
}

function buildSafeFilename(asset: PickedMediaAsset, fallbackPrefix: string) {
  if (asset.fileName?.trim()) {
    return asset.fileName.trim();
  }

  const ext = getFileExtensionFromMime(asset.mimeType);
  return `${fallbackPrefix}-${Date.now()}${ext || ''}`;
}

function buildContentType(asset: PickedMediaAsset, fallback: string) {
  return asset.mimeType?.trim() || fallback;
}

async function assetToBlob(asset: PickedMediaAsset): Promise<Blob | File> {
  if (Platform.OS === 'web' && asset.file) {
    return asset.file;
  }

  const response = await fetch(asset.uri);
  return await response.blob();
}

async function uploadLocal(
  asset: PickedMediaAsset,
  options: { filenamePrefix: string; fallbackContentType: string; isPublic?: boolean }
): Promise<UploadedMedia> {
  const formData = new FormData();

  if (Platform.OS === 'web' && asset.file) {
    formData.append('file', asset.file);
  } else {
    formData.append(
      'file',
      {
        uri: asset.uri,
        name: buildSafeFilename(asset, options.filenamePrefix),
        type: buildContentType(asset, options.fallbackContentType),
      } as any
    );
  }

  formData.append('is_public', String(Boolean(options.isPublic)));

  const response = await apiClient.post<UploadedMedia>('/media/upload-local/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

async function uploadViaPresign(
  asset: PickedMediaAsset,
  options: { filenamePrefix: string; fallbackContentType: string }
): Promise<UploadedMedia> {
  const blob = await assetToBlob(asset);

  const filename = buildSafeFilename(asset, options.filenamePrefix);
  const contentType = buildContentType(asset, options.fallbackContentType);

  const presignResponse = await apiClient.post<MediaPresignResponse>('/media/presign/', {
    filename,
    content_type: contentType,
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

export async function uploadPickedMedia(
  asset: PickedMediaAsset,
  options: { filenamePrefix: string; fallbackContentType: string; isPublic?: boolean }
): Promise<UploadedMedia> {
  try {
    return await uploadLocal(asset, options);
  } catch (error: any) {
    const detail = String(error?.response?.data?.detail || '');

    if (detail.includes('USE_S3 is enabled')) {
      return await uploadViaPresign(asset, options);
    }

    throw error;
  }
}

export async function uploadPickedImage(asset: PickedMediaAsset): Promise<UploadedMedia> {
  return await uploadPickedMedia(asset, {
    filenamePrefix: 'photo',
    fallbackContentType: 'image/jpeg',
  });
}

export async function uploadPickedVideo(asset: PickedMediaAsset): Promise<UploadedMedia> {
  return await uploadPickedMedia(asset, {
    filenamePrefix: 'video',
    fallbackContentType: 'video/mp4',
  });
}

export async function uploadPickedAudio(asset: PickedMediaAsset): Promise<UploadedMedia> {
  return await uploadPickedMedia(asset, {
    filenamePrefix: 'voice',
    fallbackContentType: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4',
  });
}

export function buildMessageTypeFromMedia(media?: UploadedMedia | null):
  | 'image'
  | 'video'
  | 'audio'
  | 'file' {
  const kind = String(media?.media_kind || '').toLowerCase();
  const contentType = String(media?.content_type || '').toLowerCase();

  if (kind === 'image' || contentType.startsWith('image/')) return 'image';
  if (kind === 'video' || contentType.startsWith('video/')) return 'video';
  if (kind === 'audio' || contentType.startsWith('audio/')) return 'audio';

  return 'file';
}