import { apiClient } from '@/src/lib/api/client';
import type { StickerPackDetail, StickerPackListItem } from '@/src/types/sticker';

export async function fetchStickerPacks(featuredOnly = false): Promise<StickerPackListItem[]> {
  const suffix = featuredOnly ? '?featured=true' : '';
  const response = await apiClient.get<StickerPackListItem[]>(`/sticker-packs/${suffix}`);
  return response.data ?? [];
}

export async function fetchStickerPackDetail(slug: string): Promise<StickerPackDetail> {
  const response = await apiClient.get<StickerPackDetail>(`/sticker-packs/${slug}/`);
  return response.data;
}