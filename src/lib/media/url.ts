import { ENV } from '@/src/config/env';

function getApiOrigin() {
  try {
    return new URL(ENV.API_BASE_URL).origin;
  } catch {
    return '';
  }
}

export function resolveMediaUrl(url?: string | null): string | null {
  const value = String(url || '').trim();

  if (!value) {
    return null;
  }

  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('file://')) {
    return value;
  }

  if (value.startsWith('//')) {
    return `https:${value}`;
  }

  const origin = getApiOrigin();
  if (!origin) {
    return value;
  }

  return `${origin}${value.startsWith('/') ? '' : '/'}${value}`;
}
