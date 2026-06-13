import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { fetchStories } from '@/src/lib/api/stories';
import type { StoryItem } from '@/src/types/stories';
import { useTheme } from '@/src/theme/ThemeProvider';

type Props = {
  compact?: boolean;
};

type StoryPreview = {
  key: string;
  storyUuid: string;
  name: string;
  avatar?: string | null;
  image?: string | null;
  background?: string | null;
  initial: string;
  isOwn: boolean;
  viewed: boolean;
};

const UI = {
  dark: {
    bgPrimary: '#0e1621',
    bgSecondary: '#17212b',
    accent: '#5288c1',
    textPrimary: '#ffffff',
    textSecondary: '#7f91a4',
    separator: 'rgba(255, 255, 255, 0.06)',
  },
  light: {
    bgPrimary: '#ffffff',
    bgSecondary: '#f4f4f5',
    accent: '#3390ec',
    textPrimary: '#000000',
    textSecondary: '#707579',
    separator: '#e4e4e5',
  },
} as const;

function getAuthor(story: StoryItem) {
  return story.author || story.user || null;
}

function getAuthorKey(story: StoryItem) {
  const author = getAuthor(story);
  return author?.uuid || `${story.is_own ? 'own' : 'story'}:${story.uuid}`;
}

function getAuthorName(story: StoryItem) {
  const author = getAuthor(story);
  return (
    author?.full_name ||
    [author?.first_name, author?.last_name].filter(Boolean).join(' ') ||
    author?.username ||
    (story.is_own ? 'Моя история' : 'Story')
  );
}

function getAuthorAvatar(story: StoryItem) {
  const author = getAuthor(story) as any;
  return author?.avatar || author?.photo_url || null;
}

function getStoryImage(story: StoryItem) {
  if (story.media_type === 'text') {
    return null;
  }

  return story.media?.thumbnail_url || story.media?.file_url || story.file_url || null;
}

function getStoryTime(story: StoryItem) {
  const time = new Date(story.created_at || story.updated_at || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function buildAuthorStories(stories: StoryItem[], limit: number): StoryPreview[] {
  const sorted = [...stories].sort((a, b) => getStoryTime(b) - getStoryTime(a));
  const byAuthor = new Map<string, StoryItem>();

  for (const story of sorted) {
    const key = getAuthorKey(story);
    if (!byAuthor.has(key)) {
      byAuthor.set(key, story);
    }
  }

  return [...byAuthor.entries()].slice(0, limit).map(([key, story]) => {
    const name = getAuthorName(story);
    return {
      key,
      storyUuid: story.uuid,
      name: story.is_own ? 'Моя история' : name,
      avatar: getAuthorAvatar(story),
      image: getStoryImage(story),
      background: story.background,
      initial: name.slice(0, 1).toUpperCase() || 'S',
      isOwn: Boolean(story.is_own),
      viewed: Boolean(story.viewed_by_me),
    };
  });
}

export function StoriesStrip({ compact = false }: Props) {
  const { resolvedThemeName } = useTheme();
  const isLightTheme = resolvedThemeName.toLowerCase().includes('light');
  const ui = isLightTheme ? UI.light : UI.dark;
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchStories();
      setStories(data);
    } catch (error) {
      console.error('fetchStories strip error:', error);
      setStories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const visibleStories = useMemo(
    () => buildAuthorStories(stories, compact ? 12 : 30),
    [compact, stories],
  );

  const openCreateStory = () => {
    router.push({
      pathname: '/(app)/(tabs)/stories' as any,
      params: { create: '1' },
    });
  };

  return (
    <View style={[styles.wrap, { backgroundColor: ui.bgPrimary }]}> 
      <FlatList
        horizontal
        data={visibleStories}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <Pressable onPress={openCreateStory} style={styles.storyButton}>
            <View style={[styles.addRing, { backgroundColor: ui.separator }]}> 
              <View style={[styles.addAvatar, { backgroundColor: ui.accent }]}> 
                <Ionicons name="person-outline" size={28} color="#FFFFFF" />
              </View>
              <View style={[styles.addBadge, { backgroundColor: ui.accent, borderColor: ui.bgPrimary }]}> 
                <Ionicons name="add" size={14} color="#FFFFFF" />
              </View>
            </View>
            <Text style={[styles.storyName, { color: ui.accent }]} numberOfLines={1}>
              Моя история
            </Text>
          </Pressable>
        }
        ListFooterComponent={
          loading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="small" color={ui.accent} />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/(app)/story-viewer' as any,
                params: { storyUuid: item.storyUuid },
              })
            }
            style={styles.storyButton}
          >
            <View
              style={[
                styles.ring,
                {
                  backgroundColor: item.viewed ? ui.separator : '#dc2743',
                  borderColor: item.viewed ? ui.separator : '#cc2366',
                },
              ]}
            >
              {item.avatar || item.image ? (
                <ExpoImage
                  source={{ uri: item.avatar || item.image || '' }}
                  style={[styles.avatar, { borderColor: ui.bgPrimary }]}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor: item.background || ui.accent,
                      borderColor: ui.bgPrimary,
                    },
                  ]}
                >
                  <Text style={styles.initial}>{item.initial}</Text>
                </View>
              )}
            </View>
            <Text
              style={[styles.storyName, { color: item.isOwn ? ui.accent : ui.textSecondary }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 88,
    paddingTop: 8,
    paddingBottom: 16,
  },
  content: {
    gap: 16,
    paddingHorizontal: 16,
  },
  storyButton: {
    width: 68,
    alignItems: 'center',
    gap: 6,
  },
  ring: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 2,
    borderWidth: 0,
  },
  addRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 2,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  storyName: {
    width: 68,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
  },
  loader: {
    width: 42,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
