import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';

export async function saveAccessToken(accessToken: string) {
  await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
}

export async function saveRefreshToken(refreshToken: string) {
  await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
}

export async function saveTokens(accessToken: string, refreshToken?: string | null) {
  await saveAccessToken(accessToken);

  if (typeof refreshToken === 'string' && refreshToken.length > 0) {
    await saveRefreshToken(refreshToken);
  }
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}