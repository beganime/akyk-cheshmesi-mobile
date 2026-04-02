type SessionExpiredListener = () => void;

const listeners = new Set<SessionExpiredListener>();

export function subscribeSessionExpired(listener: SessionExpiredListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function notifySessionExpired() {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.error('session expired listener error:', error);
    }
  }
}