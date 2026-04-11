import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
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
  ChatCaptureModal,
  type CaptureMode,
} from '@/src/components/ChatCaptureModal';
import { MessageAudioBubble } from '@/src/components/MessageAudioBubble';
import { MessageVideoBubble } from '@/src/components/MessageVideoBubble';
import {
  fetchChatDetail,
  setChatArchived,
  setChatMuted,
  setChatPinned,
} from '@/src/lib/api/chats';
import { createComplaint, ComplaintReason } from '@/src/lib/api/complaints';
import {
  uploadPickedImage,
  uploadPickedMedia,
  type PickedMediaAsset,
} from '@/src/lib/api/media';
import {
  deleteChatMessage,
  editChatMessage,
  fetchChatMessages,
  markChatRead,
  sendChatMessage,
} from '@/src/lib/api/messages';
import { fetchStickerPackDetail, fetchStickerPacks } from '@/src/lib/api/stickers';
import {
  loadCachedChatDetail,
  loadCachedChatMessages,
  saveCachedChatDetail,
  saveCachedChatMessages,
} from '@/src/lib/db/cache';
import {
  HiddenMessageMap,
  hideMessageLocally,
  isMessageHidden,
  loadHiddenMessageMap,
} from '@/src/lib/local/messageVisibility';
import { mergeMessages } from '@/src/lib/utils/messageSync';
import { generateUUIDv4 } from '@/src/lib/utils/uuid';
import type { ChatListItem } from '@/src/types/chat';
import type { MessageAttachment, MessageItem } from '@/src/types/message';
import type {
  StickerItem,
  StickerPackDetail,
  StickerPackListItem,
} from '@/src/types/sticker';

import { MessageMedia } from '@/src/components/chat/MessageMedia';
import { HoldToRecordButton } from '@/src/components/chat/HoldToRecordButton';
import {
  DEFAULT_CHAT_APPEARANCE,
  buildBubbleStyle,
  buildChatBackgroundStyle,
  loadChatAppearance,
} from '@/src/lib/chatAppearance';
import { uploadPickedVideo } from '@/src/lib/api/media';

type ComposerPanelTab = 'stickers' | 'emoji';

const reportReasons: ComplaintReason[] = ['spam', 'abuse', 'fraud', 'harassment', 'other'];

const emojiGroups = [
  {
    title: 'Часто используемые',
    items: ['👍', '❤️', '😂', '🔥', '🙏', '👏', '😎', '😅', '😮', '🥹', '🎉', '✅'],
  },
  {
    title: 'Эмоции',
    items: ['😀', '😁', '😄', '😊', '🙂', '😉', '😍', '🤗', '🤔', '😴', '🥲', '😭'],
  },
  {
    title: 'Реакции',
    items: ['💯', '💪', '👌', '🤝', '👏', '🙌', '🤍', '💙', '💜', '💥', '✨', '⚡'],
  },
];

function animateLayout() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

function formatChatTitle(chat: ChatListItem | null) {
  return chat?.display_title || chat?.title || chat?.peer_user?.full_name || 'Чат';
}

function formatChatSub(chat: ChatListItem | null) {
  if (!chat) return 'Переписка';

  if (chat.is_muted) return 'Без звука';
  if (chat.is_pinned) return 'Закреплён';
  if (chat.is_archived) return 'В архиве';

  return chat.chat_type === 'group' ? 'Групповой чат' : 'В сети';
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

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getMessagePreviewText(message: MessageItem) {
  if (message.is_deleted) return 'Сообщение удалено';
  if (message.text?.trim()) return message.text;

  if (message.message_type === 'sticker') return 'Стикер';
  if (message.message_type === 'image') return 'Фото';
  if (message.message_type === 'video') return 'Видео';
  if (message.message_type === 'audio') return 'Голосовое сообщение';
  if (message.message_type === 'file') return 'Файл';

  return 'Сообщение';
}

function getAttachmentByPredicate(
  message: MessageItem,
  predicate: (attachment: MessageAttachment) => boolean,
) {
  return message.attachments?.find(predicate) || null;
}

function getFirstImageUrl(message: MessageItem) {
  const attachment = getAttachmentByPredicate(
    message,
    (item) =>
      item.media_kind === 'image' ||
      item.content_type?.startsWith('image/') === true,
  );

  return attachment?.file_url || null;
}

function getFirstAudioUrl(message: MessageItem) {
  const attachment = getAttachmentByPredicate(
    message,
    (item) =>
      item.media_kind === 'audio' ||
      item.content_type?.startsWith('audio/') === true,
  );

  return attachment?.file_url || null;
}

function getFirstVideoUrl(message: MessageItem) {
  const attachment = getAttachmentByPredicate(
    message,
    (item) =>
      item.media_kind === 'video' ||
      item.content_type?.startsWith('video/') === true,
  );

  return attachment?.file_url || null;
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

function getMessageLocalKey(message: MessageItem) {
  return message.client_uuid || message.uuid;
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
    return <Ionicons name="alert-circle" size={14} color="#FFD7D7" />;
  }

  if (message.delivery_status === 'read') {
    return <Ionicons name="checkmark-done" size={14} color={color} />;
  }

  if (message.local_status === 'pending') {
    return <Ionicons name="time-outline" size={14} color={color} />;
  }

  return <Ionicons name="checkmark" size={14} color={color} />;
}

export default function ChatScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { chatUuid } = useLocalSearchParams<{ chatUuid: string }>();

  const listRef = useRef<FlatList<MessageItem>>(null);
  const isNearBottomRef = useRef(true);

  const [chat, setChat] = useState<ChatListItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [hiddenMessageMap, setHiddenMessageMap] = useState<HiddenMessageMap>({});
  const [nextUrl, setNextUrl] = useState<string | null>(null);

  const [loadingChat, setLoadingChat] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [loadingStickers, setLoadingStickers] = useState(false);
  const [sending, setSending] = useState(false);

  const [appearance, setAppearance] = useState(DEFAULT_CHAT_APPEARANCE);

  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<MessageItem | null>(null);

  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);

  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<MessageItem | null>(null);

  const [editingVisible, setEditingVisible] = useState(false);
  const [editingText, setEditingText] = useState('');
  const [editingLoading, setEditingLoading] = useState(false);

  const [composerPanelVisible, setComposerPanelVisible] = useState(false);
  const [composerPanelTab, setComposerPanelTab] = useState<ComposerPanelTab>('stickers');

  const [captureVisible, setCaptureVisible] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode>('audio');

  const [reportType, setReportType] = useState<'user' | 'chat'>('chat');
  const [reportReason, setReportReason] = useState<ComplaintReason>('other');
  const [reportDescription, setReportDescription] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [stickerPacks, setStickerPacks] = useState<StickerPackListItem[]>([]);
  const [selectedPackSlug, setSelectedPackSlug] = useState<string | null>(null);
  const [selectedPack, setSelectedPack] = useState<StickerPackDetail | null>(null);

  const latestIncomingMessage = useMemo(() => {
    const reversed = [...messages].reverse();
    return reversed.find((message) => !message.is_own_message && !message.is_deleted);
  }, [messages]);

  const visibleMessages = useMemo(() => {
    return messages.filter((message) => {
      return !isMessageHidden(hiddenMessageMap, getMessageLocalKey(message));
    });
  }, [messages, hiddenMessageMap]);

  const composerActionIcon = useMemo(() => {
    if (draft.trim().length > 0) {
      return 'arrow-up';
    }

    return captureMode === 'audio' ? 'mic-outline' : 'videocam-outline';
  }, [draft, captureMode]);

  const canSend = draft.trim().length > 0;

  const canEditSelectedMessage = useMemo(() => {
    if (!selectedMessage) return false;

    return Boolean(
      selectedMessage.is_own_message &&
        !selectedMessage.is_deleted &&
        selectedMessage.message_type === 'text',
    );
  }, [selectedMessage]);

  const canDeleteForEveryoneSelectedMessage = useMemo(() => {
    if (!selectedMessage) return false;

    return Boolean(selectedMessage.is_own_message && !selectedMessage.is_deleted);
  }, [selectedMessage]);

  const scrollToBottom = (animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  };

  const hydrateFromCache = useCallback(async () => {
    if (!chatUuid) return;

    try {
      const [cachedChat, cachedMessages, hiddenMap] = await Promise.all([
        loadCachedChatDetail(chatUuid),
        loadCachedChatMessages(chatUuid),
        loadHiddenMessageMap(chatUuid),
      ]);

      if (cachedChat) {
        setChat(cachedChat);
        setLoadingChat(false);
      }

      if (cachedMessages.length) {
        setMessages(cachedMessages);
        setLoadingMessages(false);
      }

      setHiddenMessageMap(hiddenMap);
    } catch (error) {
      console.error('hydrateFromCache error:', error);
    }
  }, [chatUuid]);

  const refreshChat = useCallback(async () => {
    try {
      if (!chatUuid) return;

      const data = await fetchChatDetail(chatUuid);
      setChat(data);
      await saveCachedChatDetail(chatUuid, data);
    } catch (error) {
      console.error('refreshChat error:', error);
    }
  }, [chatUuid]);

  const refreshMessagesSilent = useCallback(async () => {
    try {
      if (!chatUuid) return;

      const response = await fetchChatMessages(chatUuid);
      const serverMessages = normalizeMessagesForUi(response.results ?? []);

      setMessages((current) => {
        const merged = mergeMessages(serverMessages, current);
        void saveCachedChatMessages(chatUuid, merged);
        return merged;
      });

      setNextUrl(response.next ?? null);
    } catch (error) {
      console.error('refreshMessagesSilent error:', error);
    }
  }, [chatUuid]);

  const loadChat = useCallback(async () => {
    try {
      if (!chatUuid) return;

      const data = await fetchChatDetail(chatUuid);
      setChat(data);
      await saveCachedChatDetail(chatUuid, data);
    } catch (error) {
      console.error('loadChat error:', error);
    } finally {
      setLoadingChat(false);
    }
  }, [chatUuid]);

  const loadInitialMessages = useCallback(async () => {
    try {
      if (!chatUuid) return;

      const response = await fetchChatMessages(chatUuid);
      const normalized = normalizeMessagesForUi(response.results ?? []);

      setMessages(normalized);
      setNextUrl(response.next ?? null);

      await saveCachedChatMessages(chatUuid, normalized);
    } catch (error) {
      console.error('loadInitialMessages error:', error);
    } finally {
      setLoadingMessages(false);
    }
  }, [chatUuid]);

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

  const openComposerPanel = async (tab: ComposerPanelTab) => {
    try {
      animateLayout();
      setComposerPanelTab(tab);
      setComposerPanelVisible(true);

      if (tab === 'stickers' && !stickerPacks.length) {
        setLoadingStickers(true);
        const packs = await fetchStickerPacks();
        setStickerPacks(packs);

        if (packs[0]?.slug) {
          setSelectedPackSlug(packs[0].slug);
          await loadStickerPack(packs[0].slug);
        } else {
          setLoadingStickers(false);
        }
      } else if (tab === 'stickers' && selectedPackSlug) {
        await loadStickerPack(selectedPackSlug);
      }
    } catch (error) {
      console.error('openComposerPanel error:', error);
      setLoadingStickers(false);
    }
  };

  const closeComposerPanel = () => {
    animateLayout();
    setComposerPanelVisible(false);
  };

  const loadEarlierMessages = async () => {
    try {
      if (!chatUuid || !nextUrl || loadingEarlier) return;

      setLoadingEarlier(true);

      const response = await fetchChatMessages(chatUuid, nextUrl);
      const olderMessages = normalizeMessagesForUi(response.results ?? []);

      setMessages((current) => {
        const merged = mergeMessages([...olderMessages, ...current], current);
        void saveCachedChatMessages(chatUuid, merged);
        return merged;
      });

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
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    void hydrateFromCache();
    void loadChat();
    void loadInitialMessages();
  }, [hydrateFromCache, loadChat, loadInitialMessages]);


  useEffect(() => {
    let mounted = true;

    loadChatAppearance()
      .then((value) => {
        if (mounted) {
          setAppearance(value);
        }
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);
  useFocusEffect(
    useCallback(() => {
      void refreshChat();
      void refreshMessagesSilent();

      const interval = setInterval(() => {
        void refreshChat();
        void refreshMessagesSilent();
      }, 2500);

      return () => clearInterval(interval);
    }, [refreshChat, refreshMessagesSilent]),
  );

  useEffect(() => {
    void syncReadState();
  }, [latestIncomingMessage?.uuid]);

  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom(false);
    }
  }, [visibleMessages.length]);

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
    animateLayout();
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

  const handleHideMessageForMe = async () => {
    if (!chatUuid || !selectedMessage) return;

    const key = getMessageLocalKey(selectedMessage);

    if (!key) return;

    try {
      const nextMap = await hideMessageLocally(chatUuid, key);
      setHiddenMessageMap(nextMap);
      setActionMenuVisible(false);
      setSelectedMessage(null);
      animateLayout();
    } catch (error) {
      console.error('handleHideMessageForMe error:', error);
    }
  };

  const openEditSelectedMessage = () => {
    if (!selectedMessage) return;

    setEditingText(selectedMessage.text || '');
    setActionMenuVisible(false);
    setEditingVisible(true);
  };

  const handleSaveEditedMessage = async () => {
    if (!chatUuid || !selectedMessage) return;

    const nextText = editingText.trim();

    if (!nextText) {
      Alert.alert('Ошибка', 'Текст сообщения не может быть пустым');
      return;
    }

    try {
      setEditingLoading(true);

      const updated = await editChatMessage(chatUuid, selectedMessage.uuid, {
        text: nextText,
      });

      setMessages((current) => {
        const next = current.map((message) =>
          message.uuid === updated.uuid
            ? {
                ...updated,
                local_status: 'sent',
              }
            : message,
        );

        void saveCachedChatMessages(chatUuid, next);
        return next;
      });

      if (replyTo?.uuid === updated.uuid) {
        setReplyTo(updated);
      }

      setSelectedMessage(updated);
      setEditingVisible(false);
      setEditingText('');
    } catch (error: any) {
      console.error('handleSaveEditedMessage error:', error);
      Alert.alert(
        'Ошибка',
        error?.response?.data?.detail || 'Не удалось изменить сообщение',
      );
    } finally {
      setEditingLoading(false);
    }
  };

  const performDeleteSelectedMessage = async (deleteFor: 'me' | 'everyone') => {
    if (!chatUuid || !selectedMessage) return;

    try {
      const response = await deleteChatMessage(chatUuid, selectedMessage.uuid, {
        delete_for: deleteFor,
      });

      if (deleteFor === 'me') {
        const key = getMessageLocalKey(selectedMessage);
        if (key) {
          const nextMap = await hideMessageLocally(chatUuid, key);
          setHiddenMessageMap(nextMap);
        }

        if (replyTo?.uuid === selectedMessage.uuid) {
          setReplyTo(null);
        }
      } else if (response.message) {
        setMessages((current) => {
          const next = current.map((message) =>
            message.uuid === response.message!.uuid
              ? {
                  ...response.message!,
                  local_status: 'sent',
                }
              : message,
          );

          void saveCachedChatMessages(chatUuid, next);
          return next;
        });

        if (replyTo?.uuid === response.message.uuid) {
          setReplyTo(response.message);
        }
      }

      setActionMenuVisible(false);
      setSelectedMessage(null);
      animateLayout();
    } catch (error: any) {
      console.error('performDeleteSelectedMessage error:', error);
      Alert.alert(
        'Ошибка',
        error?.response?.data?.detail || 'Не удалось удалить сообщение',
      );
    }
  };

  const confirmDeleteSelectedMessage = (deleteFor: 'me' | 'everyone') => {
    if (!selectedMessage) return;

    Alert.alert(
      deleteFor === 'everyone' ? 'Удалить у всех?' : 'Удалить у себя?',
      deleteFor === 'everyone'
        ? 'Сообщение будет удалено на сервере для всех участников.'
        : 'Сообщение будет скрыто у тебя.',
      [
        {
          text: 'Отмена',
          style: 'cancel',
        },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            void performDeleteSelectedMessage(deleteFor);
          },
        },
      ],
    );
  };

  const handleInsertEmoji = (emoji: string) => {
    animateLayout();
    setDraft((current) => `${current}${emoji}`);
  };

  const buildReplyPayload = (message: MessageItem | null) => {
    if (!message) {
      return null;
    }

    return {
      uuid: message.uuid,
      text: getMessagePreviewText(message),
      message_type: message.message_type,
      sender: message.sender,
      created_at: message.created_at,
    };
  };

  const sendMediaMessage = async (
    mediaType: 'audio' | 'video',
    asset: PickedMediaAsset,
  ) => {
    if (!chatUuid) return;

    const clientUuid = generateUUIDv4();
    const optimisticReply = buildReplyPayload(replyTo);

    const optimisticMessage: MessageItem = {
      uuid: `local-${clientUuid}`,
      client_uuid: clientUuid,
      message_type: mediaType,
      text: '',
      reply_to: optimisticReply,
      is_own_message: true,
      delivery_status: 'sent',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      local_status: 'pending',
      attachments: [
        {
          uuid: `local-attachment-${clientUuid}`,
          file_url: asset.uri,
          content_type: asset.mimeType || (mediaType === 'audio' ? 'audio/m4a' : 'video/mp4'),
          original_name: asset.fileName || undefined,
          media_kind: mediaType,
        },
      ],
    };

    animateLayout();
    setMessages((current) => {
      const next = [...current, optimisticMessage];
      void saveCachedChatMessages(chatUuid, next);
      return next;
    });

    setReplyTo(null);
    scrollToBottom();

    try {
      const uploaded = await uploadPickedMedia(asset);

      const savedMessage = await sendChatMessage(chatUuid, {
        client_uuid: clientUuid,
        message_type: mediaType,
        text: '',
        attachment_uuids: [uploaded.uuid],
        ...(optimisticReply?.uuid ? { reply_to_uuid: optimisticReply.uuid } : {}),
      });

      setMessages((current) => {
        const next = current.map((message) =>
          message.client_uuid === clientUuid
            ? {
                ...savedMessage,
                local_status: 'sent',
              }
            : message,
        );

        void saveCachedChatMessages(chatUuid, next);
        return next;
      });
    } catch (error) {
      console.error('sendMediaMessage error:', error);

      setMessages((current) => {
        const next = current.map((message) =>
          message.client_uuid === clientUuid
            ? {
                ...message,
                local_status: 'failed',
              }
            : message,
        );

        void saveCachedChatMessages(chatUuid, next);
        return next;
      });

      Alert.alert(
        'Ошибка',
        mediaType === 'audio'
          ? 'Не удалось отправить голосовое сообщение'
          : 'Не удалось отправить видео-сообщение',
      );
    }
  };

  const handleCapturedMedia = async (asset: PickedMediaAsset) => {
    await sendMediaMessage(captureMode, asset);
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.88,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.[0] || !chatUuid) {
        return;
      }

      const asset = result.assets[0];
      const uploaded = await uploadPickedImage(asset);
      const clientUuid = generateUUIDv4();
      const optimisticReply = buildReplyPayload(replyTo);

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
        reply_to: optimisticReply,
        attachments: asset.uri
          ? [
              {
                uuid: `local-attachment-${clientUuid}`,
                file_url: asset.uri,
                content_type: asset.mimeType || 'image/jpeg',
                original_name: asset.fileName || undefined,
                media_kind: 'image',
              },
            ]
          : [],
      };

      animateLayout();
      setMessages((current) => {
        const next = [...current, optimisticMessage];
        void saveCachedChatMessages(chatUuid, next);
        return next;
      });

      setReplyTo(null);
      scrollToBottom();

      const savedMessage = await sendChatMessage(chatUuid, {
        client_uuid: clientUuid,
        message_type: 'image',
        text: '',
        attachment_uuids: [uploaded.uuid],
        ...(optimisticReply?.uuid ? { reply_to_uuid: optimisticReply.uuid } : {}),
      });

      setMessages((current) => {
        const next = current.map((message) =>
          message.client_uuid === clientUuid
            ? {
                ...savedMessage,
                local_status: 'sent',
              }
            : message,
        );

        void saveCachedChatMessages(chatUuid, next);
        return next;
      });
    } catch (error) {
      console.error('handlePickImage error:', error);
      Alert.alert('Ошибка', 'Не удалось отправить фото');
    }
  };

  const handlePickVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 0.9,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.[0] || !chatUuid) {
        return;
      }

      const asset = result.assets[0];
      const uploaded = await uploadPickedVideo(asset);
      const clientUuid = generateUUIDv4();

      const optimisticMessage: MessageItem = {
        uuid: `local-${clientUuid}`,
        client_uuid: clientUuid,
        message_type: 'video',
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
        message_type: 'video',
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
      console.error('handlePickVideo error:', error);
    }
  };

  const handleSendSticker = async (sticker: StickerItem) => {
    try {
      if (!chatUuid) return;

      const clientUuid = generateUUIDv4();
      const optimisticReply = buildReplyPayload(replyTo);

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
        reply_to: optimisticReply,
        metadata: {
          sticker_uuid: sticker.uuid,
          sticker_title: sticker.title,
          sticker_code: sticker.code,
          sticker_image: sticker.image,
          sticker_emoji: sticker.emoji,
        },
      };

      animateLayout();
      setMessages((current) => {
        const next = [...current, optimisticMessage];
        void saveCachedChatMessages(chatUuid, next);
        return next;
      });

      setReplyTo(null);
      closeComposerPanel();
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
        ...(optimisticReply?.uuid ? { reply_to_uuid: optimisticReply.uuid } : {}),
      });

      setMessages((current) => {
        const next = current.map((message) =>
          message.client_uuid === clientUuid
            ? {
                ...savedMessage,
                local_status: 'sent',
              }
            : message,
        );

        void saveCachedChatMessages(chatUuid, next);
        return next;
      });
    } catch (error) {
      console.error('handleSendSticker error:', error);
      Alert.alert('Ошибка', 'Не удалось отправить стикер');
    }
  };

  const handleSend = async () => {
    const text = draft.trim();

    if (!chatUuid || !text || sending) return;

    const clientUuid = generateUUIDv4();
    const optimisticReply = buildReplyPayload(replyTo);

    const optimisticMessage: MessageItem = {
      uuid: `local-${clientUuid}`,
      client_uuid: clientUuid,
      message_type: 'text',
      text,
      reply_to: optimisticReply,
      is_own_message: true,
      delivery_status: 'sent',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      local_status: 'pending',
    };

    setDraft('');
    setSending(true);
    animateLayout();

    setMessages((current) => {
      const next = [...current, optimisticMessage];
      void saveCachedChatMessages(chatUuid, next);
      return next;
    });

    setReplyTo(null);
    scrollToBottom();

    try {
      const savedMessage = await sendChatMessage(chatUuid, {
        text,
        client_uuid: clientUuid,
        message_type: 'text',
        ...(optimisticReply?.uuid ? { reply_to_uuid: optimisticReply.uuid } : {}),
      });

      setMessages((current) => {
        const next = current.map((message) =>
          message.client_uuid === clientUuid
            ? {
                ...savedMessage,
                local_status: 'sent',
              }
            : message,
        );

        void saveCachedChatMessages(chatUuid, next);
        return next;
      });
    } catch (error) {
      console.error('handleSend error:', error);

      setMessages((current) => {
        const next = current.map((message) =>
          message.client_uuid === clientUuid
            ? {
                ...message,
                local_status: 'failed',
              }
            : message,
        );

        void saveCachedChatMessages(chatUuid, next);
        return next;
      });
    } finally {
      setSending(false);
    }
  };

  const retryMessage = async (message: MessageItem) => {
    if (!chatUuid || !message.client_uuid || message.message_type !== 'text') return;

    animateLayout();
    setMessages((current) => {
      const next = current.map((item) =>
        item.client_uuid === message.client_uuid
          ? {
              ...item,
              local_status: 'pending',
            }
          : item,
      );

      void saveCachedChatMessages(chatUuid, next);
      return next;
    });

    try {
      const savedMessage = await sendChatMessage(chatUuid, {
        text: message.text || '',
        client_uuid: message.client_uuid,
        message_type: 'text',
        ...(message.reply_to?.uuid ? { reply_to_uuid: message.reply_to.uuid } : {}),
      });

      setMessages((current) => {
        const next = current.map((item) =>
          item.client_uuid === message.client_uuid
            ? {
                ...savedMessage,
                local_status: 'sent',
              }
            : item,
        );

        void saveCachedChatMessages(chatUuid, next);
        return next;
      });
    } catch (error) {
      console.error('retryMessage error:', error);

      setMessages((current) => {
        const next = current.map((item) =>
          item.client_uuid === message.client_uuid
            ? {
                ...item,
                local_status: 'failed',
              }
            : item,
        );

        void saveCachedChatMessages(chatUuid, next);
        return next;
      });
    }
  };

  const handleRecorderPress = () => {
    if (canSend) {
      void handleSend();
      return;
    }

    if (composerPanelVisible) {
      closeComposerPanel();
    }

    animateLayout();
    setCaptureVisible(true);
  };

  const handleRecorderLongPress = () => {
    if (canSend) return;

    animateLayout();
    setCaptureMode((current) => (current === 'audio' ? 'video' : 'audio'));
  };

  const renderMessage = ({ item }: { item: MessageItem }) => {
    const isOwn = Boolean(item.is_own_message);
    const metaColor = isOwn ? 'rgba(255,255,255,0.82)' : theme.colors.muted;
    const imageUrl = getFirstImageUrl(item);
    const audioUrl = getFirstAudioUrl(item);
    const videoUrl = getFirstVideoUrl(item);
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
            if (item.local_status === 'failed' && item.message_type === 'text') {
              void retryMessage(item);
            }
          }}
          style={[
            styles.bubble,
            buildBubbleStyle(theme, appearance, isOwn),
            {
              alignSelf: isOwn ? 'flex-end' : 'flex-start',
            },
          ]}
        >
          {!!item.reply_to?.text && (
            <View
              style={[
                styles.replyBox,
                {
                  borderColor: isOwn ? 'rgba(255,255,255,0.24)' : theme.colors.borderStrong,
                },
              ]}
            >
              <Text
                style={[
                  styles.replyText,
                  {
                    color: isOwn ? 'rgba(255,255,255,0.84)' : theme.colors.muted,
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
          ) : item.message_type === 'image' ||
              item.message_type === 'video' ||
              item.message_type === 'audio' ||
              item.message_type === 'file' ? (
            <View style={styles.imageMessageWrap}>
              <MessageMedia message={item} isOwn={isOwn} theme={theme} />
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
            {item.is_edited ? (
              <Text
                style={[
                  styles.metaEditedText,
                  {
                    color: metaColor,
                  },
                ]}
              >
                изменено
              </Text>
            ) : null}

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
      <SafeAreaView style={[styles.container, buildChatBackgroundStyle(theme, appearance)]}>        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, buildChatBackgroundStyle(theme, appearance)]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View
          style={[
            styles.header,
            {
              borderBottomColor: theme.colors.borderStrong,
              backgroundColor: theme.colors.background,
            },
          ]}
        >
          <Pressable
            onPress={() => router.back()}
            style={[
              styles.headerButton,
              {
                borderColor: theme.colors.borderStrong,
                backgroundColor: theme.colors.cardStrong,
              },
            ]}
          >
            <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
          </Pressable>

          <Pressable onPress={openPeerProfile} style={styles.headerCenter} hitSlop={12}>
            <View
              style={[
                styles.headerAvatar,
                {
                  backgroundColor: theme.colors.primarySoft,
                },
              ]}
            >
              <Text style={[styles.headerAvatarText, { color: theme.colors.primary }]}>
                {formatChatTitle(chat).slice(0, 1).toUpperCase()}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>
                {formatChatTitle(chat)}
              </Text>
              <Text style={[styles.headerSub, { color: theme.colors.muted }]} numberOfLines={1}>
                {formatChatSub(chat)}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => setSettingsVisible(true)}
            style={[
              styles.headerButton,
              {
                borderColor: theme.colors.borderStrong,
                backgroundColor: theme.colors.cardStrong,
              },
            ]}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.text} />
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={visibleMessages}
          keyExtractor={(item) => item.uuid}
          renderItem={renderMessage}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.listContent,
            {
              paddingBottom:
                Math.max(insets.bottom, 14) +
                (composerPanelVisible ? 336 : 126),
            },
          ]}
          ListHeaderComponent={
            nextUrl ? (
              <Pressable
                onPress={() => void loadEarlierMessages()}
                style={[
                  styles.loadEarlierButton,
                  {
                    borderColor: theme.colors.borderStrong,
                    backgroundColor: theme.colors.cardStrong,
                  },
                ]}
              >
                <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
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
                bottom:
                  Math.max(insets.bottom, 12) +
                  (composerPanelVisible ? 340 : 126),
              },
            ]}
          >
            <Ionicons name="chevron-down" size={20} color="#FFFFFF" />
          </Pressable>
        ) : null}

        <View
          style={[
            styles.composerShell,
            {
              borderTopColor: theme.colors.borderStrong,
              backgroundColor: theme.colors.background,
              paddingBottom: Math.max(insets.bottom, 10),
            },
          ]}
        >
          {replyTo ? (
            <View
              style={[
                styles.replyComposer,
                {
                  borderColor: theme.colors.borderStrong,
                  backgroundColor: theme.colors.cardStrong,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.replyComposerTitle, { color: theme.colors.text }]}>
                  Ответ
                </Text>
                <Text
                  style={[styles.replyComposerText, { color: theme.colors.muted }]}
                  numberOfLines={1}
                >
                  {getMessagePreviewText(replyTo)}
                </Text>
              </View>

              <Pressable onPress={() => setReplyTo(null)} style={styles.replyCloseBtn}>
                <Ionicons name="close" size={18} color={theme.colors.text} />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.composerRow}>
            <Pressable
              onPress={() => void openComposerPanel('stickers')}
              style={[
                styles.roundToolButton,
                {
                  backgroundColor: theme.colors.cardStrong,
                  borderColor: theme.colors.borderStrong,
                },
              ]}
            >
              <Ionicons
                name={composerPanelVisible ? 'chevron-down' : 'sparkles-outline'}
                size={19}
                color={theme.colors.text}
              />
            </Pressable>

            <View
              style={[
                styles.composer,
                {
                  backgroundColor: theme.colors.composerBackground,
                  borderColor: theme.colors.borderStrong,
                },
              ]}
            >
              <TextInput
                value={draft}
                onChangeText={(value) => {
                  animateLayout();
                  setDraft(value);
                }}
                onFocus={() => {
                  if (composerPanelVisible) {
                    closeComposerPanel();
                  }
                }}
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
                textAlignVertical="center"
              />
            </View>

            <Pressable
              onPress={() => void handlePickImage()}
              style={[styles.toolButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            >
              <Ionicons name="image-outline" size={18} color={theme.colors.text} />
            </Pressable>

            <Pressable
              onPress={() => void handlePickVideo()}
              style={[styles.toolButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            >
              <Ionicons name="videocam-outline" size={18} color={theme.colors.text} />
            </Pressable>

            <HoldToRecordButton
              chatUuid={chatUuid}
              replyToUuid={replyTo?.uuid}
              theme={theme}
              onMessageCreated={(message) => {
                setMessages((current) => mergeMessages([...current, message], current));
                setReplyTo(null);
                scrollToBottom();
              }}
            />

            <Pressable
              onPress={handleRecorderPress}
              onLongPress={handleRecorderLongPress}
              delayLongPress={220}
              style={[
                styles.primaryActionButton,
                {
                  backgroundColor: canSend ? theme.colors.primary : theme.colors.cardStrong,
                  borderColor: canSend ? 'transparent' : theme.colors.borderStrong,
                },
              ]}
            >
              <Ionicons
                name={composerActionIcon as any}
                size={20}
                color={canSend ? '#FFFFFF' : theme.colors.text}
              />
            </Pressable>
          </View>

          {!canSend ? (
            <Text style={[styles.captureHint, { color: theme.colors.muted }]}>
              Нажми для записи. Удерживай, чтобы переключить на{' '}
              {captureMode === 'audio' ? 'видео-сообщение' : 'голосовое сообщение'}.
            </Text>
          ) : null}

          {composerPanelVisible ? (
            <View
              style={[
                styles.composerPanel,
                {
                  backgroundColor: theme.colors.cardStrong,
                  borderColor: theme.colors.borderStrong,
                },
              ]}
            >
              <View style={styles.composerPanelHeader}>
                <View style={styles.panelTabs}>
                  <Pressable
                    onPress={() => setComposerPanelTab('stickers')}
                    style={[
                      styles.panelTab,
                      {
                        backgroundColor:
                          composerPanelTab === 'stickers'
                            ? theme.colors.primarySoft
                            : 'transparent',
                      },
                    ]}
                  >
                    <Ionicons
                      name="sparkles-outline"
                      size={16}
                      color={
                        composerPanelTab === 'stickers'
                          ? theme.colors.primary
                          : theme.colors.text
                      }
                    />
                    <Text
                      style={[
                        styles.panelTabText,
                        {
                          color:
                            composerPanelTab === 'stickers'
                              ? theme.colors.primary
                              : theme.colors.text,
                        },
                      ]}
                    >
                      Стикеры
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setComposerPanelTab('emoji')}
                    style={[
                      styles.panelTab,
                      {
                        backgroundColor:
                          composerPanelTab === 'emoji'
                            ? theme.colors.primarySoft
                            : 'transparent',
                      },
                    ]}
                  >
                    <Ionicons
                      name="happy-outline"
                      size={16}
                      color={
                        composerPanelTab === 'emoji'
                          ? theme.colors.primary
                          : theme.colors.text
                      }
                    />
                    <Text
                      style={[
                        styles.panelTabText,
                        {
                          color:
                            composerPanelTab === 'emoji'
                              ? theme.colors.primary
                              : theme.colors.text,
                        },
                      ]}
                    >
                      Эмодзи
                    </Text>
                  </Pressable>
                </View>

                <Pressable onPress={closeComposerPanel} style={styles.panelCloseBtn}>
                  <Ionicons name="close" size={18} color={theme.colors.text} />
                </Pressable>
              </View>

              {composerPanelTab === 'emoji' ? (
                <View style={styles.emojiPanelBody}>
                  {emojiGroups.map((group) => (
                    <View key={group.title} style={styles.emojiGroup}>
                      <Text style={[styles.emojiGroupTitle, { color: theme.colors.muted }]}>
                        {group.title}
                      </Text>

                      <View style={styles.emojiGrid}>
                        {group.items.map((emoji) => (
                          <Pressable
                            key={`${group.title}-${emoji}`}
                            onPress={() => handleInsertEmoji(emoji)}
                            style={[
                              styles.emojiChip,
                              {
                                backgroundColor: theme.colors.backgroundTertiary,
                              },
                            ]}
                          >
                            <Text style={styles.emojiText}>{emoji}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.stickerPanelBody}>
                  <View style={styles.packTabsRow}>
                    {stickerPacks.length > 0 ? (
                      stickerPacks.map((pack) => {
                        const active = selectedPackSlug === pack.slug;

                        return (
                          <Pressable
                            key={pack.uuid}
                            onPress={() => {
                              setSelectedPackSlug(pack.slug);
                              void loadStickerPack(pack.slug);
                            }}
                            style={[
                              styles.packChip,
                              {
                                backgroundColor: active
                                  ? theme.colors.primarySoft
                                  : theme.colors.backgroundTertiary,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.packChipText,
                                {
                                  color: active ? theme.colors.primary : theme.colors.text,
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {pack.title}
                            </Text>
                          </Pressable>
                        );
                      })
                    ) : (
                      <Text style={[styles.helperText, { color: theme.colors.muted }]}>
                        Пакеты стикеров загружаются…
                      </Text>
                    )}
                  </View>

                  {loadingStickers ? (
                    <View style={styles.centerStickerLoading}>
                      <ActivityIndicator color={theme.colors.primary} />
                    </View>
                  ) : selectedPack?.stickers?.length ? (
                    <View style={styles.stickerGrid}>
                      {selectedPack.stickers.map((sticker) => (
                        <Pressable
                          key={sticker.uuid}
                          onPress={() => void handleSendSticker(sticker)}
                          style={[
                            styles.stickerTile,
                            {
                              backgroundColor: theme.colors.backgroundTertiary,
                              borderColor: theme.colors.borderStrong,
                            },
                          ]}
                        >
                          <ExpoImage
                            source={{ uri: sticker.image }}
                            style={styles.stickerTileImage}
                            contentFit="contain"
                          />
                          {!!sticker.emoji && (
                            <Text style={styles.stickerTileEmoji}>{sticker.emoji}</Text>
                          )}
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <Text style={[styles.helperText, { color: theme.colors.muted }]}>
                      Стикеры пока недоступны
                    </Text>
                  )}
                </View>
              )}
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>

      <ChatCaptureModal
        visible={captureVisible}
        mode={captureMode}
        onClose={() => setCaptureVisible(false)}
        onCaptured={handleCapturedMedia}
      />

      <Modal
        visible={editingVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditingVisible(false)} />

          <View style={[styles.sheetWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <GlassCard>
              <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>
                Изменить сообщение
              </Text>

              <TextInput
                value={editingText}
                onChangeText={setEditingText}
                placeholder="Новый текст"
                placeholderTextColor={theme.colors.muted}
                multiline
                style={[
                  styles.editInput,
                  {
                    borderColor: theme.colors.borderStrong,
                    backgroundColor: theme.colors.inputBackground,
                    color: theme.colors.text,
                  },
                ]}
              />

              <View style={styles.editActions}>
                <Pressable
                  onPress={() => setEditingVisible(false)}
                  style={[
                    styles.editSecondaryButton,
                    {
                      backgroundColor: theme.colors.backgroundTertiary,
                      borderColor: theme.colors.borderStrong,
                    },
                  ]}
                >
                  <Text style={[styles.editSecondaryButtonText, { color: theme.colors.text }]}>
                    Отмена
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => void handleSaveEditedMessage()}
                  disabled={editingLoading}
                  style={[
                    styles.editPrimaryButton,
                    {
                      backgroundColor: theme.colors.primary,
                    },
                  ]}
                >
                  {editingLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.editPrimaryButtonText}>Сохранить</Text>
                  )}
                </Pressable>
              </View>
            </GlassCard>
          </View>
        </View>
      </Modal>

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
                style={[styles.sheetItem, { borderColor: theme.colors.borderStrong }]}
              >
                <Ionicons name="arrow-undo-outline" size={18} color={theme.colors.primary} />
                <Text style={[styles.sheetItemText, { color: theme.colors.text }]}>
                  Ответить
                </Text>
              </Pressable>

              <Pressable
                onPress={() => void handleCopyMessage()}
                style={[styles.sheetItem, { borderColor: theme.colors.borderStrong }]}
              >
                <Ionicons name="copy-outline" size={18} color={theme.colors.primary} />
                <Text style={[styles.sheetItemText, { color: theme.colors.text }]}>
                  Копировать
                </Text>
              </Pressable>

              <Pressable
                onPress={() => void handleShareMessage()}
                style={[styles.sheetItem, { borderColor: theme.colors.borderStrong }]}
              >
                <Ionicons name="share-social-outline" size={18} color={theme.colors.primary} />
                <Text style={[styles.sheetItemText, { color: theme.colors.text }]}>
                  Поделиться
                </Text>
              </Pressable>

              <Pressable
                onPress={() => void handleHideMessageForMe()}
                style={[styles.sheetItem, { borderColor: theme.colors.borderStrong }]}
              >
                <Ionicons name="eye-off-outline" size={18} color={theme.colors.primary} />
                <Text style={[styles.sheetItemText, { color: theme.colors.text }]}>
                  Скрыть у себя
                </Text>
              </Pressable>

              {canEditSelectedMessage ? (
                <Pressable
                  onPress={openEditSelectedMessage}
                  style={[styles.sheetItem, { borderColor: theme.colors.borderStrong }]}
                >
                  <Ionicons name="create-outline" size={18} color={theme.colors.primary} />
                  <Text style={[styles.sheetItemText, { color: theme.colors.text }]}>
                    Изменить
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => confirmDeleteSelectedMessage('me')}
                style={[styles.sheetItem, { borderColor: theme.colors.borderStrong }]}
              >
                <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                <Text style={[styles.sheetDangerText, { color: theme.colors.danger }]}>
                  Удалить у себя
                </Text>
              </Pressable>

              {canDeleteForEveryoneSelectedMessage ? (
                <Pressable
                  onPress={() => confirmDeleteSelectedMessage('everyone')}
                  style={[styles.sheetItem, { borderColor: theme.colors.borderStrong }]}
                >
                  <Ionicons name="trash-bin-outline" size={18} color={theme.colors.danger} />
                  <Text style={[styles.sheetDangerText, { color: theme.colors.danger }]}>
                    Удалить у всех
                  </Text>
                </Pressable>
              ) : null}
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
                  style={[styles.sheetItem, { borderColor: theme.colors.borderStrong }]}
                >
                  <Ionicons name="person-outline" size={18} color={theme.colors.primary} />
                  <Text style={[styles.sheetItemText, { color: theme.colors.text }]}>
                    Профиль собеседника
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => void handleShareProfile()}
                style={[styles.sheetItem, { borderColor: theme.colors.borderStrong }]}
              >
                <Ionicons name="share-outline" size={18} color={theme.colors.primary} />
                <Text style={[styles.sheetItemText, { color: theme.colors.text }]}>
                  Поделиться профилем
                </Text>
              </Pressable>

              <Pressable
                onPress={() => void handleToggleMute()}
                disabled={actionLoading}
                style={[styles.sheetItem, { borderColor: theme.colors.borderStrong }]}
              >
                <Ionicons
                  name={chat?.is_muted ? 'volume-high-outline' : 'volume-mute-outline'}
                  size={18}
                  color={theme.colors.primary}
                />
                <Text style={[styles.sheetItemText, { color: theme.colors.text }]}>
                  {chat?.is_muted ? 'Включить звук' : 'Без звука'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => void handleTogglePin()}
                disabled={actionLoading}
                style={[styles.sheetItem, { borderColor: theme.colors.borderStrong }]}
              >
                <Ionicons
                  name={chat?.is_pinned ? 'bookmark' : 'bookmark-outline'}
                  size={18}
                  color={theme.colors.primary}
                />
                <Text style={[styles.sheetItemText, { color: theme.colors.text }]}>
                  {chat?.is_pinned ? 'Убрать из закрепа' : 'Закрепить чат'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => void handleToggleArchive()}
                disabled={actionLoading}
                style={[styles.sheetItem, { borderColor: theme.colors.borderStrong }]}
              >
                <Ionicons
                  name={chat?.is_archived ? 'archive' : 'archive-outline'}
                  size={18}
                  color={theme.colors.primary}
                />
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
                  style={[styles.sheetItem, { borderColor: theme.colors.borderStrong }]}
                >
                  <Ionicons name="warning-outline" size={18} color={theme.colors.danger} />
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
                style={[styles.sheetItem, { borderColor: theme.colors.borderStrong }]}
              >
                <Ionicons name="warning-outline" size={18} color={theme.colors.danger} />
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
                          borderColor: theme.colors.borderStrong,
                          backgroundColor: active ? theme.colors.primary : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: active ? '#FFFFFF' : theme.colors.text,
                          fontWeight: '700',
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
                    borderColor: theme.colors.borderStrong,
                    backgroundColor: theme.colors.inputBackground,
                    color: theme.colors.text,
                  },
                ]}
              />

              <Pressable
                onPress={() => void submitComplaint()}
                disabled={actionLoading}
                style={[
                  styles.submitReportButton,
                  {
                    backgroundColor: theme.colors.primary,
                  },
                ]}
              >
                <Text style={styles.submitReportButtonText}>
                  {actionLoading ? 'Отправка...' : 'Отправить жалобу'}
                </Text>
              </Pressable>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },

  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerAvatarText: {
    fontSize: 16,
    fontWeight: '800',
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
  },

  headerSub: {
    fontSize: 12,
    marginTop: 2,
  },

  listContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
  },

  loadEarlierButton: {
    minHeight: 42,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  historyStart: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  emptyWrap: {
    paddingTop: 40,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },

  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },

  messageRow: {
    marginBottom: 8,
    flexDirection: 'row',
  },

  bubble: {
    maxWidth: '84%',
    minWidth: 78,
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
    fontWeight: '600',
  },

  messageText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
  },

  imageMessageWrap: {
    width: 220,
  },

  imageMessage: {
    width: 220,
    height: 220,
    borderRadius: 18,
  },

  stickerWrap: {
    width: 144,
    alignItems: 'center',
    justifyContent: 'center',
  },

  stickerImage: {
    width: 132,
    height: 132,
  },

  stickerEmoji: {
    fontSize: 18,
    marginTop: 6,
  },

  metaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },

  metaText: {
    fontSize: 11,
    fontWeight: '700',
  },

  metaEditedText: {
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.88,
  },

  scrollToBottomButton: {
    position: 'absolute',
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },

  composerShell: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
  },

  replyComposer: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },

  replyComposerTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },

  replyComposerText: {
    fontSize: 13,
    lineHeight: 18,
  },

  replyCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },

  roundToolButton: {
    width: 46,
    height: 46,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },

  toolButton: {
    width: 46,
    height: 46,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  composer: {
    flex: 1,
    minHeight: 50,
    maxHeight: 128,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
  },

  input: {
    fontSize: 15,
    lineHeight: 20,
    minHeight: 28,
    maxHeight: 108,
  },

  primaryActionButton: {
    width: 50,
    height: 50,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  captureHint: {
    marginTop: 8,
    marginBottom: 2,
    paddingHorizontal: 4,
    fontSize: 12,
    lineHeight: 17,
  },

  composerPanel: {
    marginTop: 10,
    minHeight: 250,
    borderRadius: 24,
    borderWidth: 1,
    padding: 12,
  },

  composerPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  panelTabs: {
    flexDirection: 'row',
    gap: 8,
  },

  panelTab: {
    minHeight: 38,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  panelTabText: {
    fontSize: 13,
    fontWeight: '800',
  },

  panelCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emojiPanelBody: {
    gap: 12,
  },

  emojiGroup: {
    gap: 8,
  },

  emojiGroupTitle: {
    fontSize: 12,
    fontWeight: '700',
  },

  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  emojiChip: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emojiText: {
    fontSize: 22,
  },

  stickerPanelBody: {
    flex: 1,
  },

  packTabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },

  packChip: {
    minHeight: 34,
    maxWidth: 140,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  packChipText: {
    fontSize: 12,
    fontWeight: '800',
  },

  centerStickerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },

  stickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  stickerTile: {
    width: 74,
    height: 74,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  stickerTileImage: {
    width: 56,
    height: 56,
  },

  stickerTileEmoji: {
    position: 'absolute',
    right: 6,
    bottom: 4,
    fontSize: 13,
  },

  helperText: {
    fontSize: 13,
    lineHeight: 18,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.34)',
    justifyContent: 'flex-end',
  },

  sheetWrap: {
    paddingHorizontal: 12,
  },

  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },

  sheetItem: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  sheetItemText: {
    fontSize: 15,
    fontWeight: '700',
  },

  sheetDangerText: {
    fontSize: 15,
    fontWeight: '800',
  },

  reasonWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },

  reasonChip: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  reportInput: {
    minHeight: 110,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
    fontSize: 15,
    marginBottom: 14,
  },

  submitReportButton: {
    minHeight: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  submitReportButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  editInput: {
    minHeight: 120,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
    fontSize: 15,
    marginBottom: 14,
  },

  editActions: {
    flexDirection: 'row',
    gap: 10,
  },

  editSecondaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  editSecondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },

  editPrimaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  editPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});