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
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { GlassCard } from '@/src/components/GlassCard';
import { createStory, deleteStory, fetchStories } from '@/src/lib/api/stories';
import { uploadPickedMedia } from '@/src/lib/api/media';
import type { StoryItem } from '@/src/types/stories';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getApiErrorMessage } from '@/src/utils/apiErrors';

const textBackgrounds = ['#2AABEE', '#5288C1', '#10B981', '#F97316', '#8B5CF6'];

type PendingStoryMedia = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  width?: number;
  height?: number;
  duration?: number | null;
  fileSize?: number | null;
  isVideo: boolean;
};

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

function getStoryPreviewUrl(story: StoryItem) {
  return story.media?.thumbnail_url || story.media?.file_url || story.file_url || null;
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
  const params = useLocalSearchParams<{ create?: string }>();
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [caption, setCaption] = useState('');
  const [textBackground, setTextBackground] = useState(textBackgrounds[0]);
  const [creating, setCreating] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<PendingStoryMedia | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const myStories = useMemo(() => stories.filter((item) => item.is_own), [stories]);
  const feedStories = useMemo(() => stories.filter((item) => !item.is_own), [stories]);

  const closeCreateSheet = useCallback(() => {
    setCreateVisible(false);
    setPendingMedia(null);
    setUploadProgress(0);
    if (params.create) {
      router.setParams({ create: undefined });
    }
  }, [params.create]);

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
      if (params.create === '1') {
        setCreateVisible(true);
      }
    }, [load, params.create]),
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
      closeCreateSheet();
      await load(true);
    } catch (error) {
      Alert.alert('Story', getApiErrorMessage(error, 'Не удалось создать story'));
    } finally {
      setCreating(false);
    }
  };

  const chooseMediaStory = async (source: 'library' | 'camera' = 'library') => {
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          source === 'camera' ? 'Доступ к камере' : 'Доступ к галерее',
          source === 'camera'
            ? 'Разреши доступ к камере, чтобы снять story.'
            : 'Разреши доступ к фото и видео для публикации story.',
        );
        return;
      }

      const pickerOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.82,
        allowsEditing: false,
        videoMaxDuration: 30,
      };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(pickerOptions)
          : await ImagePicker.launchImageLibraryAsync(pickerOptions);

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      const isVideo = asset.type === 'video' || String(asset.mimeType || '').startsWith('video/');

      setPendingMedia({
        uri: asset.uri,
        fileName: asset.fileName || `${isVideo ? 'story-video' : 'story-image'}-${Date.now()}`,
        mimeType: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
        width: asset.width,
        height: asset.height,
        duration: asset.duration,
        fileSize: asset.fileSize,
        isVideo,
      });
    } catch (error) {
      Alert.alert('Story', getApiErrorMessage(error, 'Не удалось выбрать медиа'));
    }
  };

  const publishMediaStory = async () => {
    if (!pendingMedia) {
      await chooseMediaStory('library');
      return;
    }

    try {
      setCreating(true);
      setUploadProgress(0);
      const uploaded = await uploadPickedMedia(
        {
          uri: pendingMedia.uri,
          fileName: pendingMedia.fileName,
          mimeType: pendingMedia.mimeType,
          width: pendingMedia.width,
          height: pendingMedia.height,
          duration: pendingMedia.duration,
          fileSize: pendingMedia.fileSize,
        },
        {
          filenamePrefix: pendingMedia.isVideo ? 'story-video' : 'story-image',
          fallbackContentType: pendingMedia.isVideo ? 'video/mp4' : 'image/jpeg',
          isPublic: false,
          mediaKind: pendingMedia.isVideo ? 'video' : 'image',
          onProgress: (value) =>
            setUploadProgress(Math.round(Math.max(0, Math.min(1, value)) * 100)),
        },
      );

      await createStory({
        media_type: pendingMedia.isVideo ? 'video' : 'image',
        media_uuid: uploaded.uuid,
        caption: caption.trim() || undefined,
      });

      setCaption('');
      setPendingMedia(null);
      setUploadProgress(0);
      closeCreateSheet();
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
        numColumns={2}
        columnWrapperStyle={styles.storyGridRow}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <GlassCard>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Stories пока нет</Text>
            <Text style={[styles.emptyText, { color: theme.colors.muted }]}> 
              Создай первую story или дождись обновлений от людей из чатов.
            </Text>
          </GlassCard>
        }
        renderItem={({ item }) => {
          const url = getStoryPreviewUrl(item);
          const fullUrl = getStoryUrl(item);
          const authorName = getAuthorName(item);

          return (
            <Pressable
              style={styles.storyPressable}
              onPress={() =>
                router.push({
                  pathname: '/(app)/story-viewer' as any,
                  params: { storyUuid: item.uuid },
                })
              }
              onLongPress={() => (item.is_own ? handleDelete(item) : undefined)}
            >
              <View
                style={[
                  styles.storyCard,
                  {
                    backgroundColor: theme.colors.cardSolid,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <View style={styles.storyPreview}>
                  {item.media_type === 'video' && fullUrl ? (
                    <Video
                      source={{ uri: fullUrl }}
                      resizeMode={ResizeMode.COVER}
                      shouldPlay={false}
                      style={StyleSheet.absoluteFill}
                    />
                  ) : url ? (
                    <ExpoImage
                      source={{ uri: url }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      cachePolicy="memory-disk"
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

                <View style={[styles.storyOpenIcon, { backgroundColor: theme.colors.cardStrong }]}>
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.muted} />
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      <Modal visible={createVisible} transparent animationType="slide" onRequestClose={closeCreateSheet}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeCreateSheet} />
          <View style={styles.sheet}>
            <View
              style={[
                styles.createPanel,
                {
                  backgroundColor: theme.colors.cardSolid,
                  borderColor: theme.colors.borderStrong,
                },
              ]}
            >
              <View style={styles.createHeader}>
                <View style={styles.createHeaderText}>
                  <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>Новая story</Text>
                  <Text style={[styles.sheetSubtitle, { color: theme.colors.muted }]}>Фото, видео или короткий текст</Text>
                </View>
                <Pressable
                  onPress={closeCreateSheet}
                  disabled={creating}
                  style={[styles.sheetCloseButton, { backgroundColor: theme.colors.backgroundTertiary }]}
                >
                  <Ionicons name="close" size={20} color={theme.colors.text} />
                </Pressable>
              </View>

              <Pressable
                onPress={() => void chooseMediaStory('library')}
                disabled={creating}
                style={[
                  styles.mediaPicker,
                  {
                    borderColor: pendingMedia ? 'transparent' : theme.colors.borderStrong,
                    backgroundColor: pendingMedia ? '#111827' : theme.colors.backgroundSecondary,
                  },
                ]}
              >
                {pendingMedia ? (
                  <>
                    {pendingMedia.isVideo ? (
                      <Video
                        source={{ uri: pendingMedia.uri }}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay={false}
                        style={StyleSheet.absoluteFill}
                      />
                    ) : (
                      <ExpoImage
                        source={{ uri: pendingMedia.uri }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    )}
                    <View style={styles.mediaPickerShade} />
                    <View style={styles.mediaPickerBadge}>
                      <Ionicons name="images" size={16} color="#FFFFFF" />
                      <Text style={styles.mediaPickerBadgeText}>Заменить</Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        setPendingMedia(null);
                        setUploadProgress(0);
                      }}
                      disabled={creating}
                      style={styles.removePendingButton}
                      hitSlop={10}
                    >
                      <Ionicons name="close" size={18} color="#FFFFFF" />
                    </Pressable>
                  </>
                ) : (
                  <View style={styles.emptyPickerContent}>
                    <View style={[styles.emptyPickerIcon, { backgroundColor: theme.colors.primarySoft }]}>
                      <Ionicons name="images-outline" size={26} color={theme.colors.primary} />
                    </View>
                    <Text style={[styles.emptyPickerTitle, { color: theme.colors.text }]}>Выбрать фото или видео</Text>
                    <Text style={[styles.emptyPickerText, { color: theme.colors.muted }]}>Без медиа будет опубликована текстовая story</Text>
                  </View>
                )}

                {creating && uploadProgress > 0 ? (
                  <View style={styles.uploadOverlay}>
                    <View style={styles.uploadTrack}>
                      <View style={[styles.uploadFill, { width: `${uploadProgress}%` }]} />
                    </View>
                    <Text style={styles.uploadText}>{uploadProgress}%</Text>
                  </View>
                ) : null}
              </Pressable>

              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder={pendingMedia ? 'Добавить подпись' : 'Текст story'}
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

              {!pendingMedia ? (
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
              ) : null}

              <View style={styles.createActions}>
                <Pressable
                  onPress={() => void chooseMediaStory('library')}
                  disabled={creating}
                  style={[styles.secondaryCreateButton, { borderColor: theme.colors.borderStrong }]}
                >
                  <Ionicons name="images-outline" size={18} color={theme.colors.text} />
                  <Text style={[styles.secondaryCreateButtonText, { color: theme.colors.text }]}>
                    {pendingMedia ? 'Заменить' : 'Галерея'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void chooseMediaStory('camera')}
                  disabled={creating}
                  style={[styles.secondaryCreateButton, { borderColor: theme.colors.borderStrong }]}
                >
                  <Ionicons name="camera-outline" size={18} color={theme.colors.text} />
                  <Text style={[styles.secondaryCreateButtonText, { color: theme.colors.text }]}>
                    Камера
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void (pendingMedia ? publishMediaStory() : createTextStory())}
                  disabled={creating || (!pendingMedia && !caption.trim())}
                  style={[
                    styles.createButton,
                    {
                      backgroundColor: '#10B981',
                      opacity: creating || (!pendingMedia && !caption.trim()) ? 0.55 : 1,
                    },
                  ]}
                >
                  {creating ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload" size={18} color="#FFFFFF" />
                      <Text style={styles.createButtonText}>Опубликовать</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
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
  storyGridRow: {
    gap: 10,
  },
  storyPressable: {
    flex: 1,
  },
  storyCard: {
    flex: 1,
    minHeight: 256,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 10,
  },
  storyPreview: {
    width: '100%',
    height: 178,
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
    minHeight: 78,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
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
  storyOpenIcon: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
  createPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 14,
  },
  createHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  createHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  sheetSubtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
  },
  sheetCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaPicker: {
    height: 214,
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaPickerShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  mediaPickerBadge: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  mediaPickerBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  emptyPickerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyPickerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyPickerTitle: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyPickerText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  captionInput: {
    minHeight: 82,
    maxHeight: 120,
    borderRadius: 16,
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
  pendingPreview: {
    height: 220,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
    backgroundColor: '#111827',
  },
  removePendingButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  uploadOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    gap: 6,
  },
  uploadTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  uploadFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  uploadText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  createActions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  secondaryCreateButton: {
    minWidth: 96,
    flexGrow: 1,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryCreateButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  createButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
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
