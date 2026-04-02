type SessionExpiredListener = () => void;

type SessionTokensChangedPayload = {
  accessToken: string;
  refreshToken?: string;
};

type SessionTokensChangedListener = (payload: SessionTokensChangedPayload) => void;

const sessionExpiredListeners = new Set<SessionExpiredListener>();
const sessionTokensChangedListeners = new Set<SessionTokensChangedListener>();

export function subscribeSessionExpired(listener: SessionExpiredListener) {
  sessionExpiredListeners.add(listener);

  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

export function notifySessionExpired() {
  for (const listener of sessionExpiredListeners) {
    try {
      listener();
    } catch (error) {
      console.error('session expired listener error:', error);
    }
  }
}

export function subscribeSessionTokensChanged(listener: SessionTokensChangedListener) {
  sessionTokensChangedListeners.add(listener);

  return () => {
    sessionTokensChangedListeners.delete(listener);
  };
}

export function notifySessionTokensChanged(payload: SessionTokensChangedPayload) {
  for (const listener of sessionTokensChangedListeners) {
    try {
      listener(payload);
    } catch (error) {
      console.error('session tokens listener error:', error);
    }
  }
}