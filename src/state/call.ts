import { create } from 'zustand';

import { fetchCallDetail } from '@/src/lib/api/calls';
import { callEngine, type CallEngineState } from '@/src/lib/calls/CallEngine';
import type { CallSession, CallType } from '@/src/types/calls';

export type CallPhase =
  | 'idle'
  | 'incoming'
  | 'outgoing'
  | 'active'
  | 'ended'
  | 'error';

type CallStore = {
  phase: CallPhase;
  currentCall: CallSession | null;
  engineState: CallEngineState;
  busy: boolean;
  lastError: string | null;

  loadCall: (callUuid: string, phaseHint?: CallPhase) => Promise<CallSession | null>;
  startOutgoing: (chatUuid: string, callType: CallType) => Promise<CallSession>;
  acceptCurrent: () => Promise<void>;
  rejectCurrent: () => Promise<void>;
  endCurrent: () => Promise<void>;
  cancelOutgoing: () => Promise<void>;
  remoteEnded: (callUuid?: string | null) => Promise<void>;
  clear: () => Promise<void>;

  toggleMute: () => Promise<void>;
  toggleSpeaker: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  switchCamera: () => Promise<void>;
};

const initialEngineState = callEngine.getState();

export const useCallStore = create<CallStore>((set, get) => ({
  phase: 'idle',
  currentCall: null,
  engineState: initialEngineState,
  busy: false,
  lastError: null,

  loadCall: async (callUuid, phaseHint = 'incoming') => {
    try {
      const detail = await fetchCallDetail(callUuid);
      set({
        currentCall: detail,
        phase: phaseHint,
        lastError: null,
      });
      return detail;
    } catch (error) {
      console.error('loadCall error:', error);
      set({
        lastError: 'Не удалось загрузить данные звонка',
        phase: 'error',
      });
      return null;
    }
  },

  startOutgoing: async (chatUuid, callType) => {
    set({
      busy: true,
      phase: 'outgoing',
      lastError: null,
    });

    try {
      const created = await callEngine.startOutgoing(chatUuid, callType);
      set({
        currentCall: created,
        phase: 'outgoing',
        busy: false,
      });
      return created;
    } catch (error) {
      console.error('startOutgoing error:', error);
      set({
        busy: false,
        phase: 'error',
        lastError: 'Не удалось начать звонок',
      });
      throw error;
    }
  },

  acceptCurrent: async () => {
    const currentCall = get().currentCall;
    if (!currentCall) return;

    set({
      busy: true,
      lastError: null,
    });

    try {
      const accepted = await callEngine.acceptIncoming(currentCall);
      set({
        currentCall: accepted,
        phase: 'outgoing',
        busy: false,
      });
    } catch (error) {
      console.error('acceptCurrent error:', error);
      set({
        busy: false,
        phase: 'error',
        lastError: 'Не удалось принять звонок',
      });
    }
  },

  rejectCurrent: async () => {
    const currentCall = get().currentCall;
    if (!currentCall) return;

    set({ busy: true });

    try {
      await callEngine.rejectIncoming(currentCall.uuid);
      set({
        currentCall: null,
        phase: 'idle',
        busy: false,
        lastError: null,
      });
    } catch (error) {
      console.error('rejectCurrent error:', error);
      set({
        busy: false,
        phase: 'error',
        lastError: 'Не удалось отклонить звонок',
      });
    }
  },

  endCurrent: async () => {
    set({ busy: true });

    try {
      await callEngine.endCurrent();
      set({
        phase: 'ended',
        busy: false,
      });
    } catch (error) {
      console.error('endCurrent error:', error);
      set({
        busy: false,
        phase: 'error',
        lastError: 'Не удалось завершить звонок',
      });
    }
  },

  cancelOutgoing: async () => {
    const currentCall = get().currentCall;
    if (!currentCall) return;

    set({ busy: true });

    try {
      await callEngine.cancelOutgoing(currentCall.uuid);
      set({
        phase: 'ended',
        busy: false,
      });
    } catch (error) {
      console.error('cancelOutgoing error:', error);
      set({
        busy: false,
        phase: 'error',
        lastError: 'Не удалось отменить звонок',
      });
    }
  },

  remoteEnded: async (callUuid) => {
    const currentCall = get().currentCall;

    if (callUuid && currentCall?.uuid && currentCall.uuid !== callUuid) {
      return;
    }

    await callEngine.cleanup(true);

    set({
      phase: 'ended',
      busy: false,
    });
  },

  clear: async () => {
    await callEngine.cleanup(false);

    set({
      phase: 'idle',
      currentCall: null,
      busy: false,
      lastError: null,
      engineState: callEngine.getState(),
    });
  },

  toggleMute: async () => {
    const nextMuted = !get().engineState.muted;
    await callEngine.setMuted(nextMuted);
  },

  toggleSpeaker: async () => {
    const nextSpeakerOn = !get().engineState.speakerOn;
    await callEngine.setSpeakerOn(nextSpeakerOn);
  },

  toggleVideo: async () => {
    const nextVideoEnabled = !get().engineState.videoEnabled;
    await callEngine.setVideoEnabled(nextVideoEnabled);
  },

  switchCamera: async () => {
    await callEngine.switchCamera();
  },
}));

callEngine.subscribe((engineState) => {
  const currentStore = useCallStore.getState();

  let nextPhase = currentStore.phase;

  if (engineState.status === 'starting' || engineState.status === 'connecting') {
    if (currentStore.phase !== 'incoming') {
      nextPhase = 'outgoing';
    }
  }

  if (engineState.status === 'joined') {
    nextPhase = 'active';
  }

  if (engineState.status === 'ended') {
    nextPhase = 'ended';
  }

  if (engineState.status === 'error') {
    nextPhase = 'error';
  }

  if (engineState.status === 'idle' && !engineState.call) {
    if (!currentStore.currentCall) {
      nextPhase = 'idle';
    }
  }

  useCallStore.setState({
    engineState,
    currentCall: engineState.call ?? currentStore.currentCall,
    phase: nextPhase,
    lastError: engineState.error ?? currentStore.lastError,
  });
});