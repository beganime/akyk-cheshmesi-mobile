export type RealtimeEvent = {
  type: string;
  payload?: Record<string, unknown> | null;
  raw?: unknown;
};