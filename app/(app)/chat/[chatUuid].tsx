import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/ThemeProvider';
import { GlassCard } from '@/src/components/GlassCard';
import {
  fetchChatDetail,
  setChatArchived,
  setChatMuted,
  setChatPinned,
} from '@/src/lib/api/chats';
import { createComplaint, ComplaintReason } from '@/src/lib/api/complaints';
import { uploadPickedImage } from '@/src/lib/api/media';
import { fetchChatMessages, markChatRead, sendChatMessage } from '@/src/lib/api/messages';
import { fetchStickerPackDetail, fetchStickerPacks } from '@/src/lib/api/stickers';
import { generateUUIDv4 } from '@/src/lib/utils/uuid';
import { mergeMessages } from '@/src/lib/utils/messageSync';
import type { ChatListItem } from '@/src/types/chat';
import type { MessageItem } from '@/src/types/message';
import type { StickerItem, StickerPackDetail, StickerPackListItem } from '@/src/types/sticker';

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

function getMessagePreviewText(message: MessageItem) {
  if (message.text?.trim()) return message.text;

  if (message.message_type === 'sticker') return 'Стикер';
  if (message.message_type === 'image') return 'Фото';
  if (message.message_type === 'video') return 'Видео';
  if (message.message_type === 'audio') return 'Аудио';
  if (message.message_type === 'file') return 'Файл';

  return 'Сообщение';
}

function getFirstImageUrl(message: MessageItem) {
  const imageAttachment = message.attachments?.find((item) => item.media_kind === 'image' && item.file_url);
  return imageAttachment?.file_url || null;
}

function getStickerImage(message: MessageItem) {
  const meta = message.metadata as Record<string, unknown> | null | undefined;
  const image = meta?.sticker_image;
  return typeof image === 'string' ? image : null;
}

function getStickerEmoji(message: MessageItem) {
  const meta = message.metadata as Record<string, unknown> | null | undefined;
  const emoji = meta?.sticker_emoji;
  return typeof emoji === 'string' ? emoji : '';
}

function MessageStatusIcon({
  message,
  color,
}: {
  message: MessageItem;
  color: string;
}) {
  if (!message.is_own_message) return null;

  if (message.local_status === 'failed') {
    return <Ionicons name="alert-circle" size={14} color="#FFD6D6" />;
  }

  if (message.delivery_status === 'read') {
    return <Ionicons name="ellipse" size={10} color={color} />;
  }

  if (message.local_status === 'pending') {
    return <Ionicons name="checkmark" size={14} color={color} />;
  }

  return <Ionicons name="checkmark-done" size={14} color={color} />;
}

const reportReasons: ComplaintReason[] = ['spam', 'abuse', 'fraud', 'harassment', 'other'];
const quickEmojis = ['👍', '❤️', '😂', '🔥', '🙏', '👏', '😎', '😅', '😮', '🥹', '🎉', '✅'];

