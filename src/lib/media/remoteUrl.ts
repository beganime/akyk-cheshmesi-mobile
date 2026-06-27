import { ENV } from '@/src/config/env';

function getAppOrigin() {
  try {
    const url = new URL(ENV.API_BASE_URL);
    return url.origin;
  } catch {
    return 'https://akyl-cheshmesi.ru';
  }
}

export function normalizeRemoteMediaUrl(value?: string | null): string | null {
  const raw = String(value || '').trim();

  if (!raw) {
    return null;
  }

  if (
    raw.startsWith('http://') ||
    raw.startsWith('https://') ||
    raw.startsWith('file://') ||
    raw.startsWith('content://') ||
    raw.startsWith('data:') ||
    raw.startsWith('blob:')
  ) {
    return raw;
  }

  try {
    return new URL(raw.startsWith('/') ? raw : `/${raw}`, getAppOrigin()).toString();
  } catch {
    return raw;
  }
}
