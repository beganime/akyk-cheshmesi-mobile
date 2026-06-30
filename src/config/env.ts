import Constants from 'expo-constants';

type ExtraConfig = {
  apiBaseUrl?: string;
  wsBaseUrl?: string;
  callWsBaseUrl?: string;
  callIceServers?: string | string[];
  callTurnUsername?: string;
  callTurnCredential?: string;
  pushTokenSyncPath?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;

const DEFAULT_CALL_ICE_URLS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
];
const publicEnv = {
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
  EXPO_PUBLIC_WS_BASE_URL: process.env.EXPO_PUBLIC_WS_BASE_URL,
  EXPO_PUBLIC_CALL_WS_BASE_URL: process.env.EXPO_PUBLIC_CALL_WS_BASE_URL,
  EXPO_PUBLIC_CALL_ICE_SERVERS: process.env.EXPO_PUBLIC_CALL_ICE_SERVERS,
  EXPO_PUBLIC_CALL_TURN_USERNAME: process.env.EXPO_PUBLIC_CALL_TURN_USERNAME,
  EXPO_PUBLIC_CALL_TURN_CREDENTIAL: process.env.EXPO_PUBLIC_CALL_TURN_CREDENTIAL,
};

type PublicEnvName = keyof typeof publicEnv;

function cleanBaseUrl(value?: string | null) {
  const normalized = String(value || '').trim();
  return normalized ? normalized.replace(/\/+$/, '') : undefined;
}

function readPublicRaw(name: PublicEnvName) {
  const value = publicEnv[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readPublicEnv(name: PublicEnvName) {
  return cleanBaseUrl(readPublicRaw(name));
}

function normalizeIceUrls(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function cleanTurnSecret(value?: string | null) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return undefined;
  }

  const upper = normalized.toUpperCase();
  if (
    upper.includes('PASTE_YOUR_TURN_PASSWORD_HERE') ||
    upper === 'PASTE_YOUR_TURN_USERNAME_HERE' ||
    upper === 'CHANGE_ME'
  ) {
    return undefined;
  }

  return normalized;
}

function buildCallWsBaseUrl(wsBaseUrl?: string, callWsBaseUrl?: string) {
  if (callWsBaseUrl && callWsBaseUrl.trim()) {
    return callWsBaseUrl.trim();
  }

  const base = (wsBaseUrl ?? 'wss://akyl-cheshmesi.ru/ws').trim();
  if (base.endsWith('/calls')) {
    return base;
  }
  return `${base}/calls`;
}

type CallIceServer = {
  urls: string[];
  username?: string;
  credential?: string;
};

function buildCallIceUrls(value?: string | string[]) {
  const configuredUrls = normalizeIceUrls(value);
  return configuredUrls.length > 0 ? configuredUrls : DEFAULT_CALL_ICE_URLS;
}

function buildIceServers(
  urls: string[],
  username?: string,
  credential?: string,
): CallIceServer[] {
  const stunUrls = urls.filter((item) => item.startsWith('stun:'));
  const turnUrls = urls.filter(
    (item) => item.startsWith('turn:') || item.startsWith('turns:'),
  );

  const servers: CallIceServer[] = [];

  if (stunUrls.length > 0) {
    servers.push({ urls: stunUrls });
  }

  // TURN needs real credentials. Shipping the placeholder from app.json makes
  // WebRTC try a relay that can never authenticate, so we include TURN only
  // when EAS/app config provides a valid username and credential.
  if (turnUrls.length > 0 && username && credential) {
    servers.push({
      urls: turnUrls,
      username,
      credential,
    });
  }

  return servers;
}

const apiBaseUrl =
  readPublicEnv('EXPO_PUBLIC_API_BASE_URL') ||
  cleanBaseUrl(extra.apiBaseUrl) ||
  'https://akyl-cheshmesi.ru/api/v1';
const wsBaseUrl =
  readPublicEnv('EXPO_PUBLIC_WS_BASE_URL') ||
  cleanBaseUrl(extra.wsBaseUrl) ||
  'wss://akyl-cheshmesi.ru/ws';
const callWsBaseUrl =
  readPublicEnv('EXPO_PUBLIC_CALL_WS_BASE_URL') ||
  cleanBaseUrl(extra.callWsBaseUrl);
const callIceUrls = buildCallIceUrls(
  readPublicRaw('EXPO_PUBLIC_CALL_ICE_SERVERS') || extra.callIceServers,
);
const callTurnUsername = cleanTurnSecret(
  readPublicRaw('EXPO_PUBLIC_CALL_TURN_USERNAME') || extra.callTurnUsername,
);
const callTurnCredential = cleanTurnSecret(
  readPublicRaw('EXPO_PUBLIC_CALL_TURN_CREDENTIAL') || extra.callTurnCredential,
);

export const ENV = {
  API_BASE_URL: apiBaseUrl,
  WS_BASE_URL: wsBaseUrl,
  CALL_WS_BASE_URL: buildCallWsBaseUrl(
    wsBaseUrl,
    callWsBaseUrl,
  ),
  CALL_ICE_URLS: callIceUrls,
  CALL_TURN_USERNAME: callTurnUsername,
  CALL_TURN_CREDENTIAL: callTurnCredential,
  CALL_ICE_SERVERS: buildIceServers(
    callIceUrls,
    callTurnUsername,
    callTurnCredential,
  ),
  PUSH_TOKEN_SYNC_PATH: extra.pushTokenSyncPath ?? '/push-tokens/',
};
