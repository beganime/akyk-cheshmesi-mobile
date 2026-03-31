export type PresenceStatus = 'online' | 'offline';

export type PresenceDetail = {
  user_uuid: string;
  status: PresenceStatus;
  connection_count: number;
  last_seen_at: string | null;
};