export default function ChatScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { chatUuid } = useLocalSearchParams<{ chatUuid: string }>();

  const listRef = useRef<FlatList<MessageItem>>(null);
  const isNearBottomRef = useRef(true);

  const [chat, setChat] = useState<ChatListItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [nextUrl, setNextUrl] = useState<string | null>(null);

  const [loadingChat, setLoadingChat] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [sending, setSending] = useState(false);

  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<MessageItem | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [emojiVisible, setEmojiVisible] = useState(false);
  const [stickersVisible, setStickersVisible] = useState(false);

  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<MessageItem | null>(null);

  const [reportType, setReportType] = useState<'user' | 'chat'>('chat');
  const [reportReason, setReportReason] = useState<ComplaintReason>('other');
  const [reportDescription, setReportDescription] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [stickerPacks, setStickerPacks] = useState<StickerPackListItem[]>([]);
  const [selectedPackSlug, setSelectedPackSlug] = useState<string | null>(null);
  const [selectedPack, setSelectedPack] = useState<StickerPackDetail | null>(null);
  const [loadingStickers, setLoadingStickers] = useState(false);

  const latestIncomingMessage = useMemo(() => {
    const reversed = [...messages].reverse();
    return reversed.find((message) => !message.is_own_message && !message.is_deleted);
  }, [messages]);

  const scrollToBottom = (animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  };

  const refreshChat = useCallback(async () => {
    try {
      if (!chatUuid) return;
      const data = await fetchChatDetail(chatUuid);
      setChat(data);
    } catch (error) {
      console.error('refreshChat error:', error);
    }
  }, [chatUuid]);

  const refreshMessagesSilent = useCallback(async () => {
    try {
      if (!chatUuid) return;

      const response = await fetchChatMessages(chatUuid);
      const serverMessages = normalizeMessagesForUi(response.results ?? []);

      setMessages((current) => mergeMessages(serverMessages, current));
      setNextUrl(response.next ?? null);
    } catch (error) {
      console.error('refreshMessagesSilent error:', error);
    }
  }, [chatUuid]);

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

  const loadStickerPack = async (slug: string) => {
    try {
      setLoadingStickers(true);
      const data = await fetchStickerPackDetail(slug);
      setSelectedPack(data);
    } catch (error) {
      console.error('loadStickerPack error:', error);
    } finally {
      setLoadingStickers(false);
    }
  };

  const openStickerPicker = async () => {
    try {
      setStickersVisible(true);

      if (!stickerPacks.length) {
        setLoadingStickers(true);
        const packs = await fetchStickerPacks();
        setStickerPacks(packs);

        if (packs[0]?.slug) {
          setSelectedPackSlug(packs[0].slug);
          await loadStickerPack(packs[0].slug);
        } else {
          setLoadingStickers(false);
        }
      } else if (selectedPackSlug) {
        await loadStickerPack(selectedPackSlug);
      }
    } catch (error) {
      console.error('openStickerPicker error:', error);
      setLoadingStickers(false);
    }
  };

  const loadEarlierMessages = async () => {
    try {
      if (!chatUuid || !nextUrl || loadingEarlier) return;

      setLoadingEarlier(true);

      const response = await fetchChatMessages(chatUuid, nextUrl);
      const olderMessages = normalizeMessagesForUi(response.results ?? []);

      setMessages((current) => mergeMessages([...olderMessages, ...current], current));
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

  useFocusEffect(
    useCallback(() => {
      void refreshChat();
      void refreshMessagesSilent();

      const interval = setInterval(() => {
        void refreshChat();
        void refreshMessagesSilent();
      }, 2500);

      return () => clearInterval(interval);
    }, [refreshChat, refreshMessagesSilent])
  );

  useEffect(() => {
    void syncReadState();
  }, [latestIncomingMessage?.uuid]);

  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom(false);
    }
  }, [messages.length]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (layoutMeasurement.height + contentOffset.y);
    const nearBottom = distanceFromBottom < 120;

    isNearBottomRef.current = nearBottom;
    setShowScrollToBottom(!nearBottom);
  };

  const openPeerProfile = () => {
    if (!chat?.peer_user?.uuid) return;

    router.push({
      pathname: '/(app)/chat-user/[userUuid]',
      params: {
        userUuid: chat.peer_user.uuid,
        fullName: chat.peer_user.full_name || '',
        username: chat.peer_user.username || '',
        bio: chat.peer_user.bio || '',
      },
    });
  };

  const handleShareProfile = async () => {
    if (!chat?.peer_user) return;

    try {
      await Share.share({
        message: `${chat.peer_user.full_name || chat.peer_user.username || 'Пользователь'}${
          chat.peer_user.username ? ` (@${chat.peer_user.username})` : ''
        }`,
      });
    } catch (error) {
      console.error('handleShareProfile error:', error);
    }
  };

  const handleToggleMute = async () => {
    if (!chatUuid || !chat) return;

    try {
      setActionLoading(true);
      await setChatMuted(chatUuid, !Boolean(chat.is_muted));
      await refreshChat();
      setSettingsVisible(false);
    } catch (error) {
      console.error('handleToggleMute error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTogglePin = async () => {
    if (!chatUuid || !chat) return;

    try {
      setActionLoading(true);
      await setChatPinned(chatUuid, !Boolean(chat.is_pinned));
      await refreshChat();
      setSettingsVisible(false);
    } catch (error) {
      console.error('handleTogglePin error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleArchive = async () => {
    if (!chatUuid || !chat) return;

    try {
      setActionLoading(true);
      await setChatArchived(chatUuid, !Boolean(chat.is_archived));
      await refreshChat();
      setSettingsVisible(false);
      router.back();
    } catch (error) {
      console.error('handleToggleArchive error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const submitComplaint = async () => {
    if (!chatUuid) return;

    try {
      setActionLoading(true);

      if (reportType === 'user' && chat?.peer_user?.uuid) {
        await createComplaint({
          complaint_type: 'user',
          reason: reportReason,
          description: reportDescription.trim(),
          reported_user_uuid: chat.peer_user.uuid,
        });
      } else {
        await createComplaint({
          complaint_type: 'chat',
          reason: reportReason,
          description: reportDescription.trim(),
          chat_uuid: chatUuid,
        });
      }

      setReportVisible(false);
      setSettingsVisible(false);
      setReportDescription('');
      setReportReason('other');
    } catch (error) {
      console.error('submitComplaint error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickReply = (message: MessageItem) => {
    setReplyTo(message);
    setActionMenuVisible(false);
    setSelectedMessage(null);
  };

  const handleOpenActionMenu = (message: MessageItem) => {
    setSelectedMessage(message);
    setActionMenuVisible(true);
  };

  const handleCopyMessage = async () => {
    if (!selectedMessage) return;

    try {
      await Clipboard.setStringAsync(getMessagePreviewText(selectedMessage));
      setActionMenuVisible(false);
      setSelectedMessage(null);
    } catch (error) {
      console.error('handleCopyMessage error:', error);
    }
  };

  const handleShareMessage = async () => {
    if (!selectedMessage) return;

    try {
      await Share.share({
        message: getMessagePreviewText(selectedMessage),
      });
      setActionMenuVisible(false);
      setSelectedMessage(null);
    } catch (error) {
      console.error('handleShareMessage error:', error);
    }
  };

  const handleInsertEmoji = (emoji: string) => {
    setDraft((current) => `${current}${emoji}`);
    setEmojiVisible(false);
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.[0] || !chatUuid) {
        return;
      }

      const asset = result.assets[0];
      const uploaded = await uploadPickedImage(asset);
      const clientUuid = generateUUIDv4();

      const optimisticMessage: MessageItem = {
        uuid: `local-${clientUuid}`,
        client_uuid: clientUuid,
        message_type: 'image',
        text: '',
        is_own_message: true,
        delivery_status: 'sent',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        local_status: 'pending',
        attachments: uploaded.file_url
          ? [
              {
                uuid: uploaded.uuid,
                file_url: uploaded.file_url,
                content_type: uploaded.content_type,
                original_name: uploaded.original_name,
                media_kind: uploaded.media_kind,
              },
            ]
          : [],
      };

      setMessages((current) => [...current, optimisticMessage]);
      scrollToBottom();

      const savedMessage = await sendChatMessage(chatUuid, {
        client_uuid: clientUuid,
        message_type: 'image',
        text: '',
        attachment_uuids: [uploaded.uuid],
        ...(replyTo?.uuid ? { reply_to_uuid: replyTo.uuid } : {}),
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

      setReplyTo(null);
    } catch (error) {
      console.error('handlePickImage error:', error);
    }
  };

  const handleSendSticker = async (sticker: StickerItem) => {
    try {
      if (!chatUuid) return;

      const clientUuid = generateUUIDv4();

      const optimisticMessage: MessageItem = {
        uuid: `local-${clientUuid}`,
        client_uuid: clientUuid,
        message_type: 'sticker',
        text: sticker.emoji || sticker.title || '',
        is_own_message: true,
        delivery_status: 'sent',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        local_status: 'pending',
        metadata: {
          sticker_uuid: sticker.uuid,
          sticker_title: sticker.title,
          sticker_code: sticker.code,
          sticker_image: sticker.image,
          sticker_emoji: sticker.emoji,
        },
      };

      setMessages((current) => [...current, optimisticMessage]);
      setStickersVisible(false);
      scrollToBottom();

      const savedMessage = await sendChatMessage(chatUuid, {
        client_uuid: clientUuid,
        message_type: 'sticker',
        text: sticker.emoji || sticker.title || '',
        metadata: {
          sticker_uuid: sticker.uuid,
          sticker_title: sticker.title,
          sticker_code: sticker.code,
          sticker_image: sticker.image,
          sticker_emoji: sticker.emoji,
        },
        ...(replyTo?.uuid ? { reply_to_uuid: replyTo.uuid } : {}),
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

      setReplyTo(null);
    } catch (error) {
      console.error('handleSendSticker error:', error);
    }
  };

  const handleSend = async () => {
    const text = draft.trim();

    if (!chatUuid || !text || sending) return;

    const clientUuid = generateUUIDv4();

    const optimisticMessage: MessageItem = {
      uuid: `local-${clientUuid}`,
      client_uuid: clientUuid,
      message_type: 'text',
      text,
      reply_to: replyTo
        ? {
            uuid: replyTo.uuid,
            text: getMessagePreviewText(replyTo),
            message_type: replyTo.message_type,
            sender: replyTo.sender,
            created_at: replyTo.created_at,
          }
        : null,
      is_own_message: true,
      delivery_status: 'sent',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      local_status: 'pending',
    };

    setDraft('');
    setSending(true);

    setMessages((current) => [...current, optimisticMessage]);
    scrollToBottom();

    try {
      const savedMessage = await sendChatMessage(chatUuid, {
        text,
        client_uuid: clientUuid,
        message_type: 'text',
        ...(replyTo?.uuid ? { reply_to_uuid: replyTo.uuid } : {}),
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

      setReplyTo(null);
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
    if (!chatUuid || !message.client_uuid) return;

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
        text: message.text || '',
        client_uuid: message.client_uuid,
        message_type: (message.message_type as any) || 'text',
        ...(message.reply_to?.uuid ? { reply_to_uuid: message.reply_to.uuid } : {}),
        ...(message.attachments?.length
          ? { attachment_uuids: message.attachments.map((item) => item.uuid) }
          : {}),
        ...(message.metadata ? { metadata: message.metadata as Record<string, unknown> } : {}),
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
    const metaColor = isOwn ? 'rgba(255,255,255,0.84)' : theme.colors.muted;
    const imageUrl = getFirstImageUrl(item);
    const stickerImage = getStickerImage(item);
    const stickerEmoji = getStickerEmoji(item);

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
          onLongPress={() => handleOpenActionMenu(item)}
          onPress={() => {
            if (item.local_status === 'failed') {
              void retryMessage(item);
            }
          }}
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
                  borderColor: isOwn ? 'rgba(255,255,255,0.24)' : theme.colors.border,
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

          {stickerImage ? (
            <View style={styles.stickerWrap}>
              <ExpoImage
                source={{ uri: stickerImage }}
                style={styles.stickerImage}
                contentFit="contain"
              />
              {!!stickerEmoji && (
                <Text
                  style={[
                    styles.stickerEmoji,
                    {
                      color: isOwn ? '#FFFFFF' : theme.colors.text,
                    },
                  ]}
                >
                  {stickerEmoji}
                </Text>
              )}
            </View>
          ) : imageUrl ? (
            <View style={styles.imageMessageWrap}>
              <ExpoImage
                source={{ uri: imageUrl }}
                style={styles.imageMessage}
                contentFit="cover"
              />
              {!!item.text?.trim() && (
                <Text
                  style={[
                    styles.messageText,
                    {
                      color: isOwn ? '#FFFFFF' : theme.colors.text,
                      marginTop: 8,
                    },
                  ]}
                >
                  {item.text}
                </Text>
              )}
            </View>
          ) : (
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
          )}

          <View style={styles.metaRow}>
            <Text
              style={[
                styles.metaText,
                {
                  color: metaColor,
                },
              ]}
            >
              {formatTime(item.created_at)}
            </Text>

            {isOwn ? <MessageStatusIcon message={item} color={metaColor} /> : null}
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
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.headerButton, { borderColor: theme.colors.border }]}
          >
            <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
          </Pressable>

          <Pressable
            onPress={openPeerProfile}
            style={styles.headerCenter}
            hitSlop={12}
          >
            <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>
              {formatChatTitle(chat)}
            </Text>
            <Text style={[styles.headerSub, { color: theme.colors.muted }]}>
              {chat?.is_muted ? 'Без звука' : chat?.is_pinned ? 'Закреплён' : 'Переписка'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setSettingsVisible(true)}
            style={[styles.headerButton, { borderColor: theme.colors.border }]}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.text} />
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.uuid}
          renderItem={renderMessage}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
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

        {showScrollToBottom ? (
          <Pressable
            onPress={() => scrollToBottom()}
            style={[
              styles.scrollToBottomButton,
              {
                backgroundColor: theme.colors.primary,
                bottom: Math.max(insets.bottom, 12) + 118,
              },
            ]}
          >
            <Ionicons name="chevron-down" size={20} color="#FFFFFF" />
          </Pressable>
        ) : null}

        <View
          style={[
            styles.composerWrap,
            {
              backgroundColor: theme.colors.background,
              borderTopColor: theme.colors.border,
              paddingBottom: Math.max(insets.bottom, 10),
            },
          ]}
        >
          {replyTo ? (
            <View
              style={[
                styles.replyComposer,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.card,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.replyComposerTitle, { color: theme.colors.text }]}>
                  Ответ
                </Text>
                <Text style={[styles.replyComposerText, { color: theme.colors.muted }]} numberOfLines={1}>
                  {getMessagePreviewText(replyTo)}
                </Text>
              </View>

              <Pressable onPress={() => setReplyTo(null)} style={styles.replyCloseBtn}>
                <Ionicons name="close" size={18} color={theme.colors.text} />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.toolbarRow}>
            <Pressable
              onPress={() => setEmojiVisible(true)}
              style={[styles.toolButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            >
              <Ionicons name="happy-outline" size={18} color={theme.colors.text} />
            </Pressable>

            <Pressable
              onPress={() => void handlePickImage()}
              style={[styles.toolButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            >
              <Ionicons name="image-outline" size={18} color={theme.colors.text} />
            </Pressable>

            <Pressable
              onPress={() => void openStickerPicker()}
              style={[styles.toolButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            >
              <Ionicons name="sparkles-outline" size={18} color={theme.colors.text} />
            </Pressable>
          </View>

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
              textAlignVertical="top"
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

      <Modal
        visible={actionMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setActionMenuVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setActionMenuVisible(false)} />
          <View style={[styles.sheetWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <GlassCard>
              <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>
                Действия с сообщением
              </Text>

              <Pressable
                onPress={() => selectedMessage && handleQuickReply(selectedMessage)}
                style={[styles.sheetItem, { borderColor: theme.colors.border }]}
              >
                <Text style={[styles.sheetItemText, { color: theme.colors.text }]}>Ответить</Text>
              </Pressable>

              <Pressable
                onPress={() => void handleCopyMessage()}
                style={[styles.sheetItem, { borderColor: theme.colors.border }]}
              >
                <Text style={[styles.sheetItemText, { color: theme.colors.text }]}>Копировать</Text>
              </Pressable>

              <Pressable
                onPress={() => void handleShareMessage()}
                style={[styles.sheetItem, { borderColor: theme.colors.border }]}
              >
                <Text style={[styles.sheetItemText, { color: theme.colors.text }]}>Поделиться</Text>
              </Pressable>

              <View style={[styles.sheetItem, styles.sheetDisabled, { borderColor: theme.colors.border }]}>
                <Text style={[styles.sheetItemText, { color: theme.colors.muted }]}>Изменить — скоро</Text>
              </View>

              <View style={[styles.sheetItem, styles.sheetDisabled, { borderColor: theme.colors.border }]}>
                <Text style={[styles.sheetItemText, { color: theme.colors.muted }]}>Удалить для себя — скоро</Text>
              </View>

              <View style={[styles.sheetItem, styles.sheetDisabled, { borderColor: theme.colors.border }]}>
                <Text style={[styles.sheetItemText, { color: theme.colors.muted }]}>Удалить на сервере — скоро</Text>
              </View>
            </GlassCard>
          </View>
        </View>
      </Modal>

      <Modal
        visible={settingsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSettingsVisible(false)} />

          <View style={[styles.sheetWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <GlassCard>
              <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>
                Настройки чата
              </Text>

              {chat?.peer_user?.uuid ? (
                <Pressable
                  onPress={() => {
                    setSettingsVisible(false);
                    openPeerProfile();
                  }}
                  style={[styles.sheetItem, { borderColor: theme.colors.border }]}
                >
                  <Text style={[styles.sheetItemText, { color: theme.colors.text }]}>
                    Профиль собеседника
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => void handleShareProfile()}
                style={[styles.sheetItem, { borderColor: theme.colors.border }]}
              >
                <Text style={[styles.sheetItemText, { color: theme.colors.text }]}>
                  Поделиться профилем
                </Text>
              </Pressable>

              <Pressable
                onPress={() => void handleToggleMute()}
                disabled={actionLoading}
                style={[styles.sheetItem, { borderColor: theme.colors.border }]}
              >
                <Text style={[styles.sheetItemText, { color: theme.colors.text }]}>
                  {chat?.is_muted ? 'Включить звук' : 'Без звука'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => void handleTogglePin()}
                disabled={actionLoading}
                style={[styles.sheetItem, { borderColor: theme.colors.border }]}
              >
                <Text style={[styles.sheetItemText, { color: theme.colors.text }]}>
                  {chat?.is_pinned ? 'Убрать из закрепа' : 'Закрепить чат'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => void handleToggleArchive()}
                disabled={actionLoading}
                style={[styles.sheetItem, { borderColor: theme.colors.border }]}
              >
                <Text style={[styles.sheetItemText, { color: theme.colors.text }]}>
                  {chat?.is_archived ? 'Разархивировать' : 'Архивировать чат'}
                </Text>
              </Pressable>

              {chat?.peer_user?.uuid ? (
                <Pressable
                  onPress={() => {
                    setReportType('user');
                    setReportVisible(true);
                  }}
                  style={[styles.sheetItem, { borderColor: theme.colors.border }]}
                >
                  <Text style={[styles.sheetDangerText, { color: theme.colors.danger }]}>
                    Пожаловаться на пользователя
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => {
                  setReportType('chat');
                  setReportVisible(true);
                }}
                style={[styles.sheetItem, { borderColor: theme.colors.border }]}
              >
                <Text style={[styles.sheetDangerText, { color: theme.colors.danger }]}>
                  Пожаловаться на чат
                </Text>
              </Pressable>
            </GlassCard>
          </View>
        </View>
      </Modal>

      <Modal
        visible={reportVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReportVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setReportVisible(false)} />

          <View style={[styles.sheetWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <GlassCard>
              <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>
                {reportType === 'user' ? 'Жалоба на пользователя' : 'Жалоба на чат'}
              </Text>

              <View style={styles.reasonWrap}>
                {reportReasons.map((reason) => {
                  const active = reportReason === reason;

                  return (
                    <Pressable
                      key={reason}
                      onPress={() => setReportReason(reason)}
                      style={[
                        styles.reasonChip,
                        {
                          borderColor: theme.colors.border,
                          backgroundColor: active ? theme.colors.primary : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: active ? '#FFFFFF' : theme.colors.text,
                          fontWeight: '600',
                        }}
                      >
                        {reason}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                value={reportDescription}
                onChangeText={setReportDescription}
                placeholder="Описание (необязательно)"
                placeholderTextColor={theme.colors.muted}
                multiline
                style={[
                  styles.reportInput,
                  {
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.inputBackground,
                  },
                ]}
              />

              <Pressable
                onPress={() => void submitComplaint()}
                disabled={actionLoading}
                style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
              >
                <Text style={styles.primaryButtonText}>
                  {actionLoading ? 'Отправка...' : 'Отправить жалобу'}
                </Text>
              </Pressable>
            </GlassCard>
          </View>
        </View>
      </Modal>

      <Modal
        visible={emojiVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEmojiVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEmojiVisible(false)} />
          <View style={[styles.sheetWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <GlassCard>
              <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>Эмодзи</Text>

              <View style={styles.emojiGrid}>
                {quickEmojis.map((emoji) => (
                  <Pressable
                    key={emoji}
                    onPress={() => handleInsertEmoji(emoji)}
                    style={[styles.emojiButton, { borderColor: theme.colors.border }]}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
            </GlassCard>
          </View>
        </View>
      </Modal>

      <Modal
        visible={stickersVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStickersVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setStickersVisible(false)} />
          <View style={[styles.sheetWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <GlassCard>
              <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>Стикеры</Text>

              <FlatList
                horizontal
                data={stickerPacks}
                keyExtractor={(item) => item.uuid}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.packList}
                renderItem={({ item }) => {
                  const active = item.slug === selectedPackSlug;

                  return (
                    <Pressable
                      onPress={async () => {
                        setSelectedPackSlug(item.slug);
                        await loadStickerPack(item.slug);
                      }}
                      style={[
                        styles.packChip,
                        {
                          borderColor: theme.colors.border,
                          backgroundColor: active ? theme.colors.primary : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: active ? '#FFFFFF' : theme.colors.text,
                          fontWeight: '600',
                        }}
                      >
                        {item.title}
                      </Text>
                    </Pressable>
                  );
                }}
              />

              {loadingStickers ? (
                <View style={styles.centered}>
                  <ActivityIndicator color={theme.colors.primary} />
                </View>
              ) : (
                <FlatList
                  data={selectedPack?.stickers ?? []}
                  keyExtractor={(item) => item.uuid}
                  numColumns={4}
                  contentContainerStyle={styles.stickerGrid}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => void handleSendSticker(item)}
                      style={[styles.stickerCell, { borderColor: theme.colors.border }]}
                    >
                      <ExpoImage
                        source={{ uri: item.image }}
                        style={styles.stickerCellImage}
                        contentFit="contain"
                      />
                      {!!item.emoji && <Text style={styles.stickerCellEmoji}>{item.emoji}</Text>}
                    </Pressable>
                  )}
                  ListEmptyComponent={
                    <Text style={[styles.emptyText, { color: theme.colors.muted }]}>
                      Стикеры не найдены
                    </Text>
                  }
                />
              )}
            </GlassCard>
          </View>
        </View>
      </Modal>
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
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
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
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    minHeight: 14,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '500',
  },
  stickerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerImage: {
    width: 120,
    height: 120,
  },
  stickerEmoji: {
    fontSize: 18,
    marginTop: 6,
  },
  imageMessageWrap: {
    overflow: 'hidden',
    borderRadius: 18,
  },
  imageMessage: {
    width: 220,
    height: 220,
    borderRadius: 18,
  },
  scrollToBottomButton: {
    position: 'absolute',
    right: 18,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  composerWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  replyComposer: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  replyComposerTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  replyComposerText: {
    fontSize: 13,
  },
  replyCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  toolButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.26)',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    paddingHorizontal: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  sheetItem: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    paddingHorizontal: 14,
  },
  sheetDisabled: {
    opacity: 0.55,
  },
  sheetItemText: {
    fontSize: 15,
    fontWeight: '600',
  },
  sheetDangerText: {
    fontSize: 15,
    fontWeight: '700',
  },
  reasonWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  reasonChip: {
    minHeight: 38,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportInput: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    textAlignVertical: 'top',
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  emojiButton: {
    width: '22%',
    aspectRatio: 1,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 28,
  },
  packList: {
    gap: 8,
    paddingBottom: 12,
  },
  packChip: {
    minHeight: 38,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  stickerGrid: {
    paddingTop: 4,
    gap: 10,
  },
  stickerCell: {
    width: '23%',
    aspectRatio: 1,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    margin: '1%',
    overflow: 'hidden',
  },
  stickerCellImage: {
    width: '72%',
    height: '72%',
  },
  stickerCellEmoji: {
    fontSize: 12,
    marginTop: 4,
  },
});