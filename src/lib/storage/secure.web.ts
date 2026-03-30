const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';

export async function saveTokens(accessToken: string, refreshToken?: string) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(ACCESS_KEY, accessToken);

  if (refreshToken) {
    window.localStorage.setItem(REFRESH_KEY, refreshToken);
  }
}

export async function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export async function getRefreshToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export async function clearTokens() {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}