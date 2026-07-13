import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Video, ResizeMode, type AVPlaybackStatus } from 'expo-av';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import {
  fetchStories,
  markStoryViewed,
  reactToStory,
  replyToStory,
} from '@/src/lib/api/stories';
import type { StoryActionResponse, StoryItem } from '@/src/types/stories';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getApiErrorMessage } from '@/src/utils/apiErrors';

const IMAGE_DURATION_MS = 7000;
const DEFAULT_VIDEO_DURATION_MS = 10_000;
const reactions = ['❤️', '🔥', '👏', '😍', '👍'];

function getAuthor(story: StoryItem) {
  return story.author || story.user || null;
}

function getAuthorName(story: StoryItem | null) {
  const author = story ? getAuthor(story) : null;
  return (
    author?.full_name ||
    [author?.first_name, author?.last_name].filter(Boolean).join(' ') ||
    author?.username ||
    'История'
  );
}

function formatStoryTime(value?: string | null) {
  if (!value) return 'недавно';
  const createdAt = new Date(value).getTime();
  if (!Number.isFinite(createdAt)) return 'недавно';
  const minutes = Math.max(0, Math.floor((Date.now() - createdAt) / 60_000));
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин.`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} ч.` : `${Math.floor(hours / 24)} дн.`;
}

