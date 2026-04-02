import type { MessageItem } from '@/src/types/message';

function timeValue(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function mergeMessages(serverMessages: MessageItem[], localMessages: MessageItem[]) {
  const merged = new Map<string, MessageItem>();

  for (const message of localMessages) {
    const key = message.client_uuid || message.uuid;
    merged.set(key, message);
  }

  for (const message of serverMessages) {
    const key = message.client_uuid || message.uuid;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        ...message,
        local_status: 'sent',
      });
      continue;
    }

    merged.set(key, {
      ...existing,
      ...message,
      local_status: message.local_status ?? (existing.local_status === 'failed' ? 'failed' : 'sent'),
    });
  }

  return Array.from(merged.values()).sort((a, b) => {
    return timeValue(a.created_at) - timeValue(b.created_at);
  });
}