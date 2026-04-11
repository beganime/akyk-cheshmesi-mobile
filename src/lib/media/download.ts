import { Linking, Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

type DownloadRemoteFileParams = {
  url: string;
  filename?: string | null;
  contentType?: string | null;
  shareDialogTitle?: string;
};

function sanitizeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').trim();
}

function inferFilenameFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const lastPart = pathname.split('/').filter(Boolean).pop();

    if (lastPart) {
      return sanitizeFilename(lastPart);
    }
  } catch {
    // ignore malformed URLs
  }

  return `file-${Date.now()}`;
}

export async function downloadAndShareRemoteFile({
  url,
  filename,
  contentType,
  shareDialogTitle = 'Скачать файл',
}: DownloadRemoteFileParams): Promise<string> {
  if (!url) {
    throw new Error('Empty file url');
  }

  if (Platform.OS === 'web') {
    await Linking.openURL(url);
    return url;
  }

  const targetDirectory = new Directory(Paths.cache, 'chat-downloads');
  targetDirectory.create({ idempotent: true, intermediates: true });

  const safeName = sanitizeFilename(filename?.trim() || inferFilenameFromUrl(url));
  const targetFile = new File(targetDirectory, safeName);

  const downloadedFile = await File.downloadFileAsync(url, targetFile, {
    idempotent: true,
  });

  const sharingAvailable = await Sharing.isAvailableAsync();

  if (sharingAvailable) {
    await Sharing.shareAsync(downloadedFile.uri, {
      dialogTitle: shareDialogTitle,
      mimeType: contentType || undefined,
    });
  }

  return downloadedFile.uri;
}