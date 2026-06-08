import { apiClient } from '@/src/lib/api/client';
import type {
  CreateStoryPayload,
  PaginatedStoriesResponse,
  StoryItem,
  StoryViewer,
} from '@/src/types/stories';

function normalizeStoriesResponse(data: StoryItem[] | PaginatedStoriesResponse) {
  if (Array.isArray(data)) {
    return data;
  }

  return Array.isArray(data?.results) ? data.results : [];
}

export async function fetchStories(): Promise<StoryItem[]> {
  const response = await apiClient.get<StoryItem[] | PaginatedStoriesResponse>('/stories/');
  return normalizeStoriesResponse(response.data);
}

export async function fetchStoryDetail(storyUuid: string): Promise<StoryItem> {
  const response = await apiClient.get<StoryItem>(`/stories/${storyUuid}/`);
  return response.data;
}

export async function createStory(payload: CreateStoryPayload): Promise<StoryItem> {
  const response = await apiClient.post<StoryItem>('/stories/', payload);
  return response.data;
}

export async function deleteStory(storyUuid: string) {
  const response = await apiClient.delete(`/stories/${storyUuid}/`);
  return response.data;
}

export async function markStoryViewed(storyUuid: string) {
  const response = await apiClient.post(`/stories/${storyUuid}/viewers/`);
  return response.data;
}

export async function fetchStoryViewers(storyUuid: string): Promise<StoryViewer[]> {
  const response = await apiClient.get<StoryViewer[] | { results?: StoryViewer[] }>(
    `/stories/${storyUuid}/viewers/`,
  );

  if (Array.isArray(response.data)) {
    return response.data;
  }

  return Array.isArray(response.data?.results) ? response.data.results : [];
}
