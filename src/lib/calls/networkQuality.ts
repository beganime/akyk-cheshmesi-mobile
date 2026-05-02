import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export type CallVideoProfile = {
  label: 'low' | 'medium' | 'high';
  width: number;
  height: number;
  frameRate: number;
  maxVideoBitrate: number;
};

export const LOW_VIDEO_PROFILE: CallVideoProfile = {
  label: 'low',
  width: 320,
  height: 180,
  frameRate: 12,
  maxVideoBitrate: 180_000,
};

export const MEDIUM_VIDEO_PROFILE: CallVideoProfile = {
  label: 'medium',
  width: 640,
  height: 360,
  frameRate: 20,
  maxVideoBitrate: 550_000,
};

export const HIGH_VIDEO_PROFILE: CallVideoProfile = {
  label: 'high',
  width: 960,
  height: 540,
  frameRate: 24,
  maxVideoBitrate: 1_200_000,
};

export function profileFromNetInfoState(state: NetInfoState): CallVideoProfile {
  const details = state.details as Record<string, unknown> | null | undefined;
  const cellularGeneration = String(details?.cellularGeneration || '').toLowerCase();
  const downlink = Number(details?.downlink || 0);

  if (!state.isConnected || state.isInternetReachable === false) {
    return LOW_VIDEO_PROFILE;
  }

  if (state.type === 'cellular') {
    if (cellularGeneration === '2g' || cellularGeneration === '3g') {
      return LOW_VIDEO_PROFILE;
    }

    if (cellularGeneration === '4g') {
      return MEDIUM_VIDEO_PROFILE;
    }
  }

  if (downlink > 0 && downlink < 1.2) {
    return LOW_VIDEO_PROFILE;
  }

  if (downlink > 0 && downlink < 3) {
    return MEDIUM_VIDEO_PROFILE;
  }

  return HIGH_VIDEO_PROFILE;
}

export async function getCurrentCallVideoProfile(): Promise<CallVideoProfile> {
  const state = await NetInfo.fetch();
  return profileFromNetInfoState(state);
}