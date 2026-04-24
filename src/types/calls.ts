export type CallType = 'audio' | 'video';

export type CallSessionStatus =
  | 'requested'
  | 'ringing'
  | 'accepted'
  | 'rejected'
  | 'canceled'
  | 'missed'
  | 'ended'
  | 'failed'
  | 'busy';

export type CallParticipantStatus =
  | 'invited'
  | 'ringing'
  | 'joined'
  | 'declined'
  | 'missed'
  | 'left'
  | 'failed'
  | 'busy';

export type CallParticipantRole = 'caller' | 'callee' | 'participant';

export type UserShortForCall = {
  uuid: string;
  username?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  avatar?: string | null;
};

export type CallParticipant = {
  uuid: string;
  role: CallParticipantRole;
  status: CallParticipantStatus;
  invited_at?: string | null;
  joined_at?: string | null;
  left_at?: string | null;
  duration_seconds?: number;
  device_id?: string | null;
  device_platform?: string | null;
  device_name?: string | null;
  is_muted?: boolean;
  is_video_enabled?: boolean;
  metadata?: Record<string, unknown>;
  user?: UserShortForCall | null;
};

export type CallEvent = {
  uuid: string;
  event_type: string;
  payload?: Record<string, unknown>;
  created_at?: string | null;
  actor?: UserShortForCall | null;
};

export type CallSession = {
  uuid: string;
  chat_uuid: string;
  call_type: CallType;
  status: CallSessionStatus;
  room_key: string;
  answered_at?: string | null;
  ended_at?: string | null;
  duration_seconds?: number;
  metadata?: Record<string, unknown>;
  created_at?: string | null;
  initiated_by?: UserShortForCall | null;
  participants?: CallParticipant[];
  events?: CallEvent[];
  my_status?: CallParticipantStatus | null;
};

export type CallCreatePayload = {
  call_type: CallType;
  metadata?: Record<string, unknown>;
};

export type CallActionPayload = {
  metadata?: Record<string, unknown>;
  device_id?: string;
  device_platform?: string;
  device_name?: string;
};

export type CallSignalMessage =
  | {
      type: 'join_call';
      chat_uuid: string;
      call_uuid: string;
      room_key: string;
    }
  | {
      type: 'leave_call';
      chat_uuid: string;
      call_uuid: string;
      room_key: string;
    }
  | {
      type: 'call_offer';
      chat_uuid: string;
      call_uuid: string;
      room_key: string;
      sdp: string;
      sdp_type?: 'offer';
    }
  | {
      type: 'call_answer';
      chat_uuid: string;
      call_uuid: string;
      room_key: string;
      sdp: string;
      sdp_type?: 'answer';
    }
  | {
      type: 'call_ice';
      chat_uuid: string;
      call_uuid: string;
      room_key: string;
      candidate: {
        candidate: string;
        sdpMid?: string | null;
        sdpMLineIndex?: number | null;
        usernameFragment?: string | null;
      };
    };

export type CallSocketEvent =
  | {
      type: 'joined_call';
      chat_uuid?: string;
      call_uuid?: string;
      room_key?: string;
      peer_id?: string;
      payload?: Record<string, unknown> | null;
    }
  | {
      type: 'call_new_peer' | 'call_existing_peer' | 'call_peer_left';
      chat_uuid?: string;
      call_uuid?: string;
      room_key?: string;
      peer_id?: string;
      payload?: Record<string, unknown> | null;
    }
  | {
      type: 'call_offer' | 'call_answer';
      chat_uuid?: string;
      call_uuid?: string;
      room_key?: string;
      peer_id?: string;
      sdp?: string;
      sdp_type?: 'offer' | 'answer';
      payload?: Record<string, unknown> | null;
    }
  | {
      type: 'call_ice';
      chat_uuid?: string;
      call_uuid?: string;
      room_key?: string;
      peer_id?: string;
      candidate?: {
        candidate: string;
        sdpMid?: string | null;
        sdpMLineIndex?: number | null;
        usernameFragment?: string | null;
      };
      payload?: Record<string, unknown> | null;
    }
  | {
      type: 'pong' | 'error';
      payload?: Record<string, unknown> | null;
    };