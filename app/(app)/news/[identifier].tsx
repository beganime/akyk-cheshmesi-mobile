import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { fetchNewsDetail } from '@/src/lib/api/news';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getApiErrorMessage } from '@/src/utils/apiErrors';

type ContentBlock = {
  key: string;
  kind: 'heading' | 'paragraph' | 'bullet';
  text: string;
};

function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function parseContent(value?: string | null): ContentBlock[] {
  if (!value?.trim()) return [];

  return value
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .flatMap((section, sectionIndex) =>
      section
        .split('\n')
        .map((line, lineIndex) => {
          const trimmed = line.trim();
          if (!trimmed) return null;

          const heading = trimmed.match(/^#{1,4}\s+(.+)$/);
          const bullet = trimmed.match(/^[-*]\s+(.+)$/);
          const text = (heading?.[1] || bullet?.[1] || trimmed)
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/__(.*?)__/g, '$1');

          return {
            key: `${sectionIndex}:${lineIndex}`,
            kind: heading ? 'heading' : bullet ? 'bullet' : 'paragraph',
            text,
          } satisfies ContentBlock;
        })
        .filter((item): item is ContentBlock => Boolean(item)),
    );
}

export default function NewsDetailScreen() {
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ identifier?: string | string[] }>();
  const identifier = Array.isArray(params.identifier)
    ? params.identifier[0]
    : params.identifier;

  const query = useQuery({
    queryKey: ['student-life-news-detail', identifier],
    queryFn: () => fetchNewsDetail(identifier || ''),
    enabled: Boolean(identifier),
    staleTime: 10 * 60 * 1000,
  });

  const article = query.data;
  const blocks = useMemo(
    () => parseContent(article?.content_markdown),
    [article?.content_markdown],
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}> 
        <Pressable onPress={() => router.back()} style={styles.headerButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={25} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Новость</Text>
        <View style={styles.headerButton} />
      </View>

      {query.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : query.isError || !article ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={34} color={theme.colors.muted} />
          <Text style={[styles.errorTitle, { color: theme.colors.text }]}>Новость недоступна</Text>
          <Text style={[styles.errorText, { color: theme.colors.muted }]}> 
            {getApiErrorMessage(query.error, 'Не удалось получить материал')}
          </Text>
          <Pressable
            onPress={() => void query.refetch()}
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={styles.retryText}>Повторить</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {article.cover_image ? (
            <ExpoImage
              source={{ uri: article.cover_image }}
              style={styles.heroImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={180}
            />
          ) : null}

          <View style={styles.articleBody}>
            <View style={styles.metaRow}>
              <View style={[styles.categoryPill, { backgroundColor: theme.colors.primarySoft }]}> 
                <Text style={[styles.categoryText, { color: theme.colors.primary }]}> 
                  {article.category_title || 'Новости'}
                </Text>
              </View>
              {article.is_important ? (
                <View style={[styles.importantPill, { borderColor: theme.colors.primary }]}> 
                  <Ionicons name="star" size={12} color={theme.colors.primary} />
                  <Text style={[styles.importantText, { color: theme.colors.primary }]}>Важно</Text>
                </View>
              ) : null}
            </View>

            <Text style={[styles.title, { color: theme.colors.text }]}>{article.title}</Text>
            {article.short_description ? (
              <Text style={[styles.lead, { color: theme.colors.muted }]}> 
                {article.short_description}
              </Text>
            ) : null}

            <View style={[styles.byline, { borderColor: theme.colors.border }]}> 
              {article.author_staff?.avatar || article.author_avatar ? (
                <ExpoImage
                  source={{ uri: article.author_staff?.avatar || article.author_avatar || '' }}
                  style={styles.authorAvatar}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={[styles.authorAvatar, styles.authorFallback, { backgroundColor: theme.colors.primarySoft }]}> 
                  <Ionicons name="person-outline" size={18} color={theme.colors.primary} />
                </View>
              )}
              <View style={styles.bylineText}>
                <Text style={[styles.authorName, { color: theme.colors.text }]} numberOfLines={1}>
                  {article.author_staff?.full_name || article.author_name || "Student's Life"}
                </Text>
                <Text style={[styles.date, { color: theme.colors.muted }]} numberOfLines={1}>
                  {[article.author_staff?.position, formatDate(article.published_at)]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            </View>

            <View style={styles.markdown}>
              {blocks.length > 0 ? (
                blocks.map((block) =>
                  block.kind === 'bullet' ? (
                    <View key={block.key} style={styles.bulletRow}>
                      <View style={[styles.bullet, { backgroundColor: theme.colors.primary }]} />
                      <Text style={[styles.paragraph, { color: theme.colors.text }]}>{block.text}</Text>
                    </View>
                  ) : (
                    <Text
                      key={block.key}
                      style={[
                        block.kind === 'heading' ? styles.sectionTitle : styles.paragraph,
                        { color: theme.colors.text },
                      ]}
                    >
                      {block.text}
                    </Text>
                  ),
                )
              ) : (
                <Text style={[styles.paragraph, { color: theme.colors.muted }]}>Текст новости пока не опубликован.</Text>
              )}
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    minHeight: 56,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  centered: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center', gap: 10 },
  errorTitle: { fontSize: 18, fontWeight: '700' },
  errorText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retryButton: { minHeight: 42, marginTop: 5, paddingHorizontal: 18, borderRadius: 10, justifyContent: 'center' },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  content: { paddingBottom: 40 },
  heroImage: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#D1D5DB' },
  articleBody: { paddingHorizontal: 20, paddingTop: 20 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryPill: { minHeight: 28, paddingHorizontal: 10, borderRadius: 8, justifyContent: 'center' },
  categoryText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  importantPill: { minHeight: 28, paddingHorizontal: 9, borderWidth: 1, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  importantText: { fontSize: 11, fontWeight: '800' },
  title: { marginTop: 16, fontSize: 30, lineHeight: 36, fontWeight: '700' },
  lead: { marginTop: 12, fontSize: 17, lineHeight: 25 },
  byline: { marginTop: 20, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 11 },
  authorAvatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  authorFallback: { alignItems: 'center', justifyContent: 'center' },
  bylineText: { flex: 1, minWidth: 0 },
  authorName: { fontSize: 14, fontWeight: '700' },
  date: { marginTop: 2, fontSize: 12 },
  markdown: { paddingTop: 22, gap: 15 },
  sectionTitle: { marginTop: 4, fontSize: 21, lineHeight: 27, fontWeight: '700' },
  paragraph: { flex: 1, fontSize: 16, lineHeight: 26 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  bullet: { width: 6, height: 6, marginTop: 10, borderRadius: 3 },
});
