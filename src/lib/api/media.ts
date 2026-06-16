import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

import { apiClient } from '@/src/lib/api/client';
import { optimizePickedMediaForUpload } from '@/src/lib/media/optimize';

export type PickedMediaAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  width?: number;
  height?: number;
  duration?: number | null;
  waveformData?: number[] | null;
  mediaKind?: 'image' | 'video' | 'audio' | 'file' | 'video_note' | string | null;
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
  thumbnail_url?: string | null;
  width?: number | null;
  height?: number | null;
  duration_seconds?: number | null;
  waveform_data?: number[] | null;
  meta?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type UploadProgressCallback = (progress: number) => void;

type UploadPickedMediaOptions = {
  filenamePrefix: string;
  fallbackContentType: string;
  isPublic?: boolean;
  mediaKind?: 'image' | 'video' | 'audio' | 'file' | 'video_note' | string;
  onProgress?: UploadProgressCallback;
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

function reportProgress(callback: UploadProgressCallback | undefined, value: number) {
  if (!callback) return;
  const nextValue = Math.max(0, Math.min(1, value));
  callback(nextValue);
}

function normalizeMimeType(mimeType?: string | null, fallback?: string): string {
  const value = String(mimeType || fallback || '').trim().toLowerCase();

  if (!value) return '';
  if (value === 'audio/m4a' || value === 'audio/x-m4a') return 'audio/mp4';
  if (value === 'image/jpg') return 'image/jpeg';
  if (value === 'video/mov') return 'video/quicktime';

  return value;
}

function getFileExtensionFromMime(mimeType?: string | null): string {
  const value = normalizeMimeType(mimeType);

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
  return normalizeMimeType(asset.mimeType, fallback);
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

  if (!response.ok) {
    throw new Error(`Не удалось прочитать файл: ${response.status}`);
  }

  return await response.blob();
}

function buildWebFileFromBlob(
  blob: Blob | File,
  filename: string,
  contentType: string,
): Blob | File {
  if (typeof File !== 'undefined' && !(blob instanceof File)) {
    return new File([blob], filename, {
      type: contentType || blob.type || 'application/octet-stream',
    });
  }

  return blob;
}

async function uploadBlobToSignedUrl(
  url: string,
  method: string,
  body: Blob | File,
  headers?: Record<string, string>,
  onProgress?: UploadProgressCallback,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open(method || 'PUT', url);

    Object.entries(headers || {}).forEach(([key, value]) => {
      if (value) {
        xhr.setRequestHeader(key, value);
      }
    });

    xhr.onload = () => {
      const status = xhr.status || 0;

      if (status >= 200 && status < 300) {
        resolve();
        return;
      }

      reject(
        new Error(
          `S3 upload failed with status ${status}${xhr.responseText ? `: ${xhr.responseText}` : ''}`,
        ),
      );
    };

    xhr.onerror = () => {
      reject(new Error('S3 upload network error'));
    };

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !event.total) return;
      reportProgress(onProgress, event.loaded / event.total);
    };

    xhr.ontimeout = () => {
      reject(new Error('S3 upload timeout'));
    };

    xhr.timeout = 90000;
    xhr.send(body as any);
  });
}

async function getNativeFileSize(uri: string): Promise<number | undefined> {
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true } as any);
    const size = Number((info as any)?.size || 0);

    if ((info as any)?.exists && Number.isFinite(size) && size > 0) {
      return size;
    }
  } catch (error) {
    console.warn('getNativeFileSize failed:', error);
  }

  return undefined;
}

async function getAssetUploadSize(asset: PickedMediaAsset): Promise<number | undefined> {
  const explicitSize = Number(asset.fileSize || 0);

  if (Number.isFinite(explicitSize) && explicitSize > 0) {
    return explicitSize;
  }

  if (Platform.OS !== 'web') {
    return await getNativeFileSize(asset.uri);
  }

  try {
    const blob = await assetToBlob(asset);
    const blobSize = Number(blob.size || 0);

    return Number.isFinite(blobSize) && blobSize > 0 ? blobSize : undefined;
  } catch {
    return undefined;
  }
}

