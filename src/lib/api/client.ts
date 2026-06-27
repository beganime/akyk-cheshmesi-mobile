import axios, { AxiosError } from 'axios';

import { ENV } from '@/src/config/env';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveAccessToken,
  saveRefreshToken,
} from '@/src/lib/storage/secure';
import {
  notifySessionExpired,
  notifySessionTokensChanged,
} from '@/src/lib/auth/session';
import { normalizeRemoteMediaUrl } from '@/src/lib/media/remoteUrl';

type RetryableRequestConfig = {
  _retry?: boolean;
  url?: string;
  headers?: any;
  data?: unknown;
};

type RefreshResponse = {
  access: string;
  refresh?: string;
};

let isHandlingUnauthorized = false;
let refreshPromise: Promise<string | null> | null = null;

const MEDIA_URL_KEYS = new Set([
  'avatar',
  'file_url',
  'thumbnail_url',
  'image',
  'photo',
  'video',
  'audio',
  'sticker_image',
]);

function shouldIgnoreUnauthorized(url?: string) {
  if (!url) {
    return false;
  }

  return (
    url.includes('/auth/login/') ||
    url.includes('/auth/register/') ||
    url.includes('/auth/verify-email/') ||
    url.includes('/auth/set-password/') ||
    url.includes('/auth/refresh/') ||
    url.includes('/auth/password-reset/') ||
    url.includes('/auth/password-reset/confirm/')
  );
}

function setAuthorizationHeader(config: RetryableRequestConfig, token: string) {
  if (!config.headers) {
    config.headers = {};
  }

  if (typeof config.headers.set === 'function') {
    config.headers.set('Authorization', `Bearer ${token}`);
    return;
  }

  config.headers.Authorization = `Bearer ${token}`;
}

function isFormDataPayload(value: unknown): boolean {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

function removeContentTypeHeader(headers: any) {
  if (!headers) return;

  if (typeof headers.delete === 'function') {
    headers.delete('Content-Type');
    headers.delete('content-type');
    return;
  }

  delete headers['Content-Type'];
  delete headers['content-type'];
}

function normalizeApiMediaUrls(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeApiMediaUrls(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = { ...input };

  Object.keys(output).forEach((key) => {
    const current = output[key];

    if (typeof current === 'string' && MEDIA_URL_KEYS.has(key)) {
      output[key] = normalizeRemoteMediaUrl(current) || current;
      return;
    }

    if (current && typeof current === 'object') {
      output[key] = normalizeApiMediaUrls(current);
    }
  });

  return output;
}

const refreshClient = axios.create({
  baseURL: ENV.API_BASE_URL,
  timeout: 30000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const currentRefreshToken = await getRefreshToken();

    if (!currentRefreshToken) {
      return null;
    }

    try {
      const response = await refreshClient.post<RefreshResponse>('/auth/refresh/', {
        refresh: currentRefreshToken,
      });

      const nextAccessToken = response.data?.access;
      const nextRefreshToken = response.data?.refresh ?? currentRefreshToken;

      if (!nextAccessToken) {
        return null;
      }

      await saveAccessToken(nextAccessToken);

      if (nextRefreshToken) {
        await saveRefreshToken(nextRefreshToken);
      }

      notifySessionTokensChanged({
        accessToken: nextAccessToken,
        refreshToken: nextRefreshToken,
      });

      return nextAccessToken;
    } catch {
      await clearTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export const apiClient = axios.create({
  baseURL: ENV.API_BASE_URL,
  timeout: 90000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const requestConfig = config as typeof config & RetryableRequestConfig;
  const token = await getAccessToken();

  if (isFormDataPayload(requestConfig.data)) {
    removeContentTypeHeader(requestConfig.headers);
  }

  if (token) {
    setAuthorizationHeader(requestConfig, token);
  }

  return requestConfig;
});

apiClient.interceptors.response.use(
  (response) => {
    response.data = normalizeApiMediaUrls(response.data) as any;
    return response;
  },
  async (error: AxiosError) => {
    const status = error?.response?.status;
    const originalRequest = error?.config as (typeof error.config & RetryableRequestConfig) | undefined;
    const url = originalRequest?.url;

    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !shouldIgnoreUnauthorized(url)
    ) {
      originalRequest._retry = true;

      const nextAccessToken = await refreshAccessToken();

      if (nextAccessToken) {
        setAuthorizationHeader(originalRequest, nextAccessToken);
        return apiClient(originalRequest);
      }
    }

    if (status === 401 && !shouldIgnoreUnauthorized(url) && !isHandlingUnauthorized) {
      isHandlingUnauthorized = true;

      try {
        notifySessionExpired();
      } finally {
        setTimeout(() => {
          isHandlingUnauthorized = false;
        }, 500);
      }
    }

    return Promise.reject(error);
  },
);
