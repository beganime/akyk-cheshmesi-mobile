import { Video as VideoCompressor } from 'react-native-compressor';

export async function compressVideo(
  uri: string,
  options: {
    compressionMethod: 'auto' | 'manual';
    maxSize?: number;
    bitrate?: number;
    minimumFileSizeForCompress?: number;
  },
): Promise<string> {
  return await VideoCompressor.compress(uri, options);
}