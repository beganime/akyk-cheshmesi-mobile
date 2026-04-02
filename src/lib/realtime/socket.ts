import { ENV } from '@/src/config/env';
import type { RealtimeEvent } from '@/src/types/realtime';

type Listener = (event: RealtimeEvent) => void;

function appendTokenToUrl(baseUrl: string, token: string) {
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
}

class RealtimeClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<Listener>();
  private token: string | null = null;
  private shouldReconnect = false;
  private reconnectAttempts = 0;

  connect(token: string) {
    if (!ENV.WS_BASE_URL || !token) return;

    this.token = token;
    this.shouldReconnect = true;

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.open();
  }

  disconnect() {
    this.shouldReconnect = false;
    this.token = null;
    this.reconnectAttempts = 0;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: RealtimeEvent) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('realtime listener error:', error);
      }
    }
  }

  private scheduleReconnect() {
    if (!this.shouldReconnect || !this.token) return;

    const delay = Math.min(1000 * Math.max(1, this.reconnectAttempts), 5000);

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.open();
    }, delay);
  }

  private open() {
    if (!this.token || !ENV.WS_BASE_URL) return;

    try {
      const url = appendTokenToUrl(ENV.WS_BASE_URL, this.token);
      const socket = new WebSocket(url);

      this.socket = socket;

      socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.emit({
          type: 'ws_open',
          payload: null,
        });
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          const type =
            typeof parsed?.type === 'string' ? parsed.type : 'unknown_event';

          this.emit({
            type,
            payload:
              parsed && typeof parsed === 'object' && 'payload' in parsed
                ? parsed.payload
                : null,
            raw: parsed,
          });
        } catch {
          this.emit({
            type: 'unknown_event',
            payload: null,
            raw: event.data,
          });
        }
      };

      socket.onerror = () => {
        this.emit({
          type: 'ws_error',
          payload: null,
        });
      };

      socket.onclose = () => {
        this.socket = null;
        this.reconnectAttempts += 1;

        this.emit({
          type: 'ws_closed',
          payload: null,
        });

        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('realtime open error:', error);
      this.reconnectAttempts += 1;
      this.scheduleReconnect();
    }
  }
}

export const realtimeClient = new RealtimeClient();