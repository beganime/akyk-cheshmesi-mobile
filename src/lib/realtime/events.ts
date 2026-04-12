import type { RealtimeEvent } from '@/src/types/realtime';
import type { MessageItem } from '@/src/types/message';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export function extractChatUuidFromRealtimeEvent(event: RealtimeEvent): string | null {
  const payload = asRecord(event.payload);
  if (!payload) return null;

  const direct = payload.chat_uuid;
  if (typeof direct === 'string' && direct.trim()) return direct;

  const chatObj = asRecord(payload.chat);
  if (chatObj?.uuid && typeof chatObj.uuid === 'string') return chatObj.uuid;

  const messageObj = asRecord(payload.message);
  const messageChatUuid = messageObj?.chat_uuid;
  if (typeof messageChatUuid === 'string' && messageChatUuid.trim()) return messageChatUuid;

  return null;
}

export function extractMessageFromRealtimeEvent(event: RealtimeEvent): MessageItem | null {
  const payload = asRecord(event.payload);
  if (!payload) return null;
  const message = asRecord(payload.message);
  if (!message?.uuid || typeof message.uuid !== 'string') return null;
  return message as unknown as MessageItem;
}

export function isMessageEvent(event: RealtimeEvent): boolean {
  return (
    event.type.includes('message') ||
    event.type === 'chat_updated' ||
    event.type === 'chat_event'
  );
}
