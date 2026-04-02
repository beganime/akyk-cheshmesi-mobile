export type StickerItem = {
  uuid: string;
  title: string;
  code: string;
  image: string;
  emoji: string;
  sort_order: number;
};

export type StickerPackListItem = {
  uuid: string;
  title: string;
  slug: string;
  description?: string | null;
  cover?: string | null;
  sort_order: number;
  is_featured: boolean;
  stickers_count: number;
};

export type StickerPackDetail = {
  uuid: string;
  title: string;
  slug: string;
  description?: string | null;
  cover?: string | null;
  sort_order: number;
  is_featured: boolean;
  stickers: StickerItem[];
};