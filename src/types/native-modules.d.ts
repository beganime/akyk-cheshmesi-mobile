declare module 'react-native-incall-manager' {
  type StartParams = {
    media?: 'audio' | 'video';
    auto?: boolean;
    ringback?: string;
  };

  type StopParams = {
    busytone?: string;
  };

  const InCallManager: {
    start(params?: StartParams): void;
    stop(params?: StopParams): void;
    startRingtone(ringtone?: string): void;
    stopRingtone(): void;
    stopRingback(): void;
    setForceSpeakerphoneOn(flag?: boolean): void;
    setSpeakerphoneOn(enable?: boolean): void;
    setMicrophoneMute(enable?: boolean): void;
    setKeepScreenOn(enable?: boolean): void;
  };

  export default InCallManager;
}