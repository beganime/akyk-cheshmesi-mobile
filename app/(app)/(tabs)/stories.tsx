import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { GlassCard } from '@/src/components/GlassCard';
import { createStory, deleteStory, fetchStories } from '@/src/lib/api/stories';
import { uploadPickedMedia } from '@/src/lib/api/media';
import type { StoryItem } from '@/src/types/stories';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getApiErrorMessage } from '@/src/utils/apiErrors';

const textBackgrounds = ['#2AABEE', '#5288C1', '#10B981', '#F97316', '#8B5CF6'];

function getAuthor(story: StoryItem) {
  return story.author || story.user || null;
}

function getAuthorName(story: StoryItem) {
  const author = getAuthor(story);
  return (
    author?.full_name ||
    [author?.first_name, author?.last_name].filter(Boolean).join(' ') ||
    author?.username ||
    'Story'
  );
}

function getStoryUrl(story: StoryItem) {
  return story.media?.file_url || story.file_url || null;
}

function formatExpires(story: StoryItem) {
  const expiresAt = story.expires_at ? new Date(story.expires_at).getTime() : 0;
  if (!expiresAt) return '24 часа';

  const diffMs = expiresAt - Date.now();
  if (diffMs <= 0) return 'истекает';

  const hours = Math.max(1, Math.ceil(diffMs / 3600000));
  return `${hours} ч`;
}