export default function StoryViewerScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ storyUuid?: string | string[] }>();
  const storyUuid = Array.isArray(params.storyUuid) ? params.storyUuid[0] : params.storyUuid;

  const progress = useRef(new Animated.Value(0)).current;
  const holdStartedAt = useRef(0);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [paused, setPaused] = useState(false);
  const [videoDurationMs, setVideoDurationMs] = useState<number | null>(null);

  const current = stories[index] || null;
  const currentUrl = current?.media?.file_url || current?.file_url || null;
  const author = current ? getAuthor(current) : null;
  const authorName = getAuthorName(current);
  const durationMs = current?.media_type === 'video'
    ? videoDurationMs || DEFAULT_VIDEO_DURATION_MS
    : IMAGE_DURATION_MS;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await fetchStories();
      const startIndex = Math.max(0, data.findIndex((item) => item.uuid === storyUuid));
      setStories(data);
      setIndex(startIndex);
    } catch {
      setStories([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [storyUuid]);

  useEffect(() => {
    void load();
  }, [load]);

  const goNext = useCallback(() => {
    setIndex((currentIndex) => {
      if (currentIndex >= stories.length - 1) {
        router.back();
        return currentIndex;
      }
      return currentIndex + 1;
    });
  }, [stories.length]);

  const goPrev = useCallback(() => {
    setIndex((currentIndex) => Math.max(0, currentIndex - 1));
  }, []);

  useEffect(() => {
    if (!current?.uuid) return;
    progress.setValue(0);
    setVideoDurationMs(null);
    setPaused(false);
    void markStoryViewed(current.uuid).catch(() => undefined);
  }, [current?.uuid, progress]);

  useEffect(() => {
    if (!current?.uuid || paused) {
      progress.stopAnimation();
      return;
    }

    progress.stopAnimation((value) => {
      Animated.timing(progress, {
        toValue: 1,
        duration: Math.max(250, Math.round((1 - value) * durationMs)),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) goNext();
      });
    });

    return () => progress.stopAnimation();
  }, [current?.uuid, durationMs, goNext, paused, progress]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 20 || Math.abs(gesture.dx) > 24,
        onPanResponderGrant: () => setPaused(true),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 65) router.back();
          else if (gesture.dx < -55) goNext();
          else if (gesture.dx > 55) goPrev();
          setPaused(false);
        },
        onPanResponderTerminate: () => setPaused(false),
      }),
    [goNext, goPrev],
  );

  const openStoryActionTarget = (response?: StoryActionResponse | null) => {
    if (!response?.chat_uuid) return;
    router.push({
      pathname: '/(app)/chat/[chatUuid]',
      params: { chatUuid: response.chat_uuid },
    });
  };

  const sendReply = async () => {
    const message = reply.trim();
    if (!message || !current?.uuid || sending || current.is_own) return;

    try {
      setSending(true);
      const result = await replyToStory(current.uuid, message);
      setReply('');
      openStoryActionTarget(result);
    } catch (error) {
      Alert.alert(
        'Ответ на историю',
        getApiErrorMessage(error, 'Не удалось отправить ответ'),
      );
    } finally {
      setSending(false);
    }
  };

  const sendReaction = async (emoji: string) => {
    if (!current?.uuid || sending || current.is_own) return;
    try {
      setSending(true);
      const result = await reactToStory(current.uuid, emoji);
      openStoryActionTarget(result);
    } catch (error) {
      Alert.alert(
        'Реакция',
        getApiErrorMessage(error, 'Не удалось отправить реакцию'),
      );
    } finally {
      setSending(false);
    }
  };

  const tapZonePressIn = () => {
    holdStartedAt.current = Date.now();
    setPaused(true);
  };

  const tapZonePressOut = (direction: 'prev' | 'next') => {
    const wasQuickTap = Date.now() - holdStartedAt.current < 260;
    setPaused(false);
    if (wasQuickTap) {
      if (direction === 'next') goNext();
      else goPrev();
    }
  };

  const handlePlaybackStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    if (status.durationMillis && status.durationMillis !== videoDurationMs) {
      setVideoDurationMs(status.durationMillis);
    }
  };

  if (loading || !current) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" backgroundColor="#000000" />
        <View style={styles.centered}>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.emptyText}>
                {loadError ? 'Не удалось загрузить истории' : 'История недоступна'}
              </Text>
              <Pressable onPress={() => (loadError ? void load() : router.back())} style={styles.closeTextButton}>
                <Text style={styles.closeText}>{loadError ? 'Повторить' : 'Закрыть'}</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root} {...panResponder.panHandlers}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      {current.media_type === 'video' && currentUrl ? (
        <Video
          source={{ uri: currentUrl }}
          resizeMode={ResizeMode.COVER}
          shouldPlay={!paused}
          isLooping={false}
          onPlaybackStatusUpdate={handlePlaybackStatus}
          style={StyleSheet.absoluteFill}
        />
      ) : currentUrl ? (
        <ExpoImage
          source={{ uri: currentUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.textStory,
            { backgroundColor: current.background || theme.colors.primary },
          ]}
        >
          <Text style={styles.textStoryCaption}>{current.caption}</Text>
        </View>
      )}

      <View style={styles.scrimTop} pointerEvents="none" />
      <View style={styles.scrimBottom} pointerEvents="none" />

      <Pressable
        style={styles.leftTap}
        onPressIn={tapZonePressIn}
        onPressOut={() => tapZonePressOut('prev')}
      />
      <Pressable
        style={styles.rightTap}
        onPressIn={tapZonePressIn}
        onPressOut={() => tapZonePressOut('next')}
      />

      <View style={[styles.progressRow, { top: Math.max(insets.top + 7, 13) }]}>
        {stories.map((item, itemIndex) => {
          const width = itemIndex < index
            ? '100%'
            : itemIndex === index
              ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
              : '0%';
          return (
            <View key={item.uuid} style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width }]} />
            </View>
          );
        })}
      </View>

      <View style={[styles.header, { top: Math.max(insets.top + 22, 34) }]}>
        <View style={styles.authorAvatar}>
          {author?.avatar ? (
            <ExpoImage
              source={{ uri: author.avatar }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <Text style={styles.authorInitial}>{authorName.slice(0, 1).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.headerText}>
          <Text style={styles.authorName} numberOfLines={1}>{authorName}</Text>
          <Text style={styles.metaText}>{formatStoryTime(current.created_at)}</Text>
        </View>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="close" size={25} color="#FFFFFF" />
        </Pressable>
      </View>

      {current.caption && current.media_type !== 'text' ? (
        <View style={[styles.captionWrap, { bottom: Math.max(insets.bottom + 132, 142) }]} pointerEvents="none">
          <Text style={styles.caption}>{current.caption}</Text>
        </View>
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={[styles.replyWrap, { bottom: Math.max(insets.bottom + 10, 14) }]}
      >
        {current.is_own ? (
          <View style={styles.ownStoryBar}>
            <Ionicons name="eye-outline" size={20} color="#FFFFFF" />
            <Text style={styles.ownStoryText}>
              {typeof current.viewers_count === 'number'
                ? `${current.viewers_count} просмотров`
                : 'Ваша история'}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.reactionRow}>
              {reactions.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => void sendReaction(emoji)}
                  disabled={sending}
                  style={({ pressed }) => [styles.reactionButton, pressed && styles.reactionPressed]}
                >
                  <Text style={styles.reactionText}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.replyInputRow}>
              <TextInput
                value={reply}
                onChangeText={setReply}
                placeholder="Ответить сообщением"
                placeholderTextColor="rgba(255,255,255,0.68)"
                style={styles.replyInput}
                returnKeyType="send"
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
                onSubmitEditing={() => void sendReply()}
              />
              <Pressable
                onPress={() => void sendReply()}
                disabled={sending || !reply.trim()}
                style={[styles.sendButton, (!reply.trim() || sending) && styles.disabledButton]}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="send" size={18} color="#FFFFFF" />
                )}
              </Pressable>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  centered: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 14 },
  emptyText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  closeTextButton: { minHeight: 44, borderRadius: 10, paddingHorizontal: 18, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  textStory: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  textStoryCaption: { color: '#FFFFFF', fontSize: 34, lineHeight: 42, fontWeight: '800', textAlign: 'center' },
  scrimTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 190, backgroundColor: 'rgba(0,0,0,0.32)' },
  scrimBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 280, backgroundColor: 'rgba(0,0,0,0.42)' },
  progressRow: { position: 'absolute', left: 9, right: 9, flexDirection: 'row', gap: 4 },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.30)', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#FFFFFF' },
  header: { position: 'absolute', left: 13, right: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorAvatar: { width: 42, height: 42, borderRadius: 21, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.20)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.48)', alignItems: 'center', justifyContent: 'center' },
  authorInitial: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  headerText: { flex: 1, minWidth: 0 },
  authorName: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  metaText: { color: 'rgba(255,255,255,0.74)', fontSize: 12, marginTop: 2 },
  iconButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  captionWrap: { position: 'absolute', left: 18, right: 18 },
  caption: { color: '#FFFFFF', fontSize: 16, lineHeight: 23, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 },
  replyWrap: { position: 'absolute', left: 12, right: 12, gap: 10 },
  reactionRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  reactionButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,20,20,0.42)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  reactionPressed: { transform: [{ scale: 0.9 }] },
  reactionText: { fontSize: 22 },
  replyInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  replyInput: { flex: 1, minHeight: 48, borderRadius: 24, paddingHorizontal: 17, color: '#FFFFFF', backgroundColor: 'rgba(20,20,20,0.42)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.26)' },
  sendButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#421d24' },
  disabledButton: { opacity: 0.45 },
  ownStoryBar: { minHeight: 48, alignSelf: 'center', paddingHorizontal: 18, borderRadius: 24, backgroundColor: 'rgba(20,20,20,0.46)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)', flexDirection: 'row', alignItems: 'center', gap: 8 },
  ownStoryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  leftTap: { position: 'absolute', left: 0, top: 92, bottom: 132, width: '34%' },
  rightTap: { position: 'absolute', right: 0, top: 92, bottom: 132, width: '34%' },
});
