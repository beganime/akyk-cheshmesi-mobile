import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChatListItem } from '@/src/types/chat';
import type { MessageItem } from '@/src/types/message';

const CHATS_KEY = 'cache_chats_v1';
const CHAT_DETAIL_PREFIX = 'cache_chat_detail_v1_';
const CHAT_MESSAGES_PREFIX = 'cache_chat_messages_v1_';

export async function loadCachedChats(): Promise<ChatListItem[]> {
  try {
    const raw = await AsyncStorage.getItem(CHATS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('loadCachedChats error:', error);
    return [];
  }
}

export async function saveCachedChats(chats: ChatListItem[]) {
  try {
    await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(chats));
  } catch (error) {
    console.error('saveCachedChats error:', error);
  }
}

export async function loadCachedChatDetail(chatUuid: string): Promise<ChatListItem | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CHAT_DETAIL_PREFIX}${chatUuid}`);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error('loadCachedChatDetail error:', error);
    return null;
  }
}

export async function saveCachedChatDetail(chatUuid: string, chat: ChatListItem) {
  try {
    await AsyncStorage.setItem(`${CHAT_DETAIL_PREFIX}${chatUuid}`, JSON.stringify(chat));
  } catch (error) {
    console.error('saveCachedChatDetail error:', error);
  }
}

export async function loadCachedChatMessages(chatUuid: string): Promise<MessageItem[]> {
  try {
    const raw = await AsyncStorage.getItem(`${CHAT_MESSAGES_PREFIX}${chatUuid}`);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('loadCachedChatMessages error:', error);
    return [];
  }
}

export async function saveCachedChatMessages(chatUuid: string, messages: MessageItem[]) {
  try {
    await AsyncStorage.setItem(`${CHAT_MESSAGES_PREFIX}${chatUuid}`, JSON.stringify(messages));
  } catch (error) {
    console.error('saveCachedChatMessages error:', error);
  }
}