export default function StoriesScreen() {
  const { theme } = useTheme();
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [caption, setCaption] = useState('');
  const [textBackground, setTextBackground] = useState(textBackgrounds[0]);
  const [creating, setCreating] = useState(false);

  const myStories = useMemo(() => stories.filter((item) => item.is_own), [stories]);
  const feedStories = useMemo(() => stories.filter((item) => !item.is_own), [stories]);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setRefreshing(true);
      }

      const data = await fetchStories();
      setStories(data);
    } catch (error) {
      console.error('load stories error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load(true);
    }, [load]),
  );

  const createTextStory = async () => {
    const text = caption.trim();
    if (!text) {
      Alert.alert('Story', 'Напиши текст story');
      return;
    }

    try {
      setCreating(true);
      await createStory({
        media_type: 'text',
        caption: text,
        background: textBackground,
      });
      setCaption('');
      setCreateVisible(false);
      await load(true);
    } catch (error) {
      Alert.alert('Story', getApiErrorMessage(error, 'Не удалось создать story'));
    } finally {
      setCreating(false);
    }
  };

  const createMediaStory = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Доступ к галерее', 'Разреши доступ к фото и видео для публикации story.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.82,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      const isVideo = asset.type === 'video' || String(asset.mimeType || '').startsWith('video/');

      setCreating(true);
      const uploaded = await uploadPickedMedia(
        {
          uri: asset.uri,
          fileName: asset.fileName || `${isVideo ? 'story-video' : 'story-image'}-${Date.now()}`,
          mimeType: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
          width: asset.width,
          height: asset.height,
          duration: asset.duration,
          fileSize: asset.fileSize,
        },
        {
          filenamePrefix: isVideo ? 'story-video' : 'story-image',
          fallbackContentType: isVideo ? 'video/mp4' : 'image/jpeg',
          isPublic: false,
        },
      );

      await createStory({
        media_type: isVideo ? 'video' : 'image',
        media_uuid: uploaded.uuid,
        caption: caption.trim() || undefined,
      });

      setCaption('');
      setCreateVisible(false);
      await load(true);
    } catch (error) {
      Alert.alert('Story', getApiErrorMessage(error, 'Не удалось загрузить story'));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (story: StoryItem) => {
    Alert.alert('Удалить story?', 'Она исчезнет у всех пользователей.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteStory(story.uuid);
            await load(true);
          } catch (error) {
            Alert.alert('Story', getApiErrorMessage(error, 'Не удалось удалить story'));
          }
        },
      },
    ]);
  };

  if (loading) {
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
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Stories</Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
            Фото, видео и короткие обновления на 24 часа
          </Text>
        </View>

        <Pressable
          onPress={() => setCreateVisible(true)}
          style={[styles.headerButton, { backgroundColor: theme.colors.primary }]}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      <FlatList
        data={[...myStories, ...feedStories]}
        keyExtractor={(item) => item.uuid}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <GlassCard>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              Stories пока нет
            </Text>
            <Text style={[styles.emptyText, { color: theme.colors.muted }]}>
              Создай первую story или дождись обновлений от людей из чатов.
            </Text>
          </GlassCard>
        }
        renderItem={({ item }) => {
          const url = getStoryUrl(item);
          const authorName = getAuthorName(item);

          return (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(app)/story-viewer' as any,
                  params: { storyUuid: item.uuid },
                })
              }
              onLongPress={() => (item.is_own ? handleDelete(item) : undefined)}
            >
              <GlassCard style={styles.storyCard}>
                <View style={styles.storyPreview}>
                  {item.media_type === 'video' && url ? (
                    <Video
                      source={{ uri: url }}
                      resizeMode={ResizeMode.COVER}
                      shouldPlay={false}
                      style={StyleSheet.absoluteFill}
                    />
                  ) : url ? (
                    <ExpoImage
                      source={{ uri: url }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        styles.textPreview,
                        { backgroundColor: item.background || theme.colors.primary },
                      ]}
                    >
                      <Text style={styles.textPreviewCaption} numberOfLines={5}>
                        {item.caption}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.storyInfo}>
                  <Text style={[styles.storyTitle, { color: theme.colors.text }]} numberOfLines={1}>
                    {item.is_own ? 'Моя story' : authorName}
                  </Text>
                  <Text style={[styles.storyMeta, { color: theme.colors.muted }]}>
                    {formatExpires(item)}
                    {item.is_own && typeof item.viewers_count === 'number'
                      ? ` · ${item.viewers_count} просмотров`
                      : ''}
                  </Text>
                  {item.caption && item.media_type !== 'text' ? (
                    <Text style={[styles.storyCaption, { color: theme.colors.text }]} numberOfLines={2}>
                      {item.caption}
                    </Text>
                  ) : null}
                </View>

                <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
              </GlassCard>
            </Pressable>
          );
        }}
      />

      <Modal visible={createVisible} transparent animationType="slide" onRequestClose={() => setCreateVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCreateVisible(false)} />
          <View style={styles.sheet}>
            <GlassCard>
              <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>Новая story</Text>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Текст или подпись"
                placeholderTextColor={theme.colors.muted}
                multiline
                style={[
                  styles.captionInput,
                  {
                    color: theme.colors.text,
                    borderColor: theme.colors.borderStrong,
                    backgroundColor: theme.colors.inputBackground,
                  },
                ]}
              />

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatches}>
                {textBackgrounds.map((color) => (
                  <Pressable
                    key={color}
                    onPress={() => setTextBackground(color)}
                    style={[
                      styles.swatch,
                      {
                        backgroundColor: color,
                        borderColor: textBackground === color ? '#FFFFFF' : 'transparent',
                      },
                    ]}
                  />
                ))}
              </ScrollView>

              <View style={styles.createActions}>
                <Pressable
                  onPress={() => void createTextStory()}
                  disabled={creating}
                  style={[styles.createButton, { backgroundColor: theme.colors.primary }]}
                >
                  {creating ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="text" size={18} color="#FFFFFF" />
                      <Text style={styles.createButtonText}>Текст</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => void createMediaStory()}
                  disabled={creating}
                  style={[styles.createButton, { backgroundColor: '#10B981' }]}
                >
                  <Ionicons name="images" size={18} color="#FFFFFF" />
                  <Text style={styles.createButtonText}>Фото/видео</Text>
                </Pressable>
              </View>
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
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  headerButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 10,
  },
  storyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  storyPreview: {
    width: 68,
    height: 92,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  textPreview: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  textPreviewCaption: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  storyInfo: {
    flex: 1,
    minWidth: 0,
  },
  storyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  storyMeta: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  storyCaption: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.38)',
    justifyContent: 'flex-end',
  },
  sheet: {
    paddingHorizontal: 12,
    paddingBottom: 18,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
  },
  captionInput: {
    minHeight: 120,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  swatches: {
    gap: 10,
    paddingVertical: 14,
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
  },
  createActions: {
    flexDirection: 'row',
    gap: 10,
  },
  createButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