async function uploadFileUriToSignedUrl(
  url: string,
  method: string,
  fileUri: string,
  headers?: Record<string, string>,
  onProgress?: UploadProgressCallback,
): Promise<void> {
  reportProgress(onProgress, 0.05);

  const result = await FileSystem.uploadAsync(url, fileUri, {
    httpMethod: (method || 'PUT') as any,
    headers: headers || {},
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(
      `S3 upload failed with status ${result.status}${result.body ? `: ${result.body}` : ''}`,
    );
  }

  reportProgress(onProgress, 1);
}

async function appendFileToFormData(
  formData: FormData,
  asset: PickedMediaAsset,
  options: {
    filenamePrefix: string;
    fallbackContentType: string;
  },
) {
  const filename = buildSafeFilename(asset, options.filenamePrefix);
  const contentType = buildContentType(asset, options.fallbackContentType);

  if (Platform.OS === 'web') {
    const blob = await assetToBlob(asset);
    const file = buildWebFileFromBlob(blob, filename, contentType);

    formData.append('file', file, filename);
    return;
  }

  formData.append(
    'file',
    {
      uri: asset.uri,
      name: filename,
      type: contentType || 'application/octet-stream',
    } as any,
  );
}

async function uploadLocal(
  asset: PickedMediaAsset,
  options: UploadPickedMediaOptions,
): Promise<UploadedMedia> {
  const formData = new FormData();
  const durationSeconds = normalizeDurationSeconds(asset.duration);

  await appendFileToFormData(formData, asset, {
    filenamePrefix: options.filenamePrefix,
    fallbackContentType: options.fallbackContentType,
  });

  formData.append('is_public', String(Boolean(options.isPublic)));

  const mediaKind = asset.mediaKind || options.mediaKind;
  if (mediaKind) {
    formData.append('media_kind', String(mediaKind));
  }

  if (durationSeconds) {
    formData.append('duration_seconds', String(durationSeconds));
  }

  if (asset.width) {
    formData.append('width', String(asset.width));
  }

  if (asset.height) {
    formData.append('height', String(asset.height));
  }

  if (Array.isArray(asset.waveformData) && asset.waveformData.length) {
    formData.append('waveform_data', JSON.stringify(asset.waveformData));
  }

  const response = await apiClient.post<UploadedMedia>('/media/upload-local/', formData, {
    timeout: 90000,
    headers: {
      Accept: 'application/json',
    },
    onUploadProgress: (event) => {
      if (!event.total) return;
      reportProgress(options.onProgress, event.loaded / event.total);
    },
  });

  reportProgress(options.onProgress, 1);

  return response.data;
}

async function uploadViaPresign(
  asset: PickedMediaAsset,
  options: UploadPickedMediaOptions,
): Promise<UploadedMedia> {
  const filename = buildSafeFilename(asset, options.filenamePrefix);
  const contentType = buildContentType(asset, options.fallbackContentType);
  const durationSeconds = normalizeDurationSeconds(asset.duration);
  const uploadSize = await getAssetUploadSize(asset);

  const presignResponse = await apiClient.post<MediaPresignResponse>('/media/presign/', {
    filename,
    content_type: contentType,
    ...(uploadSize ? { size: uploadSize } : {}),
    is_public: Boolean(options.isPublic),
    ...(asset.mediaKind || options.mediaKind
      ? { media_kind: asset.mediaKind || options.mediaKind }
      : {}),
    ...(durationSeconds ? { duration_seconds: durationSeconds } : {}),
    ...(asset.width ? { width: asset.width } : {}),
    ...(asset.height ? { height: asset.height } : {}),
    ...(Array.isArray(asset.waveformData) && asset.waveformData.length
      ? { waveform_data: asset.waveformData }
      : {}),
  });

  reportProgress(options.onProgress, 0.12);

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

  if (Platform.OS === 'web') {
    const blob = await assetToBlob(asset);

    await uploadBlobToSignedUrl(
      presignData.upload.url,
      presignData.upload.method || 'PUT',
      blob,
      uploadHeaders,
      (progress) => reportProgress(options.onProgress, 0.12 + progress * 0.74),
    );
  } else {
    await uploadFileUriToSignedUrl(
      presignData.upload.url,
      presignData.upload.method || 'PUT',
      asset.uri,
      uploadHeaders,
      (progress) => reportProgress(options.onProgress, 0.12 + progress * 0.74),
    );
  }

  const completeResponse = await apiClient.post<UploadedMedia>('/media/complete/', {
    media_uuid: presignData.media.uuid,
  });

  reportProgress(options.onProgress, 1);

  return completeResponse.data;
}

function shouldFallbackToPresignUpload(error: any): boolean {
  const status = Number(error?.response?.status || 0);
  const detail = extractBackendDetail(error).toLowerCase();
  const message = String(error?.message || '').toLowerCase();

  return (
    detail.includes('s3') ||
    detail.includes('presign') ||
    detail.includes('direct upload') ||
    detail.includes('signed upload') ||
    detail.includes('/media/presign') ||
    message.includes('presign') ||
    status === 404 ||
    status === 405 ||
    status === 409 ||
    status === 501
  );
}

export async function uploadPickedMedia(
  asset: PickedMediaAsset,
  options: UploadPickedMediaOptions,
): Promise<UploadedMedia> {
  const optimizedAsset = await optimizePickedMediaForUpload(asset, {
    filenamePrefix: options.filenamePrefix,
    fallbackContentType: options.fallbackContentType,
  });

  reportProgress(options.onProgress, 0.04);

  try {
    return await uploadLocal(optimizedAsset, options);
  } catch (error: any) {
    if (shouldFallbackToPresignUpload(error)) {
      reportProgress(options.onProgress, 0.08);
      return await uploadViaPresign(optimizedAsset, options);
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

export async function fetchMediaDetail(mediaUuid: string): Promise<UploadedMedia> {
  const response = await apiClient.get<UploadedMedia>(`/media/${mediaUuid}/`);
  return response.data;
}

export async function deleteMedia(mediaUuid: string) {
  const response = await apiClient.delete(`/media/${mediaUuid}/`);
  return response.data;
}

export function buildMessageTypeFromMedia(
  media?: UploadedMedia | null,
): 'image' | 'video' | 'audio' | 'file' {
  const kind = String(media?.media_kind || '').toLowerCase();
  const contentType = String(media?.content_type || '').toLowerCase();

  if (kind === 'image' || contentType.startsWith('image/')) return 'image';
  if (kind === 'video' || contentType.startsWith('video/')) return 'video';
  if (kind === 'audio' || contentType.startsWith('audio/')) return 'audio';

  return 'file';
}
