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
import { Video, ResizeMode } from 'expo-av';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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

const VIEW_DURATION_MS = 7000;
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
    'Story'
  );
}

function getStoryUrl(story: StoryItem | null) {
  return story?.media?.file_url || story?.file_url || null;
}

function getAuthorAvatar(story: StoryItem | null) {
  const author = story ? getAuthor(story) : null;
  return author?.avatar || null;
}

export default function StoryViewerScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ storyUuid?: string }>();

  const progress = useRef(new Animated.Value(0)).current;
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const current = stories[index] || null;
  const currentUrl = getStoryUrl(current);
  const authorAvatar = getAuthorAvatar(current);
  const author = current ? getAuthor(current) : null;
  const authorName = getAuthorName(current);

  const load = useCallback(async () => {
    try {
      const data = await fetchStories();
      const startIndex = Math.max(
        0,
        data.findIndex((item) => item.uuid === params.storyUuid),
      );
      setStories(data);
      setIndex(startIndex);
    } catch (error) {
      console.error('story viewer load error:', error);
      setStories([]);
    } finally {
      setLoading(false);
    }
  }, [params.storyUuid]);

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
    Animated.timing(progress, {
      toValue: 1,
      duration: current.media_type === 'video' ? VIEW_DURATION_MS + 3000 : VIEW_DURATION_MS,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        goNext();
      }
    });

    void markStoryViewed(current.uuid).catch(() => undefined);

    return () => {
      progress.stopAnimation();
    };
  }, [current?.uuid, current?.media_type, goNext, progress]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => {
          return Math.abs(gesture.dy) > 18 || Math.abs(gesture.dx) > 18;
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 55) {
            router.back();
            return;
          }

          if (gesture.dy < -45 || gesture.dx < -45) {
            goNext();
            return;
          }

          if (gesture.dx > 45) {
            goPrev();
          }
        },
      }),
    [goNext, goPrev],
  );

  const openStoryActionTarget = (response?: StoryActionResponse | null) => {
    const chatUuid = response?.chat_uuid;

    if (typeof chatUuid !== 'string' || !chatUuid.trim()) {
      return;
    }

    router.push({
      pathname: '/(app)/chat/[chatUuid]',
      params: { chatUuid },
    });
  };

  const sendReply = async (text: string) => {
    const message = text.trim();
    if (!message || !current?.uuid || sending || Boolean(current.is_own)) {
      return;
    }

    try {
      setSending(true);
      const result = await replyToStory(current.uuid, message);
      setReply('');
      openStoryActionTarget(result);
    } catch (error) {
      Alert.alert('Story reply', getApiErrorMessage(error, 'Could not send story reply'));
    } finally {
      setSending(false);
    }
  };

  const sendReaction = async (emoji: string) => {
    if (!emoji || !current?.uuid || sending || Boolean(current.is_own)) {
      return;
    }

    try {
      setSending(true);
      const result = await reactToStory(current.uuid, emoji);
      openStoryActionTarget(result);
    } catch (error) {
      Alert.alert('Story', getApiErrorMessage(error, 'Could not send story reaction'));
    } finally {
      setSending(false);
    }
  };
  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.centered}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      </SafeAreaView>
    );
  }

  if (!current) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Story недоступна</Text>
          <Pressable onPress={() => router.back()} style={styles.closeTextButton}>
            <Text style={styles.closeText}>Закрыть</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} {...panResponder.panHandlers}>
      {current.media_type === 'video' && currentUrl ? (
        <Video
          source={{ uri: currentUrl }}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping
          style={StyleSheet.absoluteFill}
        />
      ) : currentUrl ? (
        <ExpoImage
          source={{ uri: currentUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
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

      <View style={styles.scrimTop} />
      <View style={styles.scrimBottom} />

      <View style={[styles.progressRow, { top: Math.max(insets.top + 8, 18) }]}>
        {stories.map((item, itemIndex) => {
          const width =
            itemIndex < index
              ? '100%'
              : itemIndex === index
                ? progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  })
                : '0%';

          return (
            <View key={item.uuid} style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width }]} />
            </View>
          );
        })}
      </View>

      <View style={[styles.header, { top: Math.max(insets.top + 26, 42) }]}>
        <View style={styles.authorAvatar}>
          {authorAvatar ? (
            <ExpoImage
              source={{ uri: authorAvatar }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <Text style={styles.authorInitial}>{authorName.slice(0, 1).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.headerText}>
          <Text style={styles.authorName} numberOfLines={1}>
            {authorName}
          </Text>
          <Text style={styles.metaText}>
            {current.is_own && typeof current.viewers_count === 'number'
              ? `${current.viewers_count} просмотров`
              : 'story'}
          </Text>
        </View>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      {current.caption && current.media_type !== 'text' ? (
        <View style={styles.captionWrap}>
          <Text style={styles.caption}>{current.caption}</Text>
        </View>
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.replyWrap}
      >
        <View style={styles.reactionRow}>
          {reactions.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => void sendReaction(emoji)}
              disabled={sending || !author?.uuid || Boolean(current.is_own)}
              style={styles.reactionButton}
            >
              <Text style={styles.reactionText}>{emoji}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.replyInputRow}>
          <TextInput
            value={reply}
            onChangeText={setReply}
            editable={!current.is_own && Boolean(author?.uuid)}
            placeholder={current.is_own ? 'Это твоя story' : 'Ответить сообщением'}
            placeholderTextColor="rgba(255,255,255,0.68)"
            style={styles.replyInput}
            returnKeyType="send"
            onSubmitEditing={() => void sendReply(reply)}
          />
          <Pressable
            onPress={() => void sendReply(reply)}
            disabled={sending || !reply.trim() || Boolean(current.is_own)}
            style={[styles.sendButton, (!reply.trim() || current.is_own) && styles.disabledButton]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={18} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Pressable style={styles.leftTap} onPress={goPrev} />
      <Pressable style={styles.rightTap} onPress={goNext} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  closeTextButton: {
    minHeight: 44,
    borderRadius: 18,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  textStory: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  textStoryCaption: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '900',
    textAlign: 'center',
  },
  scrimTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  scrimBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 240,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  progressRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    gap: 4,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  header: {
    position: 'absolute',
    top: 22,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  authorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorInitial: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  authorName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  metaText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    marginTop: 2,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.26)',
  },
  captionWrap: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 154,
  },
  caption: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
  },
  replyWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 14,
    gap: 10,
  },
  reactionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  reactionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  reactionText: {
    fontSize: 22,
  },
  replyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  replyInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: 16,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2AABEE',
  },
  disabledButton: {
    opacity: 0.45,
  },
  leftTap: {
    position: 'absolute',
    left: 0,
    top: 96,
    bottom: 136,
    width: '34%',
  },
  rightTap: {
    position: 'absolute',
    right: 0,
    top: 96,
    bottom: 136,
    width: '34%',
  },
});
