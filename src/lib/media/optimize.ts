import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { Video as VideoCompressor } from 'react-native-compressor';

import type { PickedMediaAsset } from '@/src/lib/api/media';

type OptimizeOptions = {
  fallbackContentType: string;
  filenamePrefix: string;
};

const IMAGE_MAX_DIMENSION = 1600;
const IMAGE_JPEG_QUALITY = 0.72;

const VIDEO_MAX_SIZE = 720;
const VIDEO_BITRATE = 900_000;
const VIDEO_MIN_SIZE_FOR_COMPRESS_MB = 1.5;

function normalizeMimeType(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function isImage(asset: PickedMediaAsset, fallbackContentType: string) {
  const mime = normalizeMimeType(asset.mimeType || fallbackContentType);
  return mime.startsWith('image/');
}

function isVideo(asset: PickedMediaAsset, fallbackContentType: string) {
  const mime = normalizeMimeType(asset.mimeType || fallbackContentType);
  return mime.startsWith('video/');
}

function buildJpegName(prefix: string) {
  return `${prefix}-${Date.now()}.jpg`;
}

function buildMp4Name(prefix: string) {
  return `${prefix}-${Date.now()}.mp4`;
}

function getResizeAction(asset: PickedMediaAsset) {
  const width = Number(asset.width || 0);
  const height = Number(asset.height || 0);

  if (!width || !height) {
    return [];
  }

  const maxSide = Math.max(width, height);
  if (maxSide <= IMAGE_MAX_DIMENSION) {
    return [];
  }

  if (width >= height) {
    return [{ resize: { width: IMAGE_MAX_DIMENSION } }];
  }

  return [{ resize: { height: IMAGE_MAX_DIMENSION } }];
}

async function optimizeImage(
  asset: PickedMediaAsset,
  options: OptimizeOptions,
): Promise<PickedMediaAsset> {
  if (Platform.OS === 'web') {
    return asset;
  }

  try {
    const result = await ImageManipulator.manipulateAsync(
      asset.uri,
      getResizeAction(asset),
      {
        compress: IMAGE_JPEG_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );

    return {
      ...asset,
      uri: result.uri,
      width: result.width || asset.width,
      height: result.height || asset.height,
      fileName: buildJpegName(options.filenamePrefix || 'photo'),
      mimeType: 'image/jpeg',
      fileSize: undefined,
      file: undefined,
    };
  } catch (error) {
    console.warn('optimizeImage failed, using original asset:', error);
    return asset;
  }
}

async function optimizeVideo(
  asset: PickedMediaAsset,
  options: OptimizeOptions,
): Promise<PickedMediaAsset> {
  if (Platform.OS === 'web') {
    return asset;
  }

  try {
    const compressedUri = await VideoCompressor.compress(asset.uri, {
      compressionMethod: 'manual',
      maxSize: VIDEO_MAX_SIZE,
      bitrate: VIDEO_BITRATE,
      minimumFileSizeForCompress: VIDEO_MIN_SIZE_FOR_COMPRESS_MB,
    });

    if (!compressedUri || compressedUri === asset.uri) {
      return asset;
    }

    return {
      ...asset,
      uri: compressedUri,
      fileName: buildMp4Name(options.filenamePrefix || 'video'),
      mimeType: 'video/mp4',
      fileSize: undefined,
      file: undefined,
    };
  } catch (error) {
    console.warn('optimizeVideo failed, using original asset:', error);
    return asset;
  }
}

export async function optimizePickedMediaForUpload(
  asset: PickedMediaAsset,
  options: OptimizeOptions,
): Promise<PickedMediaAsset> {
  if (isImage(asset, options.fallbackContentType)) {
    return await optimizeImage(asset, options);
  }

  if (isVideo(asset, options.fallbackContentType)) {
    return await optimizeVideo(asset, options);
  }

  return asset;
}