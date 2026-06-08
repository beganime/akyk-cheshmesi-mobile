import type { UserShort } from '@/src/types/user';

export type StoryMediaType = 'image' | 'video' | 'text';

export type StoryViewer = {
  uuid: string;
  viewed_at?: string | null;
  user?: UserShort | null;
};

export type StoryItem = {
  uuid: string;
  media_type: StoryMediaType;
  caption?: string | null;
  background?: string | null;
  media?: {
    uuid: string;
    file_url?: string | null;
    content_type?: string | null;
    media_kind?: string | null;
    original_name?: string | null;
  } | null;
  media_uuid?: string | null;
  file_url?: string | null;
  author?: UserShort | null;
  user?: UserShort | null;
  is_own?: boolean | null;
  viewers_count?: number | null;
  viewed_by_me?: boolean | null;
  expires_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PaginatedStoriesResponse = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: StoryItem[];
};

export type CreateStoryPayload =
  | {
      media_type: 'text';
      caption: string;
      background?: string;
    }
  | {
      media_type: 'image' | 'video';
      media_uuid: string;
      caption?: string;
    };
