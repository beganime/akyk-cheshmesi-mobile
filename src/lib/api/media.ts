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

function normalizeDurationSeconds(raw?: number | null): number | undefined {
  const value = Number(raw);

  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  if (value > 1000) {
    return Math.max(1, Math.ceil(value / 1000));
  }

  return Math.max(1, Math.ceil(value));
}

function extractBackendDetail(error: any): string {
  const data = error?.response?.data;

  if (!data) {
    return '';
  }

  if (typeof data.detail === 'string') {
    return data.detail;
  }

  if (typeof data === 'string') {
    return data;
  }

  try {
    return JSON.stringify(data);
  } catch {
    return '';
  }
}

async function assetToBlob(asset: PickedMediaAsset): Promise<Blob | File> {
  if (Platform.OS === 'web' && asset.file) {
    return asset.file;
  }

  const response = await fetch(asset.uri);
  return await response.blob();
}

async function readResponsePreview(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 300);
  } catch {
    return '';
  }
}

async function uploadLocal(
  asset: PickedMediaAsset,
  options: { filenamePrefix: string; fallbackContentType: string; isPublic?: boolean }
): Promise<UploadedMedia> {
  const formData = new FormData();
  const durationSeconds = normalizeDurationSeconds(asset.duration);

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

  if (durationSeconds) {
    formData.append('duration_seconds', String(durationSeconds));
  }

  const response = await apiClient.post<UploadedMedia>('/media/upload-local/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

async function uploadViaPresign(
  asset: PickedMediaAsset,
  options: { filenamePrefix: string; fallbackContentType: string; isPublic?: boolean }
): Promise<UploadedMedia> {
  const blob = await assetToBlob(asset);

  const filename = buildSafeFilename(asset, options.filenamePrefix);
  const contentType = buildContentType(asset, options.fallbackContentType);
  const durationSeconds = normalizeDurationSeconds(asset.duration);

  const presignResponse = await apiClient.post<MediaPresignResponse>('/media/presign/', {
    filename,
    content_type: contentType,
    size: asset.fileSize || blob.size,
    is_public: Boolean(options.isPublic),
    ...(durationSeconds ? { duration_seconds: durationSeconds } : {}),
  });

  const presignData = presignResponse.data;

  if (!presignData?.media?.uuid || !presignData?.upload?.url) {
    throw new Error('Invalid presign response');
  }

  const uploadHeaders: Record<string, string> = {
    ...(presignData.upload.headers || {}),
  };

  if (!uploadHeaders['Content-Type'] && !uploadHeaders['content-type']) {
    uploadHeaders['Content-Type'] = contentType;
  }

  const putResponse = await fetch(presignData.upload.url, {
    method: presignData.upload.method || 'PUT',
    headers: uploadHeaders,
    body: blob,
  });

  if (!putResponse.ok) {
    const preview = await readResponsePreview(putResponse);
    throw new Error(
      `S3 upload failed with status ${putResponse.status}${preview ? `: ${preview}` : ''}`
    );
  }

  const completeResponse = await apiClient.post<UploadedMedia>('/media/complete/', {
    media_uuid: presignData.media.uuid,
  });

  return completeResponse.data;
}

function shouldFallbackToLocalUpload(error: any): boolean {
  const status = Number(error?.response?.status || 0);
  const detail = extractBackendDetail(error).toLowerCase();

  return (
    detail.includes('use_s3 is disabled') ||
    detail.includes('use /api/v1/media/upload-local/') ||
    status === 404 ||
    status === 405
  );
}

export async function uploadPickedMedia(
  asset: PickedMediaAsset,
  options: { filenamePrefix: string; fallbackContentType: string; isPublic?: boolean }
): Promise<UploadedMedia> {
  try {
    return await uploadViaPresign(asset, options);
  } catch (error: any) {
    if (shouldFallbackToLocalUpload(error)) {
      return await uploadLocal(asset, options);
    }

    throw error;
  }
}

export async function uploadPickedImage(asset: PickedMediaAsset): Promise<UploadedMedia> {
  return await uploadPickedMedia(asset, {
    filenamePrefix: 'photo',
    fallbackContentType: 'image/jpeg',
    isPublic: false,
  });
}

export async function uploadPickedVideo(asset: PickedMediaAsset): Promise<UploadedMedia> {
  return await uploadPickedMedia(asset, {
    filenamePrefix: 'video',
    fallbackContentType: 'video/mp4',
    isPublic: false,
  });
}

export async function uploadPickedAudio(asset: PickedMediaAsset): Promise<UploadedMedia> {
  return await uploadPickedMedia(asset, {
    filenamePrefix: 'voice',
    fallbackContentType: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4',
    isPublic: false,
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