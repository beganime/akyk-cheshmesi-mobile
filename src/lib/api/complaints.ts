import { apiClient } from '@/src/lib/api/client';

export type ComplaintReason = 'spam' | 'abuse' | 'fraud' | 'harassment' | 'other';
export type ComplaintType = 'user' | 'chat' | 'message' | 'app';

type CreateComplaintPayload =
  | {
      complaint_type: 'user';
      reason: ComplaintReason;
      description?: string;
      reported_user_uuid: string;
    }
  | {
      complaint_type: 'chat';
      reason: ComplaintReason;
      description?: string;
      chat_uuid: string;
    }
  | {
      complaint_type: 'message';
      reason: ComplaintReason;
      description?: string;
      message_uuid: string;
    }
  | {
      complaint_type: 'app';
      reason: ComplaintReason;
      description?: string;
    };

export async function createComplaint(payload: CreateComplaintPayload) {
  const response = await apiClient.post('/complaints/', payload);
  return response.data;
}