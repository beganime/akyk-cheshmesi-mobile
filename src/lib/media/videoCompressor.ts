export async function compressVideo(
  uri: string,
  _options?: {
    compressionMethod?: 'auto' | 'manual';
    maxSize?: number;
    bitrate?: number;
    minimumFileSizeForCompress?: number;
  },
): Promise<string> {
  return uri;
}