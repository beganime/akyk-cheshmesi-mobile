import { apiClient } from '@/src/lib/api/client';
import type {
  BotCreatePayload,
  BotItem,
  BotSendMessagePayload,
  BotSendMessageResponse,
  BotUpdatePayload,
  ChatBotMembership,
  PaginatedBotsResponse,
} from '@/src/types/bots';

function normalizeBotsResponse(data: BotItem[] | PaginatedBotsResponse) {
  if (Array.isArray(data)) {
    return data;
  }

  return Array.isArray(data?.results) ? data.results : [];
}

function normalizeChatBotsResponse(
  data: ChatBotMembership[] | { results?: ChatBotMembership[] },
) {
  if (Array.isArray(data)) {
    return data;
  }

  return Array.isArray(data?.results) ? data.results : [];
}

export async function fetchBots(): Promise<BotItem[]> {
  const response = await apiClient.get<BotItem[] | PaginatedBotsResponse>('/bots/');
  return normalizeBotsResponse(response.data);
}

export async function createBot(payload: BotCreatePayload): Promise<BotItem> {
  const response = await apiClient.post<BotItem>('/bots/', payload);
  return response.data;
}

export async function fetchBotDetail(botUuid: string): Promise<BotItem> {
  const response = await apiClient.get<BotItem>(`/bots/${botUuid}/`);
  return response.data;
}

export async function updateBot(
  botUuid: string,
  payload: BotUpdatePayload,
): Promise<BotItem> {
  const response = await apiClient.patch<BotItem>(`/bots/${botUuid}/`, payload);
  return response.data;
}

export async function deleteBot(botUuid: string) {
  const response = await apiClient.delete(`/bots/${botUuid}/`);
  return response.data;
}

export async function rotateBotToken(botUuid: string): Promise<BotItem> {
  const response = await apiClient.post<BotItem>(`/bots/${botUuid}/rotate-token/`);
  return response.data;
}

export async function fetchChatBots(chatUuid: string): Promise<ChatBotMembership[]> {
  const response = await apiClient.get<
    ChatBotMembership[] | { results?: ChatBotMembership[] }
  >(`/chats/${chatUuid}/bots/`);

  return normalizeChatBotsResponse(response.data);
}

export async function addBotToChat(
  chatUuid: string,
  botUuid: string,
): Promise<ChatBotMembership> {
  const response = await apiClient.post<ChatBotMembership>(
    `/chats/${chatUuid}/bots/`,
    { bot_uuid: botUuid },
  );

  return response.data;
}

export async function removeBotFromChat(chatUuid: string, botUuid: string) {
  const response = await apiClient.delete(`/chats/${chatUuid}/bots/${botUuid}/`);
  return response.data;
}

export async function sendMessageAsBot(
  botToken: string,
  payload: BotSendMessagePayload,
): Promise<BotSendMessageResponse> {
  const response = await apiClient.post<BotSendMessageResponse>(
    '/bots/send-message/',
    {
      message_type: 'text',
      ...payload,
    },
    {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    },
  );

  return response.data;
}
