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

function readFromPayload(
  payload: Record<string, unknown>,
  keys: readonly string[],
) {
  for (const key of keys) {
    const value = readString(payload[key]);
    if (value) return value;
  }

  return null;
}

function readNestedObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function getCallRealtimePayload(event: RealtimeEvent): CallRealtimePayload {
  const rawEvent = event.raw && typeof event.raw === 'object' ? event.raw : {};
  const payload = {
    ...(rawEvent as Record<string, unknown>),
    ...((event.payload ?? {}) as Record<string, unknown>),
  };
  const nestedCall = readNestedObject(payload.call);
  const nestedCaller = readNestedObject(payload.caller);

  return {
    callUuid:
      readFromPayload(payload, ['call_uuid', 'callUuid']) ||
      readFromPayload(nestedCall, ['uuid', 'call_uuid', 'callUuid']),
    chatUuid:
      readFromPayload(payload, ['chat_uuid', 'chatUuid']) ||
      readFromPayload(nestedCall, ['chat_uuid', 'chatUuid']),
    roomKey:
      readFromPayload(payload, ['room_key', 'roomKey']) ||
      readFromPayload(nestedCall, ['room_key', 'roomKey']),
    callType:
      payload.call_type === 'audio' || payload.call_type === 'video'
        ? payload.call_type
        : nestedCall.call_type === 'audio' || nestedCall.call_type === 'video'
          ? nestedCall.call_type
        : null,
    initiatedByUuid:
      readFromPayload(payload, [
        'initiated_by_uuid',
        'initiatedByUuid',
        'caller_uuid',
        'callerUuid',
      ]) || readFromPayload(nestedCaller, ['uuid', 'caller_uuid', 'callerUuid']),
    initiatedByUsername:
      readFromPayload(payload, [
        'initiated_by_username',
        'initiatedByUsername',
        'caller_name',
        'callerName',
        'caller_username',
      ]) || readFromPayload(nestedCaller, ['username', 'full_name', 'name']),
    status: readFromPayload(payload, ['status']) || readFromPayload(nestedCall, ['status']),
  };
}

export function isCallInviteRealtimeEvent(event: RealtimeEvent) {
  return (
    event.type === 'call:invite' ||
    event.type === 'call_invite' ||
    event.type === 'incoming_call' ||
    event.type === 'call:incoming'
  );
}

export function isCallLifecycleRealtimeEvent(event: RealtimeEvent) {
  return (
    event.type === 'call:accept' ||
    event.type === 'call:decline' ||
    event.type === 'call:end' ||
    event.type === 'call:missed' ||
    event.type === 'call_accepted' ||
    event.type === 'call_rejected' ||
    event.type === 'call_canceled' ||
    event.type === 'call_ended'
  );
}

export function isCallTerminalRealtimeEvent(event: RealtimeEvent) {
  return (
    event.type === 'call:decline' ||
    event.type === 'call:end' ||
    event.type === 'call:missed' ||
    event.type === 'call_rejected' ||
    event.type === 'call_canceled' ||
    event.type === 'call_ended'
  );
}
