export type UploadedMedia = {
  uuid: string;
  original_name: string;
  content_type?: string | null;
  size?: number | null;
  media_kind?: 'image' | 'video' | 'audio' | 'file' | string;
  storage_provider?: 'local' | 's3' | string;
  object_key?: string | null;
  status?: 'pending' | 'uploaded' | 'failed' | string;
  is_public?: boolean;
  file_url?: string | null;
  meta?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type MediaPresignResponse = {
  media: UploadedMedia;
  upload: {
    method: 'PUT' | string;
    url: string;
    headers: Record<string, string>;
    expires_in_seconds: number;
  };
};