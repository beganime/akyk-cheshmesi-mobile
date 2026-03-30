import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as {
  apiBaseUrl?: string;
  wsBaseUrl?: string;
};

export const ENV = {
  API_BASE_URL: extra.apiBaseUrl ?? 'https://akyl-cheshmesi.ru/api/v1',
  WS_BASE_URL: extra.wsBaseUrl ?? 'wss://akyl-cheshmesi.ru/ws',
};