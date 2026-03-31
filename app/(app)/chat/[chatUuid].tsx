import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/ThemeProvider';
import { GlassCard } from '@/src/components/GlassCard';
import { fetchChatDetail } from '@/src/lib/api/chats';
import { fetchChatMessages, markChatRead, sendChatMessage } from '@/src/lib/api/messages';
import { generateUUIDv4 } from '@/src/lib/utils/uuid';
import type { ChatListItem } from '@/src/types/chat';
import type { MessageItem } from '@/src/types/message';

function formatChatTitle(chat: ChatListItem | null) {
  return chat?.display_title || chat?.title || 'Чат';
}

function normalizeMessagesForUi(items: MessageItem[]) {
  return [...items].reverse().map((item) => ({
    ...item,
    local_status: item.local_status ?? 'sent',
  }));
}

function formatTime(dateString?: string | null) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(message: MessageItem) {
  if (!message.is_own_message) return '';

  if (message.local_status === 'pending') return 'Отправка...';
  if (message.local_status === 'failed') return 'Ошибка';

  if (message.delivery_status === 'read') return 'Прочитано';
  if (message.delivery_status === 'delivered') return 'Доставлено';

  return 'Отправлено';
}

export default function ChatScreen() {
  const { theme } = useTheme();
  const { chatUuid } = useLocalSearchParams<{ chatUuid: string }>();

  const listRef = useRef<FlatList<MessageItem>>(null);

  const [chat, setChat] = useState<ChatListItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [nextUrl, setNextUrl] = useState<string | null>(null);

  const [loadingChat, setLoadingChat] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [sending, setSending] = useState(false);

  const [draft, setDraft] = useState('');

  const latestIncomingMessage = useMemo(() => {
    const reversed = [...messages].reverse();
    return reversed.find((message) => !message.is_own_message && !message.is_deleted);
  }, [messages]);

  const loadChat = async () => {
    try {
      if (!chatUuid) return;
      const data = await fetchChatDetail(chatUuid);
      setChat(data);
    } catch (error) {
      console.error('loadChat error:', error);
    } finally {
      setLoadingChat(false);
    }
  };

  const loadInitialMessages = async () => {
    try {
      if (!chatUuid) return;

      const response = await fetchChatMessages(chatUuid);

      setMessages(normalizeMessagesForUi(response.results ?? []));
      setNextUrl(response.next ?? null);
    } catch (error) {
      console.error('loadInitialMessages error:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadEarlierMessages = async () => {
    try {
      if (!chatUuid || !nextUrl || loadingEarlier) return;

      setLoadingEarlier(true);

      const response = await fetchChatMessages(chatUuid, nextUrl);
      const olderMessages = normalizeMessagesForUi(response.results ?? []);

      setMessages((current) => [...olderMessages, ...current]);
      setNextUrl(response.next ?? null);
    } catch (error) {
      console.error('loadEarlierMessages error:', error);
    } finally {
      setLoadingEarlier(false);
    }
  };

  const syncReadState = async () => {
    try {
      if (!chatUuid || !latestIncomingMessage?.uuid) return;
      await markChatRead(chatUuid, latestIncomingMessage.uuid);
    } catch (error) {
      console.error('syncReadState error:', error);
    }
  };

  useEffect(() => {
    void loadChat();
    void loadInitialMessages();
  }, [chatUuid]);

  useEffect(() => {
    void syncReadState();
  }, [latestIncomingMessage?.uuid]);

  const handleSend = async () => {
    const text = draft.trim();

    if (!chatUuid || !text || sending) return;

    const clientUuid = generateUUIDv4();

    const optimisticMessage: MessageItem = {
      uuid: `local-${clientUuid}`,
      client_uuid: clientUuid,
      message_type: 'text',
      text,
      is_own_message: true,
      delivery_status: 'sent',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      local_status: 'pending',
      sender: chat?.peer_user
        ? undefined
        : undefined,
    };

    setDraft('');
    setSending(true);

    setMessages((current) => [...current, optimisticMessage]);

    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 50);

    try {
      const savedMessage = await sendChatMessage(chatUuid, {
        text,
        client_uuid: clientUuid,
      });

      setMessages((current) =>
        current.map((message) =>
          message.client_uuid === clientUuid
            ? {
                ...savedMessage,
                local_status: 'sent',
              }
            : message
        )
      );
    } catch (error) {
      console.error('handleSend error:', error);

      setMessages((current) =>
        current.map((message) =>
          message.client_uuid === clientUuid
            ? {
                ...message,
                local_status: 'failed',
              }
            : message
        )
      );
    } finally {
      setSending(false);
    }
  };

  const retryMessage = async (message: MessageItem) => {
    if (!chatUuid || !message.client_uuid || !message.text) return;

    setMessages((current) =>
      current.map((item) =>
        item.client_uuid === message.client_uuid
          ? {
              ...item,
              local_status: 'pending',
            }
          : item
      )
    );

    try {
      const savedMessage = await sendChatMessage(chatUuid, {
        text: message.text,
        client_uuid: message.client_uuid,
      });

      setMessages((current) =>
        current.map((item) =>
          item.client_uuid === message.client_uuid
            ? {
                ...savedMessage,
                local_status: 'sent',
              }
            : item
        )
      );
    } catch (error) {
      console.error('retryMessage error:', error);

      setMessages((current) =>
        current.map((item) =>
          item.client_uuid === message.client_uuid
            ? {
                ...item,
                local_status: 'failed',
              }
            : item
        )
      );
    }
  };

  const renderMessage = ({ item }: { item: MessageItem }) => {
    const isOwn = Boolean(item.is_own_message);

    return (
      <View
        style={[
          styles.messageRow,
          {
            justifyContent: isOwn ? 'flex-end' : 'flex-start',
          },
        ]}
      >
        <Pressable
          disabled={item.local_status !== 'failed'}
          onPress={() => void retryMessage(item)}
          style={[
            styles.bubble,
            {
              backgroundColor: isOwn ? theme.colors.primary : theme.colors.card,
              borderColor: isOwn ? 'transparent' : theme.colors.border,
              alignSelf: isOwn ? 'flex-end' : 'flex-start',
            },
          ]}
        >
          {!!item.reply_to?.text && (
            <View
              style={[
                styles.replyBox,
                {
                  borderColor: isOwn ? 'rgba(255,255,255,0.25)' : theme.colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.replyText,
                  {
                    color: isOwn ? 'rgba(255,255,255,0.85)' : theme.colors.muted,
                  },
                ]}
                numberOfLines={2}
              >
                {item.reply_to.text}
              </Text>
            </View>
          )}

          <Text
            style={[
              styles.messageText,
              {
                color: isOwn ? '#FFFFFF' : theme.colors.text,
              },
            ]}
          >
            {item.is_deleted ? 'Сообщение удалено' : item.text || ''}
          </Text>

          <View style={styles.metaRow}>
            <Text
              style={[
                styles.metaText,
                {
                  color: isOwn ? 'rgba(255,255,255,0.82)' : theme.colors.muted,
                },
              ]}
            >
              {formatTime(item.created_at)}
            </Text>

            {isOwn ? (
              <Text
                style={[
                  styles.metaText,
                  {
                    color: item.local_status === 'failed'
                      ? '#FFD6D6'
                      : 'rgba(255,255,255,0.82)',
                  },
                ]}
              >
                {statusLabel(item)}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </View>
    );
  };

  if (loadingChat || loadingMessages) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.headerButton, { borderColor: theme.colors.border }]}
          >
            <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>
              {formatChatTitle(chat)}
            </Text>
            <Text style={[styles.headerSub, { color: theme.colors.muted }]}>
              Переписка
            </Text>
          </View>

          <View style={{ width: 44 }} />
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.uuid}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={
            nextUrl ? (
              <Pressable
                onPress={() => void loadEarlierMessages()}
                style={[
                  styles.loadEarlierButton,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.card,
                  },
                ]}
              >
                <Text style={{ color: theme.colors.text, fontWeight: '600' }}>
                  {loadingEarlier ? 'Загрузка...' : 'Загрузить более ранние'}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.historyStart}>
                <Text style={{ color: theme.colors.muted }}>Начало истории</Text>
              </View>
            )
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <GlassCard>
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                  Пока пусто
                </Text>
                <Text style={[styles.emptyText, { color: theme.colors.muted }]}>
                  Отправь первое сообщение в этот чат.
                </Text>
              </GlassCard>
            </View>
          }
        />

        <View
          style={[
            styles.composerWrap,
            {
              backgroundColor: theme.colors.background,
              borderTopColor: theme.colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.composer,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Сообщение"
              placeholderTextColor={theme.colors.muted}
              style={[
                styles.input,
                {
                  color: theme.colors.text,
                },
              ]}
              multiline
              maxLength={4000}
            />

            <Pressable
              onPress={() => void handleSend()}
              disabled={!draft.trim() || sending}
              style={[
                styles.sendButton,
                {
                  backgroundColor: draft.trim()
                    ? theme.colors.primary
                    : theme.colors.inputBackground,
                },
              ]}
            >
              <Ionicons
                name="arrow-up"
                size={18}
                color={draft.trim() ? '#FFFFFF' : theme.colors.muted}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 13,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 8,
  },
  loadEarlierButton: {
    minHeight: 42,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  historyStart: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyWrap: {
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  replyBox: {
    borderLeftWidth: 3,
    paddingLeft: 10,
    marginBottom: 8,
  },
  replyText: {
    fontSize: 12,
    lineHeight: 17,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '500',
  },
  composerWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
  },
  composer: {
    minHeight: 58,
    borderRadius: 24,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    fontSize: 15,
    paddingTop: 8,
    paddingBottom: 8,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});