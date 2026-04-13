import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import {
  CameraView,
  type CameraType,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';

import { useTheme } from '@/src/theme/ThemeProvider';
import type { PickedMediaAsset } from '@/src/lib/api/media';

export type CaptureMode = 'audio' | 'video';

type ChatCaptureModalProps = {
  visible: boolean;
  mode: CaptureMode;
  onClose: () => void;
  onCaptured: (payload: PickedMediaAsset) => Promise<void> | void;
};

const VIDEO_MAX_DURATION_SECONDS = 30;
const VIDEO_MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const VIDEO_BITRATE = 750_000;

function formatMillis(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatSecondsRemaining(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `00:${String(seconds).padStart(2, '0')}`;
}

export function ChatCaptureModal({
  visible,
  mode,
  onClose,
  onCaptured,
}: ChatCaptureModalProps) {
  const { theme } = useTheme();

  const cameraRef = useRef<any>(null);

  const [audioPermission, requestAudioPermission] = Audio.usePermissions();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();

  const [audioRecording, setAudioRecording] = useState<Audio.Recording | null>(null);
  const [audioDurationMs, setAudioDurationMs] = useState(0);

  const [videoRecording, setVideoRecording] = useState(false);
  const [videoDurationMs, setVideoDurationMs] = useState(0);
  const [cameraFacing, setCameraFacing] = useState<CameraType>('front');
  const [cameraTorch, setCameraTorch] = useState(false);

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (audioRecording) {
      interval = setInterval(async () => {
        try {
          const status = await audioRecording.getStatusAsync();

          if (status.isLoaded && status.canRecord) {
            setAudioDurationMs(status.durationMillis || 0);
          }
        } catch (error) {
          console.error('audio status interval error:', error);
        }
      }, 250);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [audioRecording]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (videoRecording) {
      interval = setInterval(() => {
        setVideoDurationMs((current) => {
          const next = current + 250;

          if (next >= VIDEO_MAX_DURATION_SECONDS * 1000) {
            try {
              cameraRef.current?.stopRecording?.();
            } catch (error) {
              console.error('auto stop video recording error:', error);
            }
            return VIDEO_MAX_DURATION_SECONDS * 1000;
          }

          return next;
        });
      }, 250);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [videoRecording]);

  useEffect(() => {
    if (!visible) {
      setVideoDurationMs(0);
      setAudioDurationMs(0);
      setCameraTorch(false);
      setCameraFacing('front');
    }
  }, [visible]);

  const title = useMemo(() => {
    return mode === 'audio' ? 'Голосовое сообщение' : 'Видео-сообщение';
  }, [mode]);

  const closeSafely = async () => {
    if (busy) return;

    try {
      if (audioRecording) {
        await audioRecording.stopAndUnloadAsync().catch(() => null);
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        }).catch(() => null);
        setAudioRecording(null);
        setAudioDurationMs(0);
      }

      if (videoRecording) {
        cameraRef.current?.stopRecording?.();
        setVideoRecording(false);
        setVideoDurationMs(0);
      }
    } finally {
      onClose();
    }
  };

  const startAudioRecording = async () => {
    try {
      setBusy(true);

      const permission = audioPermission?.granted
        ? audioPermission
        : await requestAudioPermission();

      if (!permission?.granted) {
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      setAudioDurationMs(0);
      setAudioRecording(recording);
    } catch (error) {
      console.error('startAudioRecording error:', error);
    } finally {
      setBusy(false);
    }
  };

  const stopAudioRecordingAndSend = async () => {
    if (!audioRecording) return;

    try {
      setBusy(true);

      await audioRecording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const uri = audioRecording.getURI();
      const durationSeconds = Math.max(1, Math.ceil(audioDurationMs / 1000));

      setAudioRecording(null);

      if (!uri) {
        return;
      }

      await onCaptured({
        uri,
        fileName: `voice-${Date.now()}${Platform.OS === 'web' ? '.webm' : '.m4a'}`,
        mimeType: Platform.OS === 'web' ? 'audio/webm' : 'audio/m4a',
        duration: durationSeconds,
      });

      setAudioDurationMs(0);
      onClose();
    } catch (error) {
      console.error('stopAudioRecordingAndSend error:', error);
    } finally {
      setBusy(false);
    }
  };

  const ensureVideoPermissions = async () => {
    const cameraStatus = cameraPermission?.granted
      ? cameraPermission
      : await requestCameraPermission();

    if (!cameraStatus?.granted) {
      return false;
    }

    const micStatus = microphonePermission?.granted
      ? microphonePermission
      : await requestMicrophonePermission();

    if (!micStatus?.granted) {
      return false;
    }

    return true;
  };

  const startVideoRecording = async () => {
    try {
      setBusy(true);

      const granted = await ensureVideoPermissions();
      if (!granted) {
        return;
      }

      setVideoDurationMs(0);
      setVideoRecording(true);

      const result = await cameraRef.current?.recordAsync?.({
        maxDuration: VIDEO_MAX_DURATION_SECONDS,
        maxFileSize: VIDEO_MAX_FILE_SIZE_BYTES,
        videoBitrate: VIDEO_BITRATE,
        videoQuality: Platform.OS === 'android' ? '480p' : '4:3',
        codec: Platform.OS === 'ios' ? 'avc1' : undefined,
      });

      const durationSeconds = Math.max(1, Math.ceil(videoDurationMs / 1000));
      setVideoRecording(false);

      if (!result?.uri) {
        return;
      }

      await onCaptured({
        uri: result.uri,
        fileName: `video-${Date.now()}.mp4`,
        mimeType: 'video/mp4',
        duration: durationSeconds,
      });

      setVideoDurationMs(0);
      onClose();
    } catch (error) {
      console.error('startVideoRecording error:', error);
      setVideoRecording(false);
    } finally {
      setBusy(false);
    }
  };

  const stopVideoRecording = () => {
    try {
      cameraRef.current?.stopRecording?.();
    } catch (error) {
      console.error('stopVideoRecording error:', error);
    }
  };

  if (mode === 'audio') {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => void closeSafely()}
      >
        <View style={styles.audioOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => void closeSafely()} />

          <View
            style={[
              styles.audioSheet,
              {
                backgroundColor: theme.colors.cardSolid,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <View
              style={[
                styles.audioIconWrap,
                {
                  backgroundColor: theme.colors.primarySoft,
                },
              ]}
            >
              <Ionicons
                name={audioRecording ? 'mic' : 'mic-outline'}
                size={30}
                color={theme.colors.primary}
              />
            </View>

            <Text style={[styles.audioTitle, { color: theme.colors.text }]}>{title}</Text>
            <Text style={[styles.audioTimer, { color: theme.colors.muted }]}>
              {formatMillis(audioDurationMs)}
            </Text>

            <Text style={[styles.audioHint, { color: theme.colors.muted }]}>
              {audioRecording
                ? 'Нажми “Отправить”, чтобы закончить и отправить запись'
                : 'Нажми “Записать”, чтобы начать запись'}
            </Text>

            <View style={styles.audioActions}>
              <Pressable
                onPress={() => void closeSafely()}
                style={[
                  styles.secondaryBtn,
                  {
                    borderColor: theme.colors.borderStrong,
                    backgroundColor: theme.colors.backgroundTertiary,
                  },
                ]}
              >
                <Text style={[styles.secondaryBtnText, { color: theme.colors.text }]}>
                  Отмена
                </Text>
              </Pressable>

              {!audioRecording ? (
                <Pressable
                  onPress={() => void startAudioRecording()}
                  disabled={busy}
                  style={[
                    styles.primaryBtn,
                    {
                      backgroundColor: theme.colors.primary,
                    },
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="radio-button-on" size={18} color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>Записать</Text>
                    </>
                  )}
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => void stopAudioRecordingAndSend()}
                  disabled={busy}
                  style={[
                    styles.primaryBtn,
                    {
                      backgroundColor: theme.colors.primary,
                    },
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="send" size={18} color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>Отправить</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  const cameraReady =
    visible &&
    cameraPermission?.granted &&
    microphonePermission?.granted;

  const countdownMs = Math.max(0, VIDEO_MAX_DURATION_SECONDS * 1000 - videoDurationMs);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => void closeSafely()}
    >
      <View style={styles.videoOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => void closeSafely()} />

        <View
          style={[
            styles.videoSheet,
            {
              backgroundColor: theme.colors.cardSolid,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <View style={styles.videoTopRow}>
            <Pressable
              onPress={() => void closeSafely()}
              style={[
                styles.videoIconBtn,
                {
                  backgroundColor: theme.colors.backgroundTertiary,
                },
              ]}
            >
              <Ionicons name="close" size={20} color={theme.colors.text} />
            </Pressable>

            <View
              style={[
                styles.videoPill,
                {
                  backgroundColor: theme.colors.backgroundTertiary,
                },
              ]}
            >
              <View
                style={[
                  styles.videoPillDot,
                  {
                    opacity: videoRecording ? 1 : 0.45,
                  },
                ]}
              />
              <Text style={[styles.videoPillText, { color: theme.colors.text }]}>
                {videoRecording
                  ? formatSecondsRemaining(countdownMs)
                  : 'Лимит 00:30'}
              </Text>
            </View>

            <Pressable
              onPress={() => setCameraTorch((current) => !current)}
              style={[
                styles.videoIconBtn,
                {
                  backgroundColor: theme.colors.backgroundTertiary,
                },
              ]}
            >
              <Ionicons
                name={cameraTorch ? 'flash' : 'flash-off'}
                size={18}
                color={theme.colors.text}
              />
            </Pressable>
          </View>

          <View
            style={[
              styles.cameraCircleOuter,
              {
                borderColor: theme.colors.borderStrong,
                backgroundColor: '#000000',
              },
            ]}
          >
            {cameraReady ? (
              <View style={styles.cameraCircleInner}>
                <CameraView
                  ref={cameraRef}
                  style={styles.cameraView}
                  facing={cameraFacing}
                  mode="video"
                  active={visible}
                  enableTorch={cameraTorch}
                  mirror={cameraFacing === 'front'}
                  mute={false}
                />
              </View>
            ) : (
              <View style={styles.cameraFallback}>
                <Ionicons name="videocam-outline" size={42} color={theme.colors.primary} />
                <Text style={[styles.cameraFallbackTitle, { color: theme.colors.text }]}>
                  Нужен доступ
                </Text>
                <Text style={[styles.cameraFallbackText, { color: theme.colors.muted }]}>
                  Разреши камеру и микрофон для записи видео-сообщений
                </Text>

                <Pressable
                  onPress={() => void ensureVideoPermissions()}
                  style={[
                    styles.permissionBtn,
                    {
                      backgroundColor: theme.colors.primary,
                    },
                  ]}
                >
                  <Text style={styles.permissionBtnText}>Разрешить</Text>
                </Pressable>
              </View>
            )}
          </View>

          <Text style={[styles.videoCaption, { color: theme.colors.muted }]}>
            Видео записывается в кружке, до 30 секунд, в лёгком качестве для меньшего веса.
          </Text>

          <View style={styles.videoBottomRow}>
            <Pressable
              onPress={() =>
                setCameraFacing((current) => (current === 'back' ? 'front' : 'back'))
              }
              style={[
                styles.videoControlBtn,
                {
                  backgroundColor: theme.colors.backgroundTertiary,
                },
              ]}
            >
              <Ionicons name="camera-reverse-outline" size={22} color={theme.colors.text} />
            </Pressable>

            {!videoRecording ? (
              <Pressable
                onPress={() => void startVideoRecording()}
                disabled={busy || !cameraReady}
                style={styles.recordButtonWrap}
              >
                <View
                  style={[
                    styles.recordButtonOuter,
                    {
                      borderColor: theme.colors.primary,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.recordButtonInner,
                      {
                        backgroundColor: theme.colors.primary,
                      },
                    ]}
                  />
                </View>
              </Pressable>
            ) : (
              <Pressable onPress={stopVideoRecording} style={styles.recordButtonWrap}>
                <View
                  style={[
                    styles.stopButtonOuter,
                    {
                      borderColor: theme.colors.primary,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.stopButtonInner,
                      {
                        backgroundColor: theme.colors.primary,
                      },
                    ]}
                  />
                </View>
              </Pressable>
            )}

            <View style={styles.videoControlGhost} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  audioOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.34)',
    justifyContent: 'flex-end',
    padding: 14,
  },
  audioSheet: {
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 20,
    alignItems: 'center',
  },
  audioIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  audioTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  audioTimer: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  audioHint: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  audioActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  primaryBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  videoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.34)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  videoSheet: {
    width: '100%',
    borderRadius: 30,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    alignItems: 'center',
  },
  videoTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  videoIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPill: {
    minHeight: 40,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  videoPillDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#FF4D4F',
  },
  videoPillText: {
    fontSize: 14,
    fontWeight: '800',
  },
  cameraCircleOuter: {
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cameraCircleInner: {
    width: 268,
    height: 268,
    borderRadius: 134,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  cameraView: {
    width: '100%',
    height: '100%',
  },
  cameraFallback: {
    width: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraFallbackTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 6,
  },
  cameraFallbackText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  permissionBtn: {
    minWidth: 140,
    minHeight: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  permissionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  videoCaption: {
    marginTop: 14,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
  },
  videoBottomRow: {
    marginTop: 18,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  videoControlBtn: {
    width: 52,
    height: 52,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoControlGhost: {
    width: 52,
    height: 52,
  },
  recordButtonWrap: {
    width: 86,
    height: 86,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonOuter: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  stopButtonOuter: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButtonInner: {
    width: 34,
    height: 34,
    borderRadius: 10,
  },
});
