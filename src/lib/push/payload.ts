export const PUSH_CHANNELS = {
  calls: 'calls',
  messages: 'messages',
} as const;

export type PushTargetKind = 'call' | 'message' | 'story' | 'unknown';

export type ParsedPushTarget = {
  kind: PushTargetKind;
  type: string | null;
  event: string | null;
  channelId: string | null;
  chatUuid: string | null;
  messageUuid: string | null;
  callUuid: string | null;
  roomKey: string | null;
  callType: 'audio' | 'video' | null;
  callerUuid: string | null;
  callerName: string | null;
  storyUuid: string | null;
  data: Record<string, string>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(
  data: Record<string, string>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function tryParseJson(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

export function normalizePushData(input: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  const seen = new Set<unknown>();

  const visit = (value: unknown, depth = 0) => {
    if (value == null || depth > 8 || seen.has(value)) {
      return;
    }

    if (typeof value === 'string') {
      const parsed = tryParseJson(value);
      if (parsed != null) {
        visit(parsed, depth + 1);
      }
      return;
    }

    if (!isRecord(value)) {
      return;
    }

    seen.add(value);

    Object.entries(value).forEach(([key, rawValue]) => {
      if (rawValue == null) {
        return;
      }

      if (
        typeof rawValue === 'string' ||
        typeof rawValue === 'number' ||
        typeof rawValue === 'boolean'
      ) {
        result[key] = result[key] ?? String(rawValue);

        if (key === 'dataString') {
          visit(rawValue, depth + 1);
        }
        return;
      }

      if (isRecord(rawValue) || Array.isArray(rawValue)) {
        visit(rawValue, depth + 1);
      }
    });
  };

  visit(input);

  return result;
}

function normalizeCallType(value: string | null): 'audio' | 'video' | null {
  if (value === 'audio' || value === 'video') {
    return value;
  }

  return null;
}

export function parsePushTarget(input: unknown): ParsedPushTarget {
  const data = normalizePushData(input);
  const type = readString(data, ['type']);
  const event = readString(data, ['event']);
  const channelId = readString(data, ['channel_id', 'channelId', 'android_channel_id']);
  const chatUuid = readString(data, ['chat_uuid', 'chatUuid']);
  const messageUuid = readString(data, ['message_uuid', 'messageUuid']);
  const callUuid = readString(data, ['call_uuid', 'callUuid']);
  const roomKey = readString(data, ['room_key', 'roomKey']);
  const callerUuid = readString(data, ['caller_uuid', 'callerUuid']);
  const callerName = readString(data, ['caller_name', 'callerName']);
  const storyUuid = readString(data, ['story_uuid', 'storyUuid']);
  const callType = normalizeCallType(readString(data, ['call_type', 'callType']));

  const isIncomingCall =
    type === 'call' &&
    (event == null ||
      event === 'incoming_call' ||
      event === 'call:invite' ||
      event === 'call_invite');
  const isIncomingCallChannel =
    channelId === PUSH_CHANNELS.calls &&
    Boolean(callUuid) &&
    (event == null ||
      event === 'incoming_call' ||
      event === 'call:invite' ||
      event === 'call_invite');

  const kind: PushTargetKind =
    isIncomingCall || isIncomingCallChannel
      ? 'call'
      : type === 'message' || (channelId === PUSH_CHANNELS.messages && chatUuid)
        ? 'message'
        : type === 'story_reply' || type === 'story_reaction'
          ? 'story'
          : 'unknown';

  return {
    kind,
    type,
    event,
    channelId,
    chatUuid,
    messageUuid,
    callUuid,
    roomKey,
    callType,
    callerUuid,
    callerName,
    storyUuid,
    data,
  };
}

export function hasVisibleNotificationContent(input: unknown) {
  const data = normalizePushData(input);
  const title = readString(data, ['title']);
  const body = readString(data, ['body']);
  const alert = readString(data, ['alert']);

  return Boolean(title || body || alert);
}
