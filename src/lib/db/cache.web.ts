import type { ChatListItem } from '@/src/types/chat';
import type { MessageItem } from '@/src/types/message';

const CHATS_KEY = 'cache_chats_v2';
const CHAT_DETAIL_PREFIX = 'cache_chat_detail_v2_';
const CHAT_MESSAGES_PREFIX = 'cache_chat_messages_v2_';

export async function loadCachedChats(): Promise<ChatListItem[]> {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(CHATS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('loadCachedChats error:', error);
    return [];
  }
}

export async function saveCachedChats(chats: ChatListItem[]) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
  } catch (error) {
    console.error('saveCachedChats error:', error);
  }
}

export async function loadCachedChatDetail(chatUuid: string): Promise<ChatListItem | null> {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(`${CHAT_DETAIL_PREFIX}${chatUuid}`);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error('loadCachedChatDetail error:', error);
    return null;
  }
}

export async function saveCachedChatDetail(chatUuid: string, chat: ChatListItem) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(`${CHAT_DETAIL_PREFIX}${chatUuid}`, JSON.stringify(chat));
  } catch (error) {
    console.error('saveCachedChatDetail error:', error);
  }
}

export async function loadCachedChatMessages(chatUuid: string): Promise<MessageItem[]> {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(`${CHAT_MESSAGES_PREFIX}${chatUuid}`);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('loadCachedChatMessages error:', error);
    return [];
  }
}

export async function saveCachedChatMessages(chatUuid: string, messages: MessageItem[]) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(`${CHAT_MESSAGES_PREFIX}${chatUuid}`, JSON.stringify(messages));
  } catch (error) {
    console.error('saveCachedChatMessages error:', error);
  }
}