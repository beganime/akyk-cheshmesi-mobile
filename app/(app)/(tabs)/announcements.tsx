import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import {
  fetchNews,
  fetchNewsCategories,
  getNextNewsPage,
} from '@/src/lib/api/news';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { NewsListItem } from '@/src/types/news';
import { getApiErrorMessage } from '@/src/utils/apiErrors';

function formatNewsDate(value?: string | null) {
  if (!value) return 'Дата не указана';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Дата не указана';

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export default function AnnouncementsScreen() {
  const { theme } = useTheme();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [importantOnly, setImportantOnly] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const categoriesQuery = useQuery({
    queryKey: ['student-life-news-categories'],
    queryFn: fetchNewsCategories,
    staleTime: 30 * 60 * 1000,
  });

  const newsQuery = useInfiniteQuery({
    queryKey: ['student-life-news', debouncedSearch, categorySlug, importantOnly],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      fetchNews({
        page: pageParam,
        search: debouncedSearch || undefined,
        categorySlug: categorySlug || undefined,
        isImportant: importantOnly ? true : undefined,
        ordering: '-published_at',
      }),
    getNextPageParam: (lastPage) => getNextNewsPage(lastPage.next),
    staleTime: 5 * 60 * 1000,
  });

  const news = useMemo(
    () => newsQuery.data?.pages.flatMap((page) => page.results) || [],
    [newsQuery.data],
  );

  const categories = categoriesQuery.data?.results || [];
  const refreshing = newsQuery.isRefetching && !newsQuery.isFetchingNextPage;

  const openNews = (item: NewsListItem) => {
    router.push({
      pathname: '/(app)/news/[identifier]',
      params: { identifier: item.slug || String(item.id) },
    });
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <View>
          <Text style={[styles.eyebrow, { color: theme.colors.primary }]}>STUDENT&apos;S LIFE</Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>Новости</Text>
        </View>
        <View style={[styles.headerMark, { backgroundColor: theme.colors.primarySoft }]}>
          <Ionicons name="newspaper" size={22} color={theme.colors.primary} />
        </View>
      </View>

      <View style={styles.filters}>
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: theme.colors.inputBackground,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Ionicons name="search" size={19} color={theme.colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Поиск новостей"
            placeholderTextColor={theme.colors.muted}
            style={[styles.searchInput, { color: theme.colors.text }]}
            returnKeyType="search"
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={10}>
              <Ionicons name="close-circle" size={19} color={theme.colors.muted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          <FilterChip
            title="Все"
            active={!categorySlug && !importantOnly}
            onPress={() => {
              setCategorySlug(null);
              setImportantOnly(false);
            }}
          />
          <FilterChip
            title="Важное"
            icon="star"
            active={importantOnly}
            onPress={() => setImportantOnly((current) => !current)}
          />
          {categories.map((category) => (
            <FilterChip
              key={category.id}
              title={category.title}
              active={categorySlug === category.slug}
              onPress={() => {
                setCategorySlug((current) =>
                  current === category.slug ? null : category.slug,
                );
                setImportantOnly(false);
              }}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={news}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[
          styles.listContent,
          news.length === 0 && styles.emptyListContent,
        ]}
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => openNews(item)}
            style={({ pressed }) => [
              styles.newsItem,
              {
                borderColor: theme.colors.border,
                opacity: pressed ? 0.72 : 1,
              },
              index === 0 && styles.firstNewsItem,
            ]}
          >
            {item.cover_image ? (
              <ExpoImage
                source={{ uri: item.cover_image }}
                style={styles.cover}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={180}
              />
            ) : (
              <View style={[styles.cover, styles.coverFallback, { backgroundColor: theme.colors.primarySoft }]}>
                <Ionicons name="newspaper-outline" size={30} color={theme.colors.primary} />
              </View>
            )}

            <View style={styles.newsBody}>
              <View style={styles.metaRow}>
                <Text style={[styles.category, { color: theme.colors.primary }]} numberOfLines={1}>
                  {item.category_title || 'Новости'}
                </Text>
                {item.is_important ? (
                  <Ionicons name="star" size={13} color={theme.colors.primary} />
                ) : null}
              </View>
              <Text style={[styles.newsTitle, { color: theme.colors.text }]} numberOfLines={3}>
                {item.title}
              </Text>
              {item.short_description ? (
                <Text style={[styles.description, { color: theme.colors.muted }]} numberOfLines={3}>
                  {item.short_description}
                </Text>
              ) : null}
              <Text style={[styles.date, { color: theme.colors.muted }]}>
                {formatNewsDate(item.published_at)}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          newsQuery.isLoading ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : newsQuery.isError ? (
            <View style={styles.emptyState}>
              <Ionicons name="cloud-offline-outline" size={32} color={theme.colors.muted} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Не удалось загрузить новости</Text>
              <Text style={[styles.emptyText, { color: theme.colors.muted }]}>
                {getApiErrorMessage(newsQuery.error, 'Проверьте подключение и повторите попытку')}
              </Text>
              <Pressable
                onPress={() => void newsQuery.refetch()}
                style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
              >
                <Text style={styles.retryText}>Повторить</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={32} color={theme.colors.muted} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Ничего не найдено</Text>
              <Text style={[styles.emptyText, { color: theme.colors.muted }]}>Измените запрос или категорию</Text>
            </View>
          )
        }
        ListFooterComponent={
          newsQuery.isFetchingNextPage ? (
            <ActivityIndicator style={styles.footerLoader} color={theme.colors.primary} />
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void newsQuery.refetch()}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        onEndReached={() => {
          if (newsQuery.hasNextPage && !newsQuery.isFetchingNextPage) {
            void newsQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.35}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );

  function FilterChip({
    title,
    active,
    icon,
    onPress,
  }: {
    title: string;
    active: boolean;
    icon?: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  }) {
    return (
      <Pressable
        onPress={onPress}
        style={[
          styles.chip,
          {
            backgroundColor: active ? theme.colors.primary : theme.colors.backgroundSecondary,
            borderColor: active ? theme.colors.primary : theme.colors.border,
          },
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={14}
            color={active ? theme.colors.fabText : theme.colors.muted}
          />
        ) : null}
        <Text style={[styles.chipText, { color: active ? theme.colors.fabText : theme.colors.text }]}>
          {title}
        </Text>
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    minHeight: 72,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 0 },
  title: { marginTop: 2, fontSize: 27, fontWeight: '700' },
  headerMark: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filters: { paddingTop: 12 },
  searchBox: {
    minHeight: 46,
    marginHorizontal: 16,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: 15, paddingVertical: 0 },
  categoryRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: {
    minHeight: 34,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  listContent: { paddingHorizontal: 16, paddingBottom: 112 },
  emptyListContent: { flexGrow: 1 },
  newsItem: {
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 14,
  },
  firstNewsItem: { borderTopWidth: StyleSheet.hairlineWidth },
  cover: { width: 112, height: 116, borderRadius: 12, overflow: 'hidden' },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  newsBody: { flex: 1, minWidth: 0 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  category: { flexShrink: 1, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  newsTitle: { marginTop: 5, fontSize: 17, lineHeight: 21, fontWeight: '700' },
  description: { marginTop: 6, fontSize: 13, lineHeight: 18 },
  date: { marginTop: 'auto', paddingTop: 7, fontSize: 11, fontWeight: '600' },
  emptyState: {
    flex: 1,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retryButton: { minHeight: 42, marginTop: 5, paddingHorizontal: 18, borderRadius: 10, justifyContent: 'center' },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  footerLoader: { marginVertical: 18 },
});
