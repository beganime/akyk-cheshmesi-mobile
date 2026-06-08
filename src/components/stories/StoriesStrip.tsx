import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { fetchStories } from '@/src/lib/api/stories';
import type { StoryItem } from '@/src/types/stories';
import { useTheme } from '@/src/theme/ThemeProvider';

type Props = {
  compact?: boolean;
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

function getStoryImage(story: StoryItem) {
  return story.media?.file_url || story.file_url || null;
}

export function StoriesStrip({ compact = false }: Props) {
  const { theme } = useTheme();
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

  const visibleStories = useMemo(() => stories.slice(0, compact ? 12 : 30), [compact, stories]);

  return (
    <View style={styles.wrap}>
      <FlatList
        horizontal
        data={visibleStories}
        keyExtractor={(item) => item.uuid}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <Pressable
            onPress={() => router.push('/(app)/(tabs)/stories' as any)}
            style={styles.storyButton}
          >
            <View style={[styles.addCircle, { backgroundColor: theme.colors.primarySoft }]}>
              <Ionicons name="add" size={24} color={theme.colors.primary} />
            </View>
            <Text style={[styles.storyName, { color: theme.colors.text }]} numberOfLines={1}>
              Моя story
            </Text>
          </Pressable>
        }
        ListFooterComponent={
          loading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const image = getStoryImage(item);
          const name = getAuthorName(item);

          return (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(app)/story-viewer' as any,
                  params: { storyUuid: item.uuid },
                })
              }
              style={styles.storyButton}
            >
              <View style={styles.ring}>
                {image ? (
                  <ExpoImage source={{ uri: image }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View
                    style={[
                      styles.avatar,
                      {
                        backgroundColor: item.background || theme.colors.primary,
                      },
                    ]}
                  >
                    <Text style={styles.initial}>{name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.storyName, { color: theme.colors.text }]} numberOfLines={1}>
                {name}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 96,
    marginBottom: 10,
  },
  content: {
    gap: 12,
    paddingHorizontal: 2,
  },
  storyButton: {
    width: 70,
    alignItems: 'center',
    gap: 6,
  },
  ring: {
    width: 62,
    height: 62,
    borderRadius: 31,
    padding: 2,
    backgroundColor: '#F09433',
    borderWidth: 2,
    borderColor: '#CC2366',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(42,171,238,0.22)',
  },
  initial: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  storyName: {
    width: 70,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
  },
  loader: {
    width: 46,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
