export type NewsCategory = {
  id: number;
  title: string;
  slug: string;
};

export type NewsAuthor = {
  id: number;
  full_name: string;
  position?: string | null;
  office?: number | null;
  office_title?: string | null;
  avatar?: string | null;
  bio?: string | null;
  specialization?: string | null;
};

export type NewsListItem = {
  id: number;
  title: string;
  slug: string;
  short_description?: string | null;
  cover_image?: string | null;
  category?: number | null;
  category_title?: string | null;
  author_name?: string | null;
  author_avatar?: string | null;
  is_important?: boolean;
  published_at?: string | null;
};

export type NewsDetail = NewsListItem & {
  content_markdown?: string | null;
  author_staff?: NewsAuthor | null;
  meta_title?: string | null;
  meta_description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PaginatedNewsResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type NewsListParams = {
  page?: number;
  search?: string;
  category?: number;
  categorySlug?: string;
  isImportant?: boolean;
  ordering?: 'published_at' | '-published_at';
};
