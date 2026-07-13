import axios, { type AxiosError, type AxiosRequestConfig } from 'axios';

import type {
  NewsCategory,
  NewsDetail,
  NewsListItem,
  NewsListParams,
  PaginatedNewsResponse,
} from '@/src/types/news';

const NEWS_API_BASES = [
  'https://students-life.ru/api2/api/v1/news',
  'https://stud-life.com/api/v1/news',
] as const;

const newsClient = axios.create({
  timeout: 15_000,
  headers: {
    Accept: 'application/json',
  },
});

function shouldTryFallback(error: unknown) {
  const status = (error as AxiosError | undefined)?.response?.status;
  return !status || status === 404 || status >= 500;
}

async function requestNewsApi<T>(
  path: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  let lastError: unknown;

  for (const [index, baseUrl] of NEWS_API_BASES.entries()) {
    try {
      const response = await newsClient.request<T>({
        ...config,
        method: 'GET',
        url: `${baseUrl}${path}`,
      });
      return response.data;
    } catch (error) {
      lastError = error;
      if (index === NEWS_API_BASES.length - 1 || !shouldTryFallback(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

function normalizePage<T>(
  data: PaginatedNewsResponse<T> | T[],
): PaginatedNewsResponse<T> {
  if (Array.isArray(data)) {
    return {
      count: data.length,
      next: null,
      previous: null,
      results: data,
    };
  }

  return {
    count: Number(data?.count || 0),
    next: data?.next || null,
    previous: data?.previous || null,
    results: Array.isArray(data?.results) ? data.results : [],
  };
}

export async function fetchNews(params: NewsListParams = {}) {
  const data = await requestNewsApi<PaginatedNewsResponse<NewsListItem> | NewsListItem[]>(
    '/',
    {
      params: {
        ...(params.page ? { page: params.page } : {}),
        ...(params.search?.trim() ? { search: params.search.trim() } : {}),
        ...(params.category ? { category: params.category } : {}),
        ...(params.categorySlug ? { category__slug: params.categorySlug } : {}),
        ...(typeof params.isImportant === 'boolean'
          ? { is_important: params.isImportant }
          : {}),
        ordering: params.ordering || '-published_at',
      },
    },
  );

  return normalizePage(data);
}

export async function fetchNewsDetail(identifier: string | number) {
  return requestNewsApi<NewsDetail>(`/${encodeURIComponent(String(identifier))}/`);
}

export async function fetchNewsCategories() {
  const data = await requestNewsApi<
    PaginatedNewsResponse<NewsCategory> | NewsCategory[]
  >('/categories/');
  return normalizePage(data);
}

export async function fetchNewsCategory(identifier: string | number) {
  return requestNewsApi<NewsCategory>(
    `/categories/${encodeURIComponent(String(identifier))}/`,
  );
}

export function getNextNewsPage(nextUrl: string | null) {
  if (!nextUrl) return undefined;
  const match = nextUrl.match(/[?&]page=(\d+)/);
  return match ? Number(match[1]) : undefined;
}
