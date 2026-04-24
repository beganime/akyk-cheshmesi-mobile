import type { RealtimeEvent } from '@/src/types/realtime';

export type CallRealtimePayload = {
  callUuid: string | null;
  chatUuid: string | null;
  roomKey: string | null;
  callType: 'audio' | 'video' | null;
  initiatedByUuid: string | null;
  initiatedByUsername: string | null;
  status: string | null;
};

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function getCallRealtimePayload(event: RealtimeEvent): CallRealtimePayload {
  const payload = (event.payload ?? {}) as Record<string, unknown>;

  return {
    callUuid: readString(payload.call_uuid),
    chatUuid: readString(payload.chat_uuid),
    roomKey: readString(payload.room_key),
    callType:
      payload.call_type === 'audio' || payload.call_type === 'video'
        ? payload.call_type
        : null,
    initiatedByUuid: readString(payload.initiated_by_uuid),
    initiatedByUsername: readString(payload.initiated_by_username),
    status: readString(payload.status),
  };
}

export function isCallInviteRealtimeEvent(event: RealtimeEvent) {
  return event.type === 'call_invite';
}

export function isCallLifecycleRealtimeEvent(event: RealtimeEvent) {
  return (
    event.type === 'call_accepted' ||
    event.type === 'call_rejected' ||
    event.type === 'call_canceled' ||
    event.type === 'call_ended'
  );
}