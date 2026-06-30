import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
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
import { Audio } from 'expo-av';
import {
  CameraView,
  type CameraType,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useCallStore } from '@/src/state/call';
import { useTheme } from '@/src/theme/ThemeProvider';
import { GlassCard } from '@/src/components/GlassCard';
import {
  fetchChatDetail,
  setChatArchived,
  setChatMuted,
  setChatPinned,
} from '@/src/lib/api/chats';
import { fetchPresence } from '@/src/lib/api/presence';
import { createComplaint, ComplaintReason } from '@/src/lib/api/complaints';
import type { PickedMediaAsset } from '@/src/lib/api/media';
import { uploadPickedMedia } from '@/src/lib/api/media';
import {
  deleteChatMessage,
  editChatMessage,
  fetchChatMessageDetail,
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
import type { MessageItem } from '@/src/types/message';
import type { PresenceDetail } from '@/src/types/presence';
import type {
  StickerItem,
  StickerPackDetail,
  StickerPackListItem,
} from '@/src/types/sticker';

import { MessageMedia } from '@/src/components/chat/MessageMedia';
import {
  DEFAULT_CHAT_APPEARANCE,
  buildBubbleStyle,
  buildChatBackgroundStyle,
  getTextScale,
  loadChatAppearanceForChat,
  saveChatAppearanceForChat,
} from '@/src/lib/chatAppearance';
import { addLocalContact, isLocalContact } from '@/src/lib/local/localContacts';
import { blockUserLocal, isUserBlocked } from '@/src/lib/local/blockedUsers';
import { realtimeClient } from '@/src/lib/realtime/socket';
import {
  extractChatUuidFromRealtimeEvent,
  extractMessageFromRealtimeEvent,
  isMessageEvent,
} from '@/src/lib/realtime/events';
import { getApiErrorMessage as formatApiErrorMessage } from '@/src/utils/apiErrors';

type ComposerPanelTab = 'stickers' | 'emoji';
type CaptureMode = 'audio' | 'video';

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

const VIDEO_MAX_DURATION_SECONDS = 30;
const VIDEO_MAX_FILE_SIZE_BYTES = 60 * 1024 * 1024;
const VIDEO_BITRATE = 750_000;

function formatMillis(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatSecondsRemaining(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `00:${String(seconds).padStart(2, '0')}`;
}

function normalizeUploadMimeType(mimeType?: string | null, fallback?: string): string {
  const value = String(mimeType || fallback || '').trim().toLowerCase();

  if (!value) return '';
  if (value === 'audio/m4a' || value === 'audio/x-m4a') return 'audio/mp4';
  if (value === 'image/jpg') return 'image/jpeg';
  if (value === 'video/mov') return 'video/quicktime';

  return value;
}

function buildUploadFilename(
  asset: PickedMediaAsset & { type?: string | null },
  fallbackPrefix: string,
  fallbackExtension: string,
) {
  if (asset.fileName?.trim()) {
    return asset.fileName.trim();
  }

  return `${fallbackPrefix}-${Date.now()}${fallbackExtension}`;
}

async function uploadChatAsset(
  asset: PickedMediaAsset & { type?: string | null },
  options: {
    filenamePrefix: string;
    fallbackContentType: string;
    fallbackExtension: string;
    mediaKind?: 'image' | 'video' | 'audio' | 'file' | 'video_note' | string;
    durationSeconds?: number;
    onProgress?: (progress: number) => void;
  },
): Promise<{ uuid: string }> {
  const uploaded = await uploadPickedMedia(
    {
      ...asset,
      duration: options.durationSeconds ?? asset.duration,
      mimeType: normalizeUploadMimeType(asset.mimeType, options.fallbackContentType),
      fileName: buildUploadFilename(asset, options.filenamePrefix, options.fallbackExtension),
      mediaKind: options.mediaKind,
    },
    {
      filenamePrefix: options.filenamePrefix,
      fallbackContentType: options.fallbackContentType,
      isPublic: false,
      mediaKind: options.mediaKind,
      onProgress: options.onProgress,
    },
  );

  if (!uploaded?.uuid) {
    throw new Error('Invalid upload response');
  }

  return {
    uuid: uploaded.uuid,
  };
}

function animateLayout() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

function formatChatTitle(chat: ChatListItem | null) {
  return chat?.display_title || chat?.title || chat?.peer_user?.full_name || 'Чат';
}

function formatLastSeen(lastSeenAt?: string | null) {
  if (!lastSeenAt) return 'был(а) давно';
  const date = new Date(lastSeenAt);
  if (Number.isNaN(date.getTime())) return 'был(а) недавно';

  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (sameDay) {
    return `был(а) сегодня в ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return `был(а) вчера в ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  return `был(а) ${date.toLocaleDateString([], { day: '2-digit', month: '2-digit' })} в ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function formatChatSub(chat: ChatListItem | null, presence: PresenceDetail | null) {
  if (!chat) return 'Переписка';

  if (chat.is_muted) return 'Без звука';
  if (chat.is_pinned) return 'Закреплён';
  if (chat.is_archived) return 'В архиве';

  if (chat.chat_type === 'group') return 'Групповой чат';
  if (presence?.status === 'online') return 'В сети';
  return formatLastSeen(presence?.last_seen_at || null);
}

function normalizeMessagesForUi(items: MessageItem[]) {
  return [...items].reverse().map((item) => ({
    ...item,
    local_status: item.local_status ?? 'sent',
  }));
}

function formatTime(dateString?: string | null, nowMs = Date.now()) {
  if (!dateString) return '';

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  if (nowMs - date.getTime() >= 0 && nowMs - date.getTime() < 60000) {
    return 'Только что';
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
  if (message.message_type === 'video_note') return 'Видеокружок';
  if (message.message_type === 'audio') return 'Голосовое сообщение';
  if (message.message_type === 'file') return 'Файл';

  return 'Сообщение';
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

  if (message.local_status === 'pending') {
    return <Ionicons name="time-outline" size={14} color={color} />;
  }

  if (message.delivery_status === 'read') {
    return <Ionicons name="ellipse" size={10} color={color} />;
  }

  if (message.delivery_status === 'delivered') {
    return <Ionicons name="checkmark-done" size={14} color={color} />;
  }

  return <Ionicons name="checkmark" size={14} color={color} />;
}

export default function ChatScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { chatUuid } = useLocalSearchParams<{ chatUuid: string }>();

  const cameraRef = useRef<any>(null);
  const [audioPermission, requestAudioPermission] = Audio.usePermissions();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();

  const listRef = useRef<FlatList<MessageItem>>(null);
  const isNearBottomRef = useRef(true);
  const audioPressStartedAtRef = useRef<number | null>(null);
  const sendLockRef = useRef(false);
  const audioRecordingRef = useRef<Audio.Recording | null>(null);
  const audioStartPromiseRef = useRef<Promise<Audio.Recording | null> | null>(null);
  const audioCancelRequestedRef = useRef(false);
  const lastAudioDurationMsRef = useRef(0);
  const videoStartedAtRef = useRef<number | null>(null);

  const startOutgoing = useCallStore((state) => state.startOutgoing);

  const [chat, setChat] = useState<ChatListItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [presence, setPresence] = useState<PresenceDetail | null>(null);
  const [hiddenMessageMap, setHiddenMessageMap] = useState<HiddenMessageMap>({});
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [timeNowMs, setTimeNowMs] = useState(() => Date.now());
  const [composerHeight, setComposerHeight] = useState(72);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const [loadingChat, setLoadingChat] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [loadingStickers, setLoadingStickers] = useState(false);
  const [callingKey, setCallingKey] = useState<string | null>(null);

  const [appearance, setAppearance] = useState(DEFAULT_CHAT_APPEARANCE);
  const [appearanceVisible, setAppearanceVisible] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isContact, setIsContact] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);

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
  const [audioRecording, setAudioRecording] = useState<Audio.Recording | null>(null);
  const [voiceLocked, setVoiceLocked] = useState(false);
  const [audioDurationMs, setAudioDurationMs] = useState(0);
  const [videoRecording, setVideoRecording] = useState(false);
  const [videoDurationMs, setVideoDurationMs] = useState(0);
  const [cameraFacing, setCameraFacing] = useState<CameraType>('front');
  const [cameraTorch, setCameraTorch] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

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

    return audioRecording ? 'mic' : 'mic-outline';
  }, [draft, audioRecording]);

  const canSend = draft.trim().length > 0;
  const textScale = getTextScale(appearance);
  const composerBottomPadding = useMemo(() => {
    if (Platform.OS === 'web') {
      return 10;
    }

    if (keyboardVisible) {
      return Platform.OS === 'ios' ? Math.max(insets.bottom, 8) : 8;
    }

    return Math.max(insets.bottom, Platform.OS === 'android' ? 18 : 10);
  }, [insets.bottom, keyboardVisible]);

  useEffect(() => {
    const timer = setInterval(() => setTimeNowMs(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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

  useEffect(() => {
    if (!captureVisible) {
      setVideoDurationMs(0);
      setAudioDurationMs(0);
      setCameraTorch(false);
      setCameraFacing('front');
      setCameraReady(false);
    }
  }, [captureVisible]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (videoRecording) {
      interval = setInterval(() => {
        setVideoDurationMs((current) => {
          const next = current + 250;

          if (next >= VIDEO_MAX_DURATION_SECONDS * 1000) {
            try {
              cameraRef.current?.stopRecording?.();
            } catch (error) {
              console.error('auto stop video recording error:', error);
            }

            return VIDEO_MAX_DURATION_SECONDS * 1000;
          }

          return next;
        });
      }, 250);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [videoRecording]);

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

      if (data.chat_type !== 'group' && data.peer_user?.uuid) {
        const presenceData = await fetchPresence(data.peer_user.uuid);
        setPresence(presenceData);
      } else {
        setPresence(null);
      }
    } catch (error) {
      console.error('refreshChat error:', error);
    }
  }, [chatUuid]);

  const refreshMessagesSilent = useCallback(async () => {
    try {
      if (!chatUuid) return;

      const response = await fetchChatMessages(chatUuid);
      const serverMessages = normalizeMessagesForUi(response.results ?? []);
      const filtered = isBlocked
        ? serverMessages.filter((message) => message.is_own_message)
        : serverMessages;

      setMessages((current) => {
        const merged = mergeMessages(filtered, current);
        void saveCachedChatMessages(chatUuid, merged);
        return merged;
      });

      setNextUrl(response.next ?? null);
    } catch (error) {
      console.error('refreshMessagesSilent error:', error);
    }
  }, [chatUuid, isBlocked]);

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
      const filtered = isBlocked
        ? normalized.filter((message) => message.is_own_message)
        : normalized;

      setMessages(filtered);
      setNextUrl(response.next ?? null);

      await saveCachedChatMessages(chatUuid, filtered);
    } catch (error) {
      console.error('loadInitialMessages error:', error);
    } finally {
      setLoadingMessages(false);
    }
  }, [chatUuid, isBlocked]);

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

  const syncReadState = useCallback(async () => {
    try {
      if (!chatUuid || !latestIncomingMessage?.uuid) return;
      await markChatRead(chatUuid, latestIncomingMessage.uuid);
    } catch (error) {
      console.error('syncReadState error:', error);
    }
  }, [chatUuid, latestIncomingMessage?.uuid]);

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

    loadChatAppearanceForChat(chatUuid)
      .then((value) => {
        if (mounted) {
          setAppearance(value);
        }
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, [chatUuid]);

  useEffect(() => {
    let mounted = true;

    if (!chat?.peer_user?.uuid) {
      setIsBlocked(false);
      setIsContact(false);
      return;
    }

    Promise.all([
      isUserBlocked(chat.peer_user.uuid),
      isLocalContact(chat.peer_user.uuid),
    ])
      .then(([blocked, contact]) => {
        if (!mounted) return;
        setIsBlocked(blocked);
        setIsContact(contact);
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, [chat?.peer_user?.uuid]);

  useFocusEffect(
    useCallback(() => {
      void refreshChat();
      void refreshMessagesSilent();

      const interval = setInterval(() => {
        void refreshChat();
        void refreshMessagesSilent();
      }, 6000);

      return () => clearInterval(interval);
    }, [refreshChat, refreshMessagesSilent]),
  );

  useEffect(() => {
    if (!chatUuid) return;

    const unsubscribe = realtimeClient.subscribe((event) => {
      if (!isMessageEvent(event)) return;

      const eventChatUuid = extractChatUuidFromRealtimeEvent(event);
      if (eventChatUuid !== chatUuid) return;

      const incomingMessage = extractMessageFromRealtimeEvent(event);

      if (incomingMessage?.uuid) {
        const needsFullFetch =
          incomingMessage.message_type === 'image' ||
          incomingMessage.message_type === 'video' ||
          incomingMessage.message_type === 'video_note' ||
          incomingMessage.message_type === 'audio' ||
          incomingMessage.message_type === 'file' ||
          !Array.isArray(incomingMessage.attachments) ||
          incomingMessage.attachments.some((attachment) => !attachment.file_url);

        if (needsFullFetch) {
          void fetchChatMessageDetail(chatUuid, incomingMessage.uuid)
            .then((fullMessage) => {
              setMessages((current) => {
                const next = mergeMessages(
                  [{ ...fullMessage, local_status: 'sent' }],
                  current,
                );
                void saveCachedChatMessages(chatUuid, next);
                return next;
              });
            })
            .catch(() => {
              void refreshMessagesSilent();
            });
        } else {
          setMessages((current) => {
            const next = mergeMessages(
              [{ ...incomingMessage, local_status: 'sent' }],
              current,
            );
            void saveCachedChatMessages(chatUuid, next);
            return next;
          });
        }
      } else {
        void refreshMessagesSilent();
      }

      void refreshChat();
    });

    return () => {
      unsubscribe();
    };
  }, [chatUuid, refreshChat, refreshMessagesSilent]);

  useEffect(() => {
    void syncReadState();
  }, [syncReadState]);

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

  const handleShowMessageInfo = () => {
    if (!selectedMessage) return;

    const sentAt = selectedMessage.created_at
      ? new Date(selectedMessage.created_at).toLocaleString()
      : 'Нет данных';
    const editedAt = selectedMessage.edited_at
      ? new Date(selectedMessage.edited_at).toLocaleString()
      : 'Не редактировалось';

    Alert.alert(
      'Информация о сообщении',
      `Отправлено: ${sentAt}\nИзменено: ${editedAt}\nСтатус: ${selectedMessage.delivery_status || 'sent'}`,
    );
  };

  const handleAddToContacts = async () => {
    if (!chat?.peer_user?.uuid) return;
    await addLocalContact(chat.peer_user.uuid);
    setIsContact(true);
    setShowQuickActions(false);
  };

  const handleBlockLocal = async () => {
    if (!chat?.peer_user?.uuid) return;
    await blockUserLocal(chat.peer_user.uuid);
    setIsBlocked(true);
    setShowQuickActions(false);
    Alert.alert('Пользователь заблокирован', 'Новые входящие сообщения от него скрыты локально.');
  };

  const updateAppearance = async (patch: Partial<typeof appearance>) => {
    if (!chatUuid) return;

    const next = {
      ...appearance,
      ...patch,
    };

    setAppearance(next);
    await saveChatAppearanceForChat(next, chatUuid);
  };

  const handlePickChatBackground = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return;

    await updateAppearance({
      backgroundImageUri: result.assets[0].uri,
      backgroundPreset: 'plain',
    });
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

  const getApiErrorMessage = (error: any, fallback: string) =>
    formatApiErrorMessage(error, fallback);

  const patchLocalMessage = (
    clientUuid: string,
    patcher: (message: MessageItem) => MessageItem,
  ) => {
    if (!chatUuid) return;

    setMessages((current) => {
      const next = current.map((message) =>
        message.client_uuid === clientUuid ? patcher(message) : message,
      );

      void saveCachedChatMessages(chatUuid, next);
      return next;
    });
  };

  const setUploadProgress = (clientUuid: string, progress: number) => {
    patchLocalMessage(clientUuid, (message) => ({
      ...message,
      metadata: {
        ...(message.metadata || {}),
        upload_progress: Math.round(Math.max(0, Math.min(1, progress)) * 100),
      },
    }));
  };

  const getUploadProgress = (message: MessageItem) => {
    const value = Number((message.metadata as Record<string, unknown> | null)?.upload_progress);
    return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
  };

  const getServerMetadata = (metadata?: Record<string, unknown> | null) => {
    const next = { ...(metadata || {}) };
    delete next.upload_progress;
    delete next.local_upload_error;
    return next;
  };

  const getHeaderAvatarUrl = (currentChat: ChatListItem | null) => {
    return currentChat?.peer_user?.avatar || currentChat?.avatar || null;
  };

  const getPickedMediaKind = (
    asset: PickedMediaAsset & { type?: string | null },
  ): 'image' | 'video' => {
    const explicitType = String((asset as any)?.type || '').toLowerCase();
    const mimeType = String(asset.mimeType || '').toLowerCase();

    if (explicitType === 'video' || mimeType.startsWith('video/')) {
      return 'video';
    }

    return 'image';
  };

  const sendMediaMessage = async (
    mediaType: 'audio' | 'video' | 'video_note',
    asset: PickedMediaAsset,
    metadata?: Record<string, unknown>,
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
      metadata: { ...(metadata || {}), upload_progress: 0 },
      attachments: [
        {
          uuid: `local-attachment-${clientUuid}`,
          file_url: asset.uri,
          content_type: mediaType === 'audio' ? 'audio/mp4' : 'video/mp4',
          original_name: asset.fileName || undefined,
          media_kind: mediaType === 'video_note' ? 'video' : mediaType,
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
      const uploaded = await uploadChatAsset(asset, {
        filenamePrefix: mediaType === 'audio' ? 'voice' : 'video',
        fallbackContentType: mediaType === 'audio' ? 'audio/mp4' : 'video/mp4',
        fallbackExtension: mediaType === 'audio' ? (Platform.OS === 'web' ? '.webm' : '.m4a') : '.mp4',
        mediaKind: mediaType === 'audio' ? 'audio' : 'video',
        durationSeconds: Math.max(1, Math.ceil(Number(asset.duration || 1))),
        onProgress: (progress) => setUploadProgress(clientUuid, progress),
      });

      const serverMetadata = getServerMetadata({
        ...(metadata || {}),
        ...(mediaType === 'audio'
          ? { duration_seconds: Math.max(1, Math.ceil(Number(asset.duration || 1))) }
          : {}),
      });
      const savedMessage = await sendChatMessage(chatUuid, {
        client_uuid: clientUuid,
        message_type: mediaType,
        text: '',
        attachment_uuids: [uploaded.uuid],
        ...(Object.keys(serverMetadata).length ? { metadata: serverMetadata } : {}),
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
                metadata: {
                  ...(message.metadata || {}),
                  local_upload_error: getApiErrorMessage(error, 'Upload failed'),
                },
              }
            : message,
        );

        void saveCachedChatMessages(chatUuid, next);
        return next;
      });

      Alert.alert(
        'Ошибка',
        getApiErrorMessage(
          error,
          mediaType === 'audio'
            ? 'Не удалось отправить голосовое сообщение'
            : 'Не удалось отправить видео-сообщение',
        ),
      );
    }
  };

  const handleCapturedMedia = async (asset: PickedMediaAsset) => {
    await sendMediaMessage(
      captureMode === 'video' ? 'video_note' : 'audio',
      asset,
      captureMode === 'video'
        ? {
            is_video_note: true,
            aspect_ratio: '1:1',
            shape: 'circle',
          }
        : undefined,
    );
  };

  const closeCaptureSafely = async () => {
    if (captureBusy) return;

    try {
      audioCancelRequestedRef.current = true;
      const pendingStart = audioStartPromiseRef.current;
      const recording =
        audioRecordingRef.current ||
        audioRecording ||
        (pendingStart ? await pendingStart.catch(() => null) : null);

      if (recording) {
        await recording.stopAndUnloadAsync().catch(() => null);
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        }).catch(() => null);

        audioRecordingRef.current = null;
        setAudioRecording(null);
      }

      audioStartPromiseRef.current = null;
      lastAudioDurationMsRef.current = 0;

      if (videoRecording) {
        cameraRef.current?.stopRecording?.();
        setVideoRecording(false);
      }

      setAudioDurationMs(0);
      setVoiceLocked(false);
      setVideoDurationMs(0);
    } finally {
      setCaptureVisible(false);
    }
  };

  const startAudioRecording = async (): Promise<Audio.Recording | null> => {
    if (audioRecordingRef.current) {
      return audioRecordingRef.current;
    }

    try {
      setCaptureBusy(true);
      audioCancelRequestedRef.current = false;
      lastAudioDurationMsRef.current = 0;
      setAudioDurationMs(0);

      let permission = await Audio.getPermissionsAsync();
      if (!permission.granted) {
        permission = await Audio.requestPermissionsAsync();
      }

      if (!permission.granted) {
        Alert.alert('Нет доступа', 'Разрешите микрофон для записи голосовых сообщений.');
        return null;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => {
          const nextDuration =
            typeof status.durationMillis === 'number' ? status.durationMillis : 0;
          lastAudioDurationMsRef.current = nextDuration;
          setAudioDurationMs(nextDuration);
        },
        100,
      );

      if (audioCancelRequestedRef.current) {
        await recording.stopAndUnloadAsync().catch(() => null);
        return null;
      }

      audioRecordingRef.current = recording;
      setAudioRecording(recording);
      audioPressStartedAtRef.current = Date.now();

      return recording;
    } catch (error) {
      console.error('startAudioRecording error:', error);
      Alert.alert('Ошибка', 'Не удалось начать запись голосового сообщения');
      return null;
    } finally {
      setCaptureBusy(false);
    }
  };

  const beginAudioRecording = () => {
    if (captureBusy || audioRecordingRef.current || audioStartPromiseRef.current) {
      return;
    }

    const promise = startAudioRecording();
    audioStartPromiseRef.current = promise;

    promise.finally(() => {
      if (audioStartPromiseRef.current === promise) {
        audioStartPromiseRef.current = null;
      }
    });
  };

  const stopAudioRecordingAndSend = async (recordingParam?: Audio.Recording | null) => {
    const recording = recordingParam || audioRecordingRef.current || audioRecording;
    if (!recording) return;

    try {
      setCaptureBusy(true);
      audioStartPromiseRef.current = null;
      audioCancelRequestedRef.current = false;

      const statusBeforeStop = await recording.getStatusAsync().catch(() => null);
      await recording.stopAndUnloadAsync();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const uri = recording.getURI();
      const durationMillis =
        Number((statusBeforeStop as any)?.durationMillis || 0) ||
        lastAudioDurationMsRef.current ||
        (audioPressStartedAtRef.current ? Date.now() - audioPressStartedAtRef.current : 0) ||
        1000;
      const durationSeconds = Math.max(1, Math.ceil(durationMillis / 1000));

      audioRecordingRef.current = null;
      setAudioRecording(null);
      setVoiceLocked(false);
      audioPressStartedAtRef.current = null;

      if (durationMillis < 350) {
        setAudioDurationMs(0);
        lastAudioDurationMsRef.current = 0;
        setCaptureVisible(false);
        return;
      }

      if (!uri) {
        Alert.alert('Ошибка', 'Не удалось получить аудиофайл');
        return;
      }

      await handleCapturedMedia({
        uri,
        fileName: `voice-${Date.now()}${Platform.OS === 'web' ? '.webm' : '.m4a'}`,
        mimeType: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4',
        duration: durationSeconds,
        mediaKind: 'audio',
      });

      setAudioDurationMs(0);
      lastAudioDurationMsRef.current = 0;
      setCaptureVisible(false);
    } catch (error) {
      console.error('stopAudioRecordingAndSend error:', error);
      Alert.alert('Ошибка', 'Не удалось отправить голосовое сообщение');
    } finally {
      setCaptureBusy(false);
    }
  };

  const ensureVideoPermissions = useCallback(async () => {
    const cameraStatus = cameraPermission?.granted
      ? cameraPermission
      : await requestCameraPermission();

    if (!cameraStatus?.granted) {
      Alert.alert('Нет доступа', 'Разреши камеру для записи видео.');
      return false;
    }

    const micStatus = microphonePermission?.granted
      ? microphonePermission
      : await requestMicrophonePermission();

    if (!micStatus?.granted) {
      Alert.alert('Нет доступа', 'Разреши микрофон для записи видео.');
      return false;
    }

    return true;
  }, [
    cameraPermission,
    microphonePermission,
    requestCameraPermission,
    requestMicrophonePermission,
  ]);

  useEffect(() => {
    if (captureVisible && captureMode === 'video') {
      void ensureVideoPermissions();
    }
  }, [captureVisible, captureMode, ensureVideoPermissions]);

  const startVideoRecording = async () => {
    try {
      setCaptureBusy(true);

      const granted = await ensureVideoPermissions();
      if (!granted) {
        return;
      }

      if (!cameraRef.current || !cameraReady) {
        Alert.alert('Камера не готова', 'Подожди секунду и попробуй снова.');
        return;
      }

      videoStartedAtRef.current = Date.now();
      setVideoDurationMs(0);
      setVideoRecording(true);

      const result = await cameraRef.current.recordAsync?.({
        maxDuration: VIDEO_MAX_DURATION_SECONDS,
        ...(Platform.OS === 'ios' ? { maxFileSize: VIDEO_MAX_FILE_SIZE_BYTES } : {}),
        videoBitrate: VIDEO_BITRATE,
        videoQuality: Platform.OS === 'android' ? '480p' : '4:3',
        codec: Platform.OS === 'ios' ? 'avc1' : undefined,
      });

      const startedAt = videoStartedAtRef.current || Date.now();
      const elapsedMs = Math.max(1000, Date.now() - startedAt);
      const durationSeconds = Math.max(
        1,
        Math.ceil(Math.min(elapsedMs, VIDEO_MAX_DURATION_SECONDS * 1000) / 1000),
      );

      videoStartedAtRef.current = null;
      setVideoRecording(false);

      if (!result?.uri) {
        Alert.alert('Ошибка', 'Не удалось записать видео');
        return;
      }

      await handleCapturedMedia({
        uri: result.uri,
        fileName: `video-${Date.now()}.mp4`,
        mimeType: 'video/mp4',
        duration: durationSeconds,
      });

      setVideoDurationMs(0);
      setCaptureVisible(false);
    } catch (error) {
      console.error('startVideoRecording error:', error);
      setVideoRecording(false);
      Alert.alert('Ошибка', 'Не удалось записать видео');
    } finally {
      setCaptureBusy(false);
    }
  };

  const stopVideoRecording = () => {
    try {
      cameraRef.current?.stopRecording?.();
    } catch (error) {
      console.error('stopVideoRecording error:', error);
    }
  };

  const handlePickMediaFromGallery = async () => {
    let pickedKind: 'image' | 'video' = 'image';
    let clientUuid: string | null = null;

    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          Alert.alert('Нет доступа', 'Разреши доступ к фото и видео, чтобы отправлять медиа в чат.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.72,
        allowsEditing: false,
        videoMaxDuration: VIDEO_MAX_DURATION_SECONDS,
      });

      if (result.canceled || !result.assets?.[0] || !chatUuid) {
        return;
      }

      const asset = result.assets[0] as PickedMediaAsset & { type?: string | null };
      pickedKind = getPickedMediaKind(asset);

      const messageType = pickedKind === 'video' ? 'video' : 'image';
      const filenamePrefix = messageType === 'video' ? 'video' : 'photo';
      const fallbackContentType = messageType === 'video' ? 'video/mp4' : 'image/jpeg';

      clientUuid = generateUUIDv4();
      const optimisticReply = buildReplyPayload(replyTo);

      const optimisticMessage: MessageItem = {
        uuid: `local-${clientUuid}`,
        client_uuid: clientUuid,
        message_type: messageType,
        text: '',
        is_own_message: true,
        delivery_status: 'sent',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        local_status: 'pending',
        reply_to: optimisticReply,
        metadata: {
          upload_progress: 0,
        },
        attachments: asset.uri
          ? [
              {
                uuid: `local-attachment-${clientUuid}`,
                file_url: asset.uri,
                content_type: fallbackContentType,
                original_name: asset.fileName || undefined,
                media_kind: messageType,
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

      const uploaded = await uploadChatAsset(asset, {
        filenamePrefix,
        fallbackContentType,
        fallbackExtension: messageType === 'video' ? '.mp4' : '.jpg',
        mediaKind: messageType,
        durationSeconds:
          messageType === 'video'
            ? Math.max(1, Math.ceil(Number(asset.duration || 1)))
            : undefined,
        onProgress: (progress) => setUploadProgress(clientUuid!, progress),
      });

      const savedMessage = await sendChatMessage(chatUuid, {
        client_uuid: clientUuid,
        message_type: messageType,
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
      console.error('handlePickMediaFromGallery error:', error);

      if (chatUuid && clientUuid) {
        setMessages((current) => {
          const next = current.map((message) =>
            message.client_uuid === clientUuid
              ? {
                  ...message,
                  local_status: 'failed',
                  metadata: {
                    ...(message.metadata || {}),
                    local_upload_error: getApiErrorMessage(error, 'Upload failed'),
                  },
                }
              : message,
          );

          void saveCachedChatMessages(chatUuid, next);
          return next;
        });
      }

      Alert.alert(
        'Ошибка',
        getApiErrorMessage(
          error,
          pickedKind === 'video'
            ? 'Не удалось отправить видео'
            : 'Не удалось отправить фото',
        ),
      );
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

    if (!chatUuid || !text || sendLockRef.current) return;

    sendLockRef.current = true;

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
      sendLockRef.current = false;
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

  const retryMediaMessage = async (message: MessageItem) => {
    if (!chatUuid || !message.client_uuid) return;

    const retryableTypes = ['image', 'video', 'video_note', 'audio', 'file'];
    if (!retryableTypes.includes(message.message_type)) return;

    const attachment = message.attachments?.[0];
    const localUri = attachment?.file_url;

    if (!localUri) {
      Alert.alert('Не удалось повторить', 'Локальный файл больше недоступен. Выберите медиа заново.');
      return;
    }

    const messageType = message.message_type;
    const fallbackContentType =
      messageType === 'image'
        ? 'image/jpeg'
        : messageType === 'audio'
          ? 'audio/mp4'
          : messageType === 'file'
            ? attachment.content_type || 'application/octet-stream'
            : 'video/mp4';
    const filenamePrefix =
      messageType === 'image'
        ? 'photo'
        : messageType === 'audio'
          ? 'voice'
          : messageType === 'file'
            ? 'file'
            : 'video';
    const fallbackExtension =
      messageType === 'image'
        ? '.jpg'
        : messageType === 'audio'
          ? Platform.OS === 'web'
            ? '.webm'
            : '.m4a'
          : messageType === 'file'
            ? ''
            : '.mp4';

    patchLocalMessage(message.client_uuid, (item) => ({
      ...item,
      local_status: 'pending',
      metadata: {
        ...(item.metadata || {}),
        upload_progress: 0,
      },
    }));

    try {
      const uploaded = await uploadChatAsset(
        {
          uri: localUri,
          fileName: attachment.original_name || undefined,
          mimeType: attachment.content_type || fallbackContentType,
          mediaKind: messageType === 'video_note' ? 'video' : messageType,
        },
        {
          filenamePrefix,
          fallbackContentType,
          fallbackExtension,
          mediaKind: messageType === 'video_note' ? 'video' : messageType,
          onProgress: (progress) => setUploadProgress(message.client_uuid!, progress),
        },
      );

      const serverMetadata = getServerMetadata(message.metadata);
      const savedMessage = await sendChatMessage(chatUuid, {
        client_uuid: message.client_uuid,
        message_type: messageType,
        text: message.text || '',
        attachment_uuids: [uploaded.uuid],
        ...(Object.keys(serverMetadata).length ? { metadata: serverMetadata } : {}),
        ...(message.reply_to?.uuid ? { reply_to_uuid: message.reply_to.uuid } : {}),
      });

      patchLocalMessage(message.client_uuid, () => ({
        ...savedMessage,
        local_status: 'sent',
      }));
    } catch (error) {
      console.error('retryMediaMessage error:', error);
      patchLocalMessage(message.client_uuid, (item) => ({
        ...item,
        local_status: 'failed',
        metadata: {
          ...(item.metadata || {}),
          local_upload_error: getApiErrorMessage(error, 'Upload failed'),
        },
      }));
    }
  };

  const openAudioRecorder = () => {
    if (canSend || captureBusy || audioRecordingRef.current || audioStartPromiseRef.current) {
      return;
    }

    if (composerPanelVisible) {
      closeComposerPanel();
    }

    audioCancelRequestedRef.current = false;
    audioPressStartedAtRef.current = null;
    lastAudioDurationMsRef.current = 0;
    setAudioDurationMs(0);
    setVoiceLocked(true);
    setCaptureMode('audio');
    setCaptureVisible(true);
  };

  const openVideoNoteRecorder = () => {
    if (canSend || captureBusy) {
      return;
    }

    if (composerPanelVisible) {
      closeComposerPanel();
    }

    setCaptureMode('video');
    setCaptureVisible(true);
  };

  type CallType = 'audio' | 'video';

  const ensureCallPermissions = async (callType: CallType) => {
    if (callType === 'video') {
      return await ensureVideoPermissions();
    }

    const permission = audioPermission?.granted
      ? audioPermission
      : await requestAudioPermission();

    if (!permission?.granted) {
      Alert.alert('Нет доступа', 'Разреши микрофон для аудио-звонков.');
      return false;
    }

    return true;
  };

  const startChatCall = async (callType: CallType) => {
    if (!chatUuid || callingKey) {
      return;
    }

    try {
      setCallingKey(callType);

      const allowed = await ensureCallPermissions(callType);
      if (!allowed) {
        return;
      }

      const created = await startOutgoing(chatUuid, callType);

      if (created?.uuid) {
        router.push({
          pathname: '/(app)/call/[callUuid]',
          params: { callUuid: created.uuid },
        });
      }
    } catch (error: any) {
      console.error('startChatCall error:', error);
      Alert.alert(
        'Звонок не запущен',
        getApiErrorMessage(
          error,
          'Не удалось начать звонок. Проверьте интернет и попробуйте ещё раз.',
        ),
      );
    } finally {
      setCallingKey(null);
    }
  };

  const renderMessage = ({ item }: { item: MessageItem }) => {
    const isOwn = Boolean(item.is_own_message);
    const metaColor = isOwn ? 'rgba(255,255,255,0.82)' : theme.colors.muted;
    const stickerImage = getStickerImage(item);
    const stickerEmoji = getStickerEmoji(item);
    const uploadProgress = getUploadProgress(item);
    const isMediaMessage =
      item.message_type === 'image' ||
      item.message_type === 'video' ||
      item.message_type === 'video_note' ||
      item.message_type === 'audio' ||
      item.message_type === 'file';

    const renderMeta = () => (
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
          {formatTime(item.created_at, timeNowMs)}
        </Text>

        {isOwn ? <MessageStatusIcon message={item} color={metaColor} /> : null}
      </View>
    );

    if (isMediaMessage && !stickerImage) {
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
                void retryMediaMessage(item);
              }
            }}
            style={[
              styles.mediaMessageShell,
              {
                alignSelf: isOwn ? 'flex-end' : 'flex-start',
              },
            ]}
          >
            {!!item.reply_to?.text && (
              <View
                style={[
                  styles.replyBox,
                  styles.mediaReplyBox,
                  {
                    borderColor: isOwn ? 'rgba(255,255,255,0.24)' : theme.colors.borderStrong,
                    backgroundColor: isOwn ? 'rgba(0,0,0,0.16)' : theme.colors.cardStrong,
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

            <MessageMedia message={item} isOwn={isOwn} theme={theme} />

            {item.local_status === 'pending' && uploadProgress !== null ? (
              <View style={[styles.uploadProgressTrack, { backgroundColor: theme.colors.border }]}>
                <View
                  style={[
                    styles.uploadProgressFill,
                    {
                      width: `${uploadProgress}%`,
                      backgroundColor: theme.colors.primary,
                    },
                  ]}
                />
              </View>
            ) : null}

            {item.local_status === 'failed' ? (
              <Text style={[styles.uploadRetryText, { color: theme.colors.danger }]}>
                Не отправлено. Нажмите, чтобы повторить.
              </Text>
            ) : null}

            {!!item.text?.trim() && (
              <Text
                style={[
                  styles.mediaCaptionText,
                  {
                    color: theme.colors.text,
                    backgroundColor: theme.colors.cardStrong,
                    fontSize: 14 * textScale,
                    lineHeight: 20 * textScale,
                  },
                ]}
              >
                {item.text}
              </Text>
            )}

            <View
              style={[
                styles.mediaMetaPill,
                {
                  alignSelf: isOwn ? 'flex-end' : 'flex-start',
                  backgroundColor: isOwn ? 'rgba(0,0,0,0.32)' : theme.colors.cardStrong,
                },
              ]}
            >
              {renderMeta()}
            </View>
          </Pressable>
        </View>
      );
    }

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
                cachePolicy="memory-disk"
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
          ) : (
            <Text
              style={[
                styles.messageText,
                {
                  color: isOwn ? '#FFFFFF' : theme.colors.text,
                  fontSize: 15 * textScale,
                  lineHeight: 21 * textScale,
                },
              ]}
            >
              {item.is_deleted ? 'Сообщение удалено' : item.text || ''}
            </Text>
          )}

          {renderMeta()}
        </Pressable>
      </View>
    );
  };
  if (loadingChat || loadingMessages) {
    return (
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[styles.container, buildChatBackgroundStyle(theme, appearance)]}
      >
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, buildChatBackgroundStyle(theme, appearance)]}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {appearance.backgroundImageUri ? (
          <ExpoImage
            source={{ uri: appearance.backgroundImageUri }}
            style={StyleSheet.absoluteFill}
            contentFit={appearance.backgroundSizeMode === 'contain' ? 'contain' : 'cover'}
            cachePolicy="memory-disk"
          />
        ) : null}

        {!appearance.backgroundImageUri && appearance.backgroundPreset === 'gradient' ? (
          <LinearGradient colors={theme.colors.heroGradient} style={StyleSheet.absoluteFill} />
        ) : null}

        {appearance.gradientPreset && appearance.gradientPreset !== 'none' ? (
          <LinearGradient
            colors={
              appearance.gradientPreset === 'sunrise'
                ? ['#FEF3C7', '#F97316']
                : appearance.gradientPreset === 'ocean'
                  ? ['#0EA5E9', '#22D3EE']
                  : ['#7C3AED', '#DB2777']
            }
            style={StyleSheet.absoluteFill}
          />
        ) : null}

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
            {getHeaderAvatarUrl(chat) ? (
              <ExpoImage
                source={{ uri: getHeaderAvatarUrl(chat)! }}
                style={styles.headerAvatarImage}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
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
            )}

            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>
                {formatChatTitle(chat)}
              </Text>
              <Text style={[styles.headerSub, { color: theme.colors.muted }]} numberOfLines={1}>
                {formatChatSub(chat, presence)}
              </Text>
            </View>
          </Pressable>

          <View style={styles.headerCallGroup}>
            <Pressable
              onPress={() => void startChatCall('audio')}
              disabled={Boolean(callingKey)}
              style={[
                styles.headerCallButton,
                {
                  backgroundColor: callingKey === 'audio' ? theme.colors.primary : theme.colors.primarySoft,
                  opacity: callingKey && callingKey !== 'audio' ? 0.55 : 1,
                },
              ]}
            >
              {callingKey === 'audio' ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="call" size={18} color={theme.colors.primary} />
              )}
            </Pressable>

            <Pressable
              onPress={() => void startChatCall('video')}
              disabled={Boolean(callingKey)}
              style={[
                styles.headerCallButton,
                {
                  backgroundColor: callingKey === 'video' ? theme.colors.primary : theme.colors.primarySoft,
                  opacity: callingKey && callingKey !== 'video' ? 0.55 : 1,
                },
              ]}
            >
              {callingKey === 'video' ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="videocam" size={18} color={theme.colors.primary} />
              )}
            </Pressable>
          </View>

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

        {chat?.chat_type === 'direct' && chat?.peer_user?.uuid && showQuickActions && !isBlocked && !isContact ? (
          <View style={[styles.quickActionsBar, { borderBottomColor: theme.colors.borderStrong }]}>
            {!isContact ? (
              <Pressable
                onPress={() => void handleAddToContacts()}
                style={[styles.quickActionBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
              >
                <Text style={[styles.quickActionText, { color: theme.colors.text }]}>
                  Добавить в контакты
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => void handleBlockLocal()}
              style={[styles.quickActionBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
            >
              <Text style={[styles.quickActionText, { color: theme.colors.danger }]}>
                Заблокировать
              </Text>
            </Pressable>
          </View>
        ) : null}

        <FlatList
          ref={listRef}
          data={visibleMessages}
          keyExtractor={(item) => item.uuid}
          renderItem={renderMessage}
          initialNumToRender={18}
          maxToRenderPerBatch={12}
          updateCellsBatchingPeriod={40}
          windowSize={9}
          removeClippedSubviews={Platform.OS !== 'web'}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.listContent,
            {
              paddingBottom: 18,
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
                bottom: composerBottomPadding + composerHeight + 12,
              },
            ]}
          >
            <Ionicons name="chevron-down" size={20} color="#FFFFFF" />
          </Pressable>
        ) : null}

        <View
          onLayout={(event) => {
            const nextHeight = Math.ceil(event.nativeEvent.layout.height);
            if (nextHeight > 0 && Math.abs(nextHeight - composerHeight) > 2) {
              setComposerHeight(nextHeight);
            }
          }}
          style={[
            styles.composerShell,
            {
              borderTopColor: theme.colors.borderStrong,
              backgroundColor: theme.colors.background,
              paddingBottom: composerBottomPadding,
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
                name={composerPanelVisible ? 'chevron-down' : 'happy-outline'}
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
                onChangeText={setDraft}
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
                scrollEnabled
                maxLength={4000}
                textAlignVertical="top"
              />
            </View>

            <Pressable
              onPress={() => void handlePickMediaFromGallery()}
              style={[
                styles.toolButton,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              ]}
            >
              <Ionicons name="images-outline" size={19} color={theme.colors.text} />
            </Pressable>

            {!canSend ? (
              <Pressable
                onPress={openVideoNoteRecorder}
                style={[
                  styles.toolButton,
                  { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                ]}
              >
                <Ionicons name="radio-button-on-outline" size={19} color={theme.colors.text} />
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => {
                if (canSend) {
                  void handleSend();
                  return;
                }

                openAudioRecorder();
              }}
              disabled={captureBusy}
              style={[
                styles.primaryActionButton,
                {
                  backgroundColor: canSend ? theme.colors.primary : theme.colors.cardStrong,
                  borderColor: canSend ? 'transparent' : theme.colors.borderStrong,
                  opacity: captureBusy ? 0.6 : 1,
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
                      name="happy-outline"
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
                            cachePolicy="memory-disk"
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

      <Modal
        visible={captureVisible}
        transparent
        animationType="fade"
        onRequestClose={() => void closeCaptureSafely()}
      >
        {captureMode === 'audio' ? (
          <View style={styles.audioOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => void closeCaptureSafely()} />

            <View
              style={[
                styles.audioSheet,
                {
                  backgroundColor: theme.colors.cardSolid,
                  borderColor: theme.colors.borderStrong,
                },
              ]}
            >
              <View
                style={[
                  styles.audioIconWrap,
                  {
                    backgroundColor: theme.colors.primarySoft,
                  },
                ]}
              >
                <Ionicons
                  name={audioRecording ? 'mic' : 'mic-outline'}
                  size={30}
                  color={theme.colors.primary}
                />
              </View>

              <Text style={[styles.audioTitle, { color: theme.colors.text }]}>
                Голосовое сообщение
              </Text>

              <Text style={[styles.audioTimer, { color: theme.colors.muted }]}>
                {formatMillis(audioDurationMs)}
              </Text>

              <Text style={[styles.audioHint, { color: theme.colors.muted }]}>
                {audioRecording
                  ? voiceLocked
                    ? 'Запись идёт. Нажмите “Отправить” или “Отмена”.'
                    : 'Отпустите кнопку для отправки или закрепите запись.'
                  : 'Нажмите “Записать”, затем отправьте или отмените голосовое.'}
              </Text>

              <View style={styles.audioActions}>
                <Pressable
                  onPress={() => void closeCaptureSafely()}
                  style={[
                    styles.secondaryBtn,
                    {
                      borderColor: theme.colors.borderStrong,
                      backgroundColor: theme.colors.backgroundTertiary,
                    },
                  ]}
                >
                  <Text style={[styles.secondaryBtnText, { color: theme.colors.text }]}>
                    Отмена
                  </Text>
                </Pressable>

                {audioRecording && !voiceLocked ? (
                  <Pressable
                    onPress={() => setVoiceLocked(true)}
                    style={[
                      styles.secondaryBtn,
                      {
                        borderColor: theme.colors.borderStrong,
                        backgroundColor: theme.colors.primarySoft,
                      },
                    ]}
                  >
                    <Text style={[styles.secondaryBtnText, { color: theme.colors.primary }]}>
                      Закрепить
                    </Text>
                  </Pressable>
                ) : null}

                {!audioRecording ? (
                  <Pressable
                    onPress={beginAudioRecording}
                    disabled={captureBusy}
                    style={[
                      styles.primaryBtn,
                      {
                        backgroundColor: theme.colors.primary,
                      },
                    ]}
                  >
                    {captureBusy ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="radio-button-on" size={18} color="#FFFFFF" />
                        <Text style={styles.primaryBtnText}>Записать</Text>
                      </>
                    )}
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => void stopAudioRecordingAndSend()}
                    disabled={captureBusy}
                    style={[
                      styles.primaryBtn,
                      {
                        backgroundColor: theme.colors.primary,
                      },
                    ]}
                  >
                    {captureBusy ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="send" size={18} color="#FFFFFF" />
                        <Text style={styles.primaryBtnText}>Отправить</Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.videoOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => void closeCaptureSafely()} />

            <View
              style={[
                styles.videoSheet,
                {
                  backgroundColor: theme.colors.cardSolid,
                  borderColor: theme.colors.borderStrong,
                },
              ]}
            >
              <View style={styles.videoTopRow}>
                <Pressable
                  onPress={() => void closeCaptureSafely()}
                  style={[
                    styles.videoIconBtn,
                    {
                      backgroundColor: theme.colors.backgroundTertiary,
                    },
                  ]}
                >
                  <Ionicons name="close" size={20} color={theme.colors.text} />
                </Pressable>

                <View
                  style={[
                    styles.videoPill,
                    {
                      backgroundColor: theme.colors.backgroundTertiary,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.videoPillDot,
                      {
                        opacity: videoRecording ? 1 : 0.45,
                      },
                    ]}
                  />
                  <Text style={[styles.videoPillText, { color: theme.colors.text }]}>
                    {videoRecording
                      ? formatSecondsRemaining(Math.max(0, VIDEO_MAX_DURATION_SECONDS * 1000 - videoDurationMs))
                      : 'Лимит 00:30'}
                  </Text>
                </View>

                <Pressable
                  onPress={() => setCameraTorch((current) => !current)}
                  style={[
                    styles.videoIconBtn,
                    {
                      backgroundColor: theme.colors.backgroundTertiary,
                    },
                  ]}
                >
                  <Ionicons
                    name={cameraTorch ? 'flash' : 'flash-off'}
                    size={18}
                    color={theme.colors.text}
                  />
                </Pressable>
              </View>

              <View
                style={[
                  styles.cameraCircleOuter,
                  {
                    borderColor: theme.colors.borderStrong,
                    backgroundColor: '#000000',
                  },
                ]}
              >
                {captureVisible && cameraPermission?.granted && microphonePermission?.granted ? (
                  <View style={styles.cameraCircleInner}>
                    <CameraView
                      ref={cameraRef}
                      style={styles.cameraView}
                      facing={cameraFacing}
                      mode="video"
                      active={captureVisible}
                      enableTorch={cameraTorch}
                      mirror={cameraFacing === 'front'}
                      mute={false}
                      onCameraReady={() => setCameraReady(true)}
                    />
                  </View>
                ) : (
                  <View style={styles.cameraFallback}>
                    <Ionicons name="videocam-outline" size={42} color={theme.colors.primary} />
                    <Text style={[styles.cameraFallbackTitle, { color: theme.colors.text }]}>
                      Нужен доступ
                    </Text>
                    <Text style={[styles.cameraFallbackText, { color: theme.colors.muted }]}>
                      Разреши камеру и микрофон для записи видео-сообщений
                    </Text>

                    <Pressable
                      onPress={() => void ensureVideoPermissions()}
                      style={[
                        styles.permissionBtn,
                        {
                          backgroundColor: theme.colors.primary,
                        },
                      ]}
                    >
                      <Text style={styles.permissionBtnText}>Разрешить</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              <Text style={[styles.videoCaption, { color: theme.colors.muted }]}>
                Видео записывается в кружке, до 30 секунд, в лёгком качестве для меньшего веса.
              </Text>

              <View style={styles.videoBottomRow}>
                <Pressable
                  onPress={() =>
                    setCameraFacing((current) => (current === 'back' ? 'front' : 'back'))
                  }
                  style={[
                    styles.videoControlBtn,
                    {
                      backgroundColor: theme.colors.backgroundTertiary,
                    },
                  ]}
                >
                  <Ionicons name="camera-reverse-outline" size={22} color={theme.colors.text} />
                </Pressable>

                {!videoRecording ? (
                  <Pressable
                    onPress={() => void startVideoRecording()}
                    disabled={captureBusy || !cameraPermission?.granted || !microphonePermission?.granted || !cameraReady}
                    style={styles.recordButtonWrap}
                  >
                    <View
                      style={[
                        styles.recordButtonOuter,
                        {
                          borderColor: theme.colors.primary,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.recordButtonInner,
                          {
                            backgroundColor: theme.colors.primary,
                          },
                        ]}
                      />
                    </View>
                  </Pressable>
                ) : (
                  <Pressable onPress={stopVideoRecording} style={styles.recordButtonWrap}>
                    <View
                      style={[
                        styles.stopButtonOuter,
                        {
                          borderColor: theme.colors.primary,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.stopButtonInner,
                          {
                            backgroundColor: theme.colors.primary,
                          },
                        ]}
                      />
                    </View>
                  </Pressable>
                )}

                <View style={styles.videoControlGhost} />
              </View>
            </View>
          </View>
        )}
      </Modal>

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

              <Pressable
                onPress={() => {
                  handleShowMessageInfo();
                  setActionMenuVisible(false);
                }}
                style={[styles.sheetItem, { borderColor: theme.colors.borderStrong }]}
              >
                <Ionicons name="information-circle-outline" size={18} color={theme.colors.primary} />
                <Text style={[styles.sheetItemText, { color: theme.colors.text }]}>
                  Информация
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
                onPress={() => {
                  setSettingsVisible(false);
                  setAppearanceVisible(true);
                }}
                style={[styles.sheetItem, { borderColor: theme.colors.borderStrong }]}
              >
                <Ionicons name="color-palette-outline" size={18} color={theme.colors.primary} />
                <Text style={[styles.sheetItemText, { color: theme.colors.text }]}>
                  Оформление этого чата
                </Text>
              </Pressable>

              {chat?.chat_type === 'group' ? (
                <Pressable
                  onPress={() => {
                    setSettingsVisible(false);
                    router.push({
                      pathname: '/(app)/group-members/[chatUuid]',
                      params: { chatUuid },
                    });
                  }}
                  style={[styles.sheetItem, { borderColor: theme.colors.borderStrong }]}
                >
                  <Ionicons name="people-outline" size={18} color={theme.colors.primary} />
                  <Text style={[styles.sheetItemText, { color: theme.colors.text }]}>
                    Group members
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => {
                  setSettingsVisible(false);
                  router.push({
                    pathname: '/(app)/chat-bots/[chatUuid]',
                    params: { chatUuid },
                  });
                }}
                style={[styles.sheetItem, { borderColor: theme.colors.borderStrong }]}
              >
                <Ionicons name="sparkles-outline" size={18} color={theme.colors.primary} />
                <Text style={[styles.sheetItemText, { color: theme.colors.text }]}>
                  Bots
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setSettingsVisible(false);
                  router.push('/(app)/blocked-users');
                }}
                style={[styles.sheetItem, { borderColor: theme.colors.borderStrong }]}
              >
                <Ionicons name="ban-outline" size={18} color={theme.colors.primary} />
                <Text style={[styles.sheetItemText, { color: theme.colors.text }]}>
                  Черный список
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
        visible={appearanceVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAppearanceVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAppearanceVisible(false)} />

          <View style={[styles.sheetWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <GlassCard>
              <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>
                Оформление этого чата
              </Text>

              <Pressable
                onPress={() => void handlePickChatBackground()}
                style={[styles.sheetItem, { borderColor: theme.colors.borderStrong }]}
              >
                <Ionicons name="image-outline" size={18} color={theme.colors.primary} />
                <Text style={[styles.sheetItemText, { color: theme.colors.text }]}>
                  Фон из галереи
                </Text>
              </Pressable>

              <View style={styles.reasonWrap}>
                {(['none', 'sunrise', 'ocean', 'violet'] as const).map((preset) => (
                  <Pressable
                    key={preset}
                    onPress={() => void updateAppearance({ gradientPreset: preset })}
                    style={[
                      styles.reasonChip,
                      {
                        borderColor: theme.colors.borderStrong,
                        backgroundColor:
                          appearance.gradientPreset === preset
                            ? theme.colors.primary
                            : 'transparent',
                      },
                    ]}
                  >
                    <Text style={{ color: appearance.gradientPreset === preset ? '#fff' : theme.colors.text }}>
                      {preset}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                value={appearance.customBackgroundColor || ''}
                onChangeText={(value) => void updateAppearance({ customBackgroundColor: value })}
                placeholder="#0F172A фон"
                placeholderTextColor={theme.colors.muted}
                style={[styles.reportInput, { borderColor: theme.colors.borderStrong, color: theme.colors.text }]}
              />

              <TextInput
                value={appearance.customOwnBubbleColor || ''}
                onChangeText={(value) => void updateAppearance({ customOwnBubbleColor: value })}
                placeholder="#F97316 мои сообщения"
                placeholderTextColor={theme.colors.muted}
                style={[styles.reportInput, { borderColor: theme.colors.borderStrong, color: theme.colors.text }]}
              />

              <TextInput
                value={appearance.customPeerBubbleColor || ''}
                onChangeText={(value) => void updateAppearance({ customPeerBubbleColor: value })}
                placeholder="#1F2937 сообщения собеседника"
                placeholderTextColor={theme.colors.muted}
                style={[styles.reportInput, { borderColor: theme.colors.borderStrong, color: theme.colors.text }]}
              />
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
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },

  quickActionsBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
  },

  quickActionBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  quickActionText: {
    fontSize: 12,
    fontWeight: '700',
  },

  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerCallGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  headerCallButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerCenter: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },

  headerAvatarText: {
    fontSize: 16,
    fontWeight: '800',
  },

  headerTitle: {
    fontSize: 16,
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

  mediaMessageShell: {
    maxWidth: '86%',
    minWidth: 78,
    borderRadius: 24,
    overflow: 'hidden',
  },

  mediaReplyBox: {
    borderRadius: 16,
    paddingVertical: 8,
    paddingRight: 10,
    marginBottom: 8,
  },

  mediaCaptionText: {
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },

  uploadProgressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
  },
  uploadProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  uploadRetryText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '800',
  },

  mediaMetaPill: {
    marginTop: 6,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
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
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
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
    maxHeight: 136,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    justifyContent: 'center',
  },

  input: {
    fontSize: 15,
    lineHeight: 20,
    minHeight: 28,
    maxHeight: 112,
    paddingTop: 0,
    paddingBottom: 0,
  },

  primaryActionButton: {
    width: 50,
    height: 50,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
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

  audioOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.34)',
    justifyContent: 'flex-end',
    padding: 14,
  },

  audioSheet: {
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 20,
    alignItems: 'center',
  },

  audioIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  audioTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },

  audioTimer: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },

  audioHint: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },

  audioActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },

  secondaryBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },

  primaryBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },

  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  videoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.34)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },

  videoSheet: {
    width: '100%',
    borderRadius: 30,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    alignItems: 'center',
  },

  videoTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  videoIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  videoPill: {
    minHeight: 40,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  videoPillDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#FF4D4F',
  },

  videoPillText: {
    fontSize: 14,
    fontWeight: '800',
  },

  cameraCircleOuter: {
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  cameraCircleInner: {
    width: 286,
    height: 286,
    borderRadius: 143,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },

  cameraView: {
    width: '100%',
    height: '100%',
  },

  cameraFallback: {
    width: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cameraFallbackTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 6,
  },

  cameraFallbackText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },

  permissionBtn: {
    minWidth: 140,
    minHeight: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },

  permissionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  videoCaption: {
    marginTop: 14,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
  },

  videoBottomRow: {
    marginTop: 18,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  videoControlBtn: {
    width: 52,
    height: 52,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  videoControlGhost: {
    width: 52,
    height: 52,
  },

  recordButtonWrap: {
    width: 86,
    height: 86,
    alignItems: 'center',
    justifyContent: 'center',
  },

  recordButtonOuter: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  recordButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },

  stopButtonOuter: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  stopButtonInner: {
    width: 34,
    height: 34,
    borderRadius: 10,
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
