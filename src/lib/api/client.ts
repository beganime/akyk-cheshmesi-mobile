import axios from 'axios';
import { ENV } from '@/src/config/env';
import { getAccessToken } from '@/src/lib/storage/secure';
import { notifySessionExpired } from '@/src/lib/auth/session';

let isHandlingUnauthorized = false;

function shouldIgnoreUnauthorized(url?: string) {
  if (!url) return false;

  return (
    url.includes('/auth/login/') ||
    url.includes('/auth/register/') ||
    url.includes('/auth/password-reset/') ||
    url.includes('/auth/password-reset/confirm/') ||
    url.includes('/auth/set-password/') ||
    url.includes('/auth/verify-email/')
  );
}

export const apiClient = axios.create({
  baseURL: ENV.API_BASE_URL,
  timeout: 20000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url as string | undefined;

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
  }
);