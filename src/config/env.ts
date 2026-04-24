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

  if (turnUrls.length > 0) {
    servers.push({
      urls: turnUrls,
      username,
      credential,
    });
  }

  return servers;
}

const callIceUrls = normalizeIceUrls(extra.callIceServers);
const callTurnUsername = extra.callTurnUsername?.trim() || undefined;
const callTurnCredential = extra.callTurnCredential?.trim() || undefined;

export const ENV = {
  API_BASE_URL: extra.apiBaseUrl ?? 'https://akyl-cheshmesi.ru/api/v1',
  WS_BASE_URL: extra.wsBaseUrl ?? 'wss://akyl-cheshmesi.ru/ws',
  CALL_WS_BASE_URL: buildCallWsBaseUrl(
    extra.wsBaseUrl,
    extra.callWsBaseUrl,